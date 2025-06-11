import express from "express";
import cors from "cors";
import path from "path";
import { HumanMessage } from "@langchain/core/messages";
import { initChatModel, initEmbeddingModel } from "./models";
import { loadData } from "./data-processor";
import { createRetrieveTool } from "./tools";
import { createStatefulAgent, getThreadConfig } from "./agent";
import { ChatbotResponse } from "./schema";

const app = express();

// Global vars for agent
let agent: any;
let checkpointer: any;
const threadMap = new Map<string, string>();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// Initialize the agent
export async function initializeAgent() {
    console.log("Initializing Product Information Chatbot with LangGraph...");

    // Check if API key is set
    if (!process.env.GOOGLE_API_KEY) {
        console.error("Error: GOOGLE_API_KEY environment variable is not set");
        console.log("Please create a .env file with your Google API key");
        process.exit(1);
    }

    // Initialize models
    const llm = initChatModel();
    const embeddings = initEmbeddingModel();

    // Load and process product data
    console.log("Loading product catalog data...");
    const vectorStore = await loadData(embeddings);

    // Create retrieve tool
    const retrieveTool = createRetrieveTool(vectorStore);

    // Create stateful agent
    console.log("Creating product chatbot agent...");
    const agentData = createStatefulAgent(llm, [retrieveTool]);
    agent = agentData.agent;
    checkpointer = agentData.checkpointer;

    console.log("Product chatbot initialization complete!");
}

// Chat API endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Tin nhắn không được để trống" });
        }

        const userId = sessionId || "default-user";

        // Get or create thread ID for this user
        if (!threadMap.has(userId)) {
            threadMap.set(userId, `thread-${Date.now()}-${userId}`);
        }

        const threadId = threadMap.get(userId)!;
        const config = getThreadConfig(threadId);

        console.log(`[Chat API] Xử lý tin nhắn từ người dùng '${userId}': "${message}"`);

        // Invoke agent with message
        const startTime = Date.now();
        const result = await agent.invoke(
            { messages: [new HumanMessage(message)] },
            config
        );
        const processingTime = Date.now() - startTime;

        // Phân tích trạng thái agent chi tiết hơn
        let status = "complete";
        let toolsUsed = [];

        // Kiểm tra các tin nhắn để xác định công cụ nào được sử dụng
        for (const msg of result.messages) {
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                status = "processing";
                toolsUsed = msg.tool_calls.map((tool: any) => tool.name || "unknown_tool");

                if (toolsUsed.includes("retrieve")) {
                    status = "retrieving";
                    console.log("[Product Agent] Đang tìm kiếm thông tin sản phẩm");
                }
            } else if (msg.functionCall && Object.keys(msg.functionCall).length > 0) {
                status = "processing";
                const toolName = msg.functionCall.name || "unknown_function";
                toolsUsed.push(toolName);

                if (toolName === "retrieve") {
                    status = "retrieving";
                    console.log("[Product Agent] Đang tìm kiếm thông tin sản phẩm");
                }
            }
        }

        // Extract AI message content
        const aiMessageIndex = result.messages.length - 1;
        const aiMessage = result.messages[aiMessageIndex].content;

        let structuredResponse;
        if (typeof aiMessage === 'object' && aiMessage !== null) {
            structuredResponse = aiMessage;
        } else {
            structuredResponse = { answer: aiMessage, response_type: 'general_info' };
        }

        console.log(`[Chat API] Hoàn thành xử lý tin nhắn (${processingTime}ms), trạng thái: ${status}`);

        res.json({
            response: structuredResponse,
            sessionId: userId,
            status,
            toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            processingTime
        });
    } catch (error: any) {
        console.error("Lỗi xử lý tin nhắn:", error);

        // Chi tiết lỗi cho debug
        const errorDetails = {
            message: error.message || "Lỗi không xác định",
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
            name: error.name,
            code: error.code
        };

        console.error("Chi tiết lỗi:", JSON.stringify(errorDetails, null, 2));

        res.status(500).json({
            error: "Không thể xử lý tin nhắn của bạn",
            errorMessage: error.message || "Đã xảy ra lỗi không xác định",
            suggestion: "Vui lòng thử lại sau hoặc liên hệ hỗ trợ"
        });
    }
});

// Structured LLM output endpoint (không qua agent)
app.post("/api/structured-chat", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Tin nhắn không được để trống" });
        }
        const llm = initChatModel();
        const structuredLLM = llm.withStructuredOutput(ChatbotResponse);
        const result = await structuredLLM.invoke(message);
        res.json({ response: result });
    } catch (error: any) {
        console.error("Lỗi xử lý structured LLM:", error);
        res.status(500).json({
            error: "Không thể xử lý structured LLM",
            errorMessage: error.message || "Đã xảy ra lỗi không xác định"
        });
    }
});

// Serve frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/index.html"));
});

export default app; 