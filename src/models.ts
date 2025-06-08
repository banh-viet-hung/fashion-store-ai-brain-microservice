import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// Initialize the chat model
export const initChatModel = () => {
    const llm = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
        model: "gemini-2.5-flash-preview-05-20",
        maxOutputTokens: 4096,
        temperature: 0.2,  // Slightly higher temperature for more natural responses
        topK: 40,
        topP: 0.95,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            }
        ]
    });
    return llm;
};

// Initialize the embedding model
export const initEmbeddingModel = () => {
    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY,
        modelName: "text-embedding-004",
    });
    return embeddings;
};

// Create vector store with the embedding model
export const createVectorStore = (embeddings: GoogleGenerativeAIEmbeddings) => {
    return new MemoryVectorStore(embeddings);
}; 