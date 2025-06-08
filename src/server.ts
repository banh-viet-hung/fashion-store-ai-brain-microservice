import express from "express";
import cors from "cors";
import path from "path";
import { HumanMessage } from "@langchain/core/messages";
import { initChatModel, initEmbeddingModel } from "./models";
import { loadData } from "./data-processor";
import { createRetrieveTool } from "./tools";
import { createStatefulAgent, getThreadConfig } from "./agent";

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
            return res.status(400).json({ error: "Message is required" });
        }

        const userId = sessionId || "default-user";
        console.log(`[Request] User ${userId}: "${message}"`);

        // Get or create thread ID for this user
        if (!threadMap.has(userId)) {
            threadMap.set(userId, `thread-${Date.now()}-${userId}`);
            console.log(`Created new thread for user ${userId}: ${threadMap.get(userId)}`);
        }

        const threadId = threadMap.get(userId)!;
        const config = getThreadConfig(threadId);

        // Invoke agent with message
        console.log(`[Agent] Processing message with thread: ${threadId}`);
        const result = await agent.invoke(
            { messages: [new HumanMessage(message)] },
            config
        );

        // Extract all agent messages to analyze agent behavior
        const agentMessages = result.messages;

        // Check tool usage for better status reporting
        let status = "complete";
        let toolCalls = 0;

        for (const msg of agentMessages) {
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                toolCalls++;
                // If the last message contains tool calls, it means the agent is still retrieving
                if (msg === agentMessages[agentMessages.length - 1]) {
                    status = "retrieving";
                    console.log("[Product Agent] Using tools:", JSON.stringify(msg.tool_calls));
                }
            } else if (msg.functionCall && Object.keys(msg.functionCall).length > 0) {
                toolCalls++;
                // If the last message contains function calls, it means the agent is still retrieving
                if (msg === agentMessages[agentMessages.length - 1]) {
                    status = "retrieving";
                    console.log("[Product Agent] Using function:", JSON.stringify(msg.functionCall));
                }
            }
        }

        // Extract AI message content
        const aiMessageIndex = result.messages.length - 1;
        const aiMessage = result.messages[aiMessageIndex].content;

        // Log tool usage statistics for debugging
        console.log(`[Agent Stats] Used ${toolCalls} tool calls for query: "${message}"`);
        console.log(`[Response] Status: ${status}, Length: ${aiMessage.length} chars`);

        res.json({
            response: aiMessage,
            sessionId: userId,
            status
        });
    } catch (error: any) {
        console.error("Error processing chat:", error);
        res.status(500).json({
            error: "Failed to process message",
            details: error.message || "Unknown error"
        });
    }
});

// Serve frontend
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/index.html"));
});

export default app; 