import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";

/**
 * Product assistant system message content
 */
const PRODUCT_SYSTEM_MESSAGE = `You are a helpful product information assistant for a fashion store. 
You help customers find information about products, answer questions about specifications, 
pricing, availability, and provide helpful recommendations based on their needs.

Always be polite, helpful, and direct. If you don't know the answer to a question, 
or if the information is not in the product catalog, admit that you don't know
and suggest that the customer contact customer service for more specific information.

When a user asks about a product, use the retrieve tool to look for relevant information
in the product catalog before responding.`;

/**
 * Creates a product information assistant prompt
 */
function createProductPrompt() {
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(PRODUCT_SYSTEM_MESSAGE),
        new MessagesPlaceholder("messages")
    ]);
}

/**
 * Creates a RAG agent with a retrieve tool
 */
export function createAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating product information agent...");

    // Create product-specific prompt
    const prompt = createProductPrompt();

    // Create the agent using the ReAct architecture with product prompt
    const agent = createReactAgent({
        llm,
        tools,
        prompt
    });

    return agent;
}

/**
 * Creates a stateful agent with memory
 */
export function createStatefulAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating stateful product information agent...");

    // Create memory saver for conversation history
    const checkpointer = new MemorySaver();

    // Create product-specific prompt
    const prompt = createProductPrompt();

    // Create the agent with checkpointer
    const graphWithMemory = createReactAgent({
        llm,
        tools,
        checkpointer,
        prompt
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