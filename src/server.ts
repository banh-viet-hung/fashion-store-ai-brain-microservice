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
    console.log("Initializing RAG Agent with LangGraph...");

    // Check if API key is set
    if (!process.env.GOOGLE_API_KEY) {
        console.error("Error: GOOGLE_API_KEY environment variable is not set");
        console.log("Please create a .env file with your Google API key");
        process.exit(1);
    }

    // Initialize models
    const llm = initChatModel();
    const embeddings = initEmbeddingModel();

    // Load and process data
    console.log("Loading data...");
    const vectorStore = await loadData(embeddings);

    // Create retrieve tool
    const retrieveTool = createRetrieveTool(vectorStore);

    // Create stateful agent
    console.log("Creating agent...");
    const agentData = createStatefulAgent(llm, [retrieveTool]);
    agent = agentData.agent;
    checkpointer = agentData.checkpointer;

    console.log("Agent initialization complete!");
}

// Chat API endpoint
app.post("/api/chat", async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const userId = sessionId || "default-user";

        // Get or create thread ID for this user
        if (!threadMap.has(userId)) {
            threadMap.set(userId, `thread-${Date.now()}-${userId}`);
        }

        const threadId = threadMap.get(userId)!;
        const config = getThreadConfig(threadId);

        // Invoke agent with message
        const result = await agent.invoke(
            { messages: [new HumanMessage(message)] },
            config
        );

        // Extract AI message content
        const aiMessageIndex = result.messages.length - 1;
        const aiMessage = result.messages[aiMessageIndex].content;

        res.json({
            response: aiMessage,
            sessionId: userId
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