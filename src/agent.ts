import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";

/**
 * Product assistant system message content
 */
const PRODUCT_SYSTEM_MESSAGE = `You are an expert product information assistant for a fashion store. 
You help customers find detailed information about products, answer questions about specifications, 
pricing, availability, and provide helpful recommendations based on their needs.

IMPORTANT GUIDELINES:

1. ALWAYS use the retrieve tool for ANY product-related questions, even if you think you might know the answer.
   This ensures you provide accurate, up-to-date information from the product catalog.

2. CAREFULLY ANALYZE all retrieved information before answering. Focus on extracting precise details that 
   directly answer the user's question.

3. Be SPECIFIC and DETAILED in your responses. Include product codes, exact prices, available sizes/colors,
   and other concrete details whenever possible.

4. If a question is vague, try to understand the intent and provide the most relevant information.
   For unclear questions, ask clarifying questions to better understand what the user needs.

5. If multiple products match a query, summarize key differences to help the user decide.

6. If the information is not in the product catalog, clearly state that you don't have that specific 
   information rather than guessing. Suggest contacting customer service for more specific information.

7. When answering follow-up questions, remember to consider the full conversation context.

8. Use natural, conversational language while being concise and to the point.`;

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