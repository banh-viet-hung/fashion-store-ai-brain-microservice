import "dotenv/config";
import { HumanMessage } from "@langchain/core/messages";
import { initChatModel, initEmbeddingModel } from "./models";
import { loadData } from "./data-processor";
import { createRetrieveTool } from "./tools";
import { createAgent, createStatefulAgent, getThreadConfig } from "./agent";

async function main() {
    console.log("Starting RAG Agent with LangGraph...");

    // Check if API key is set
    if (!process.env.GOOGLE_API_KEY) {
        console.error("Error: GOOGLE_API_KEY environment variable is not set");
        console.log("Please create a .env file with your Google API key");
        process.exit(1);
    }

    try {
        // Initialize models
        const llm = initChatModel();
        const embeddings = initEmbeddingModel();

        // Load and process data
        console.log("Loading data...");
        const vectorStore = await loadData(embeddings);

        // Create retrieve tool
        const retrieveTool = createRetrieveTool(vectorStore);

        // Create agent
        console.log("Creating agent...");
        const { agent, checkpointer } = createStatefulAgent(llm, [retrieveTool]);

        // Create thread config for conversation
        const threadId = "example-thread-123";
        const config = getThreadConfig(threadId);

        // Example 1: Simple greeting
        console.log("\n--- Example 1: Simple greeting ---");
        const greetingResult = await agent.invoke(
            { messages: [new HumanMessage("Hello")] },
            config
        );
        console.log("Response:", greetingResult);

        // Example 2: Question requiring retrieval
        console.log("\n--- Example 2: Question requiring retrieval ---");
        const questionResult = await agent.invoke(
            { messages: [new HumanMessage("What is Task Decomposition?")] },
            config
        );
        console.log("Response:", questionResult);

        // Example 3: Follow-up question using history
        console.log("\n--- Example 3: Follow-up question ---");
        const followUpResult = await agent.invoke(
            { messages: [new HumanMessage("Can you look up some common ways of doing it?")] },
            config
        );
        console.log("Response:", followUpResult);

        // Example 4: Complex multi-step query
        console.log("\n--- Example 4: Complex multi-step query ---");
        const complexResult = await agent.invoke(
            { messages: [new HumanMessage("What is the standard method for Task Decomposition? Once you get the answer, look up common extensions of that method.")] },
            config
        );
        console.log("Response:", complexResult);

    } catch (error) {
        console.error("Error:", error);
    }
}

main().catch(console.error); 