import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * Downloads and processes blog content for RAG
 */
export async function processLilianWengBlog(vectorStore: MemoryVectorStore) {
    console.log("Loading blog data from Lilian Weng...");

    // Load blog content using Cheerio
    const cheerioLoader = new CheerioWebBaseLoader(
        "https://lilianweng.github.io/posts/2023-06-23-agent/",
        { selector: "p" } // Only extract <p> tag content
    );

    const docs = await cheerioLoader.load();
    console.log(`Loaded ${docs.length} document(s)`);

    // Split documents into smaller chunks
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    const allSplits = await splitter.splitDocuments(docs);
    console.log(`Split into ${allSplits.length} chunks`);

    // Add to vector store
    await vectorStore.addDocuments(allSplits);
    console.log("Documents added to vector store");

    return vectorStore;
}

/**
 * Loads data into the vector store
 */
export async function loadData(embeddings: GoogleGenerativeAIEmbeddings) {
    // Create vector store
    const vectorStore = new MemoryVectorStore(embeddings);

    // Process blog data
    await processLilianWengBlog(vectorStore);

    return vectorStore;
} 