import express from "express";
import cors from "cors";
import path from "path";
import { HumanMessage } from "@langchain/core/messages";
import { initChatModel, initEmbeddingModel } from "./models";
import { loadData } from "./data-processor";
import { createRetrieveTool } from "./tools";
import { createStatefulAgent, getThreadConfig } from "./agent";
import { createCommentModerationAgent } from "./moderation/agent";

const app = express();

// Global vars for agents
let agent: any;
let checkpointer: any;
let moderationAgent: any;
const threadMap = new Map<string, string>();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// Initialize the agents
export async function initializeAgents() {
    console.log("Initializing agents...");

    // Check for API keys
    if (!process.env.GOOGLE_API_KEY || !process.env.TAVILY_API_KEY) {
        console.error("Error: GOOGLE_API_KEY or TAVILY_API_KEY environment variable is not set");
        console.log("Please create a .env file with your Google and Tavily API keys");
        process.exit(1);
    }

    // --- Initialize Product Chatbot Agent ---
    console.log("Initializing Product Information Chatbot with LangGraph...");
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

    // --- Initialize Comment Moderation Agent ---
    console.log("Creating comment moderation agent...");
    moderationAgent = createCommentModerationAgent({
        googleApiKey: process.env.GOOGLE_API_KEY,
        tavilyApiKey: process.env.TAVILY_API_KEY,
    });
    console.log("Comment moderation agent initialization complete!");
}

// Helper function to extract JSON from code blocks if needed
function extractJsonFromMessage(content: string): any | null {
    if (!content || typeof content !== 'string') {
        return null;
    }

    // First, try to extract from a markdown code block
    const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
    const match = content.match(jsonRegex);

    let jsonString = content;
    if (match && match[1]) {
        jsonString = match[1];
    }

    // Now, try to parse the result (either the extracted block or the original string)
    try {
        const parsedJson = JSON.parse(jsonString);
        if (!parsedJson.response_type) {
            console.error("AI response was parsed as JSON but missing required 'response_type' property. Sending fallback message.");
            return null;
        }
        return parsedJson;
    } catch (e) {
        const error = e as Error;
        // Log the specific error for debugging
        console.warn(`Failed to parse content as JSON: ${error.message}`);
        // Return null to indicate a failure that the caller should handle
        return null;
    }
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
        let toolsUsed: string[] = [];

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

        // Extract AI message content from the last message
        const aiMessageIndex = result.messages.length - 1;
        const aiMessage = result.messages[aiMessageIndex].content;

        // Get the structured response directly
        let responseData;

        if (typeof aiMessage === 'string') {
            // Extract JSON if it's wrapped in code blocks or is already JSON
            responseData = extractJsonFromMessage(aiMessage);

            if (!responseData) {
                console.error("Failed to parse AI response into JSON. Sending fallback message.");
                responseData = {
                    answer: "Oh oh, tôi đói bụng quá nên lỡ ăn mất câu trả lời rồi. Bạn hỏi lại được hông!",
                    response_type: 'no_info',
                };
            } else if (!responseData.response_type) {
                // Trường hợp thêm: JSON hợp lệ nhưng thiếu thuộc tính response_type
                console.error("AI response was parsed as JSON but missing required 'response_type' property. Sending fallback message.");
                responseData = {
                    answer: "Oh oh, tôi đói bụng quá nên lỡ ăn mất câu trả lời rồi. Bạn hỏi lại được hông!",
                    response_type: 'no_info',
                };
            }
        } else if (typeof aiMessage === 'object' && aiMessage !== null) {
            // If it's already an object, use it directly
            responseData = aiMessage;

            // Kiểm tra nếu đối tượng không có response_type
            if (!responseData.response_type) {
                console.error("AI response object is missing required 'response_type' property. Sending fallback message.");
                responseData = {
                    answer: "Oh oh, tôi đói bụng quá nên lỡ ăn mất câu trả lời rồi. Bạn hỏi lại được hông!",
                    response_type: 'no_info',
                };
            }
        } else {
            // Fallback for any other type
            responseData = {
                answer: String(aiMessage),
                response_type: 'general_info'
            };
        }

        console.log(`[Chat API] Hoàn thành xử lý tin nhắn (${processingTime}ms), trạng thái: ${status}`);

        // Create response with metadata
        const responseWithMeta = {
            ...responseData,
            _meta: {
                sessionId: userId,
                processingTime,
                toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
                status
            }
        };

        res.json(responseWithMeta);
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

// Comment Moderation API endpoint
app.post("/api/moderate", async (req, res) => {
    try {
        const { comment } = req.body;

        if (!comment || typeof comment !== 'string') {
            return res.status(400).json({ error: "Trường 'comment' là bắt buộc và phải là một chuỗi" });
        }

        if (!moderationAgent) {
            console.error("Moderation agent not initialized");
            return res.status(503).json({ error: "Dịch vụ kiểm duyệt chưa sẵn sàng, vui lòng thử lại sau" });
        }

        console.log(`[Moderation API] Nhận yêu cầu kiểm duyệt cho bình luận: "${comment}"`);
        const startTime = Date.now();

        const result = await moderationAgent.moderateComment(comment);

        const processingTime = Date.now() - startTime;
        console.log(`[Moderation API] Hoàn thành kiểm duyệt (${processingTime}ms)`);

        res.json({
            ...result,
            _meta: {
                processingTime,
            }
        });

    } catch (error: any) {
        console.error("Lỗi xử lý kiểm duyệt bình luận:", error);
        res.status(500).json({
            error: "Không thể xử lý yêu cầu kiểm duyệt của bạn",
            errorMessage: error.message || "Đã xảy ra lỗi không xác định",
        });
    }
});

// Serve frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/index.html"));
});

export default app; 