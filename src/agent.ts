import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Creates a RAG agent with a retrieve tool
 */
export function createAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating RAG agent...");

    // Create the agent using the ReAct architecture
    const agent = createReactAgent({
        llm,
        tools,
    });

    return agent;
}

/**
 * Creates a stateful agent with memory
 */
export function createStatefulAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating stateful RAG agent...");

    // Create memory saver for conversation history
    const checkpointer = new MemorySaver();

    // Create the agent with checkpointer
    const graphWithMemory = createReactAgent({
        llm,
        tools,
        checkpointer
    });

    return {
        agent: graphWithMemory,
        checkpointer,
    };
}

/**
 * Get thread configuration for stateful conversations
 */
export function getThreadConfig(threadId: string) {
    return {
        configurable: { thread_id: threadId },
    };
} 