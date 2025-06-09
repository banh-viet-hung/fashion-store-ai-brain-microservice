import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from "fs";
import path from "path";

/**
 * Loads and processes PDF files from a directory for product information
 */
export async function processProductPDFs(vectorStore: MemoryVectorStore, pdfDirectory: string = './product-pdfs') {
    console.log(`Loading product PDFs from ${pdfDirectory}...`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(pdfDirectory)) {
        fs.mkdirSync(pdfDirectory, { recursive: true });
        console.log(`Created directory ${pdfDirectory}`);
        console.log("Please add your product PDF files to this directory");
        return vectorStore;
    }

    // Get all PDF files in the directory
    const files = fs.readdirSync(pdfDirectory).filter(file => file.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
        console.log("No PDF files found in the directory. Please add your product PDF files.");
        return vectorStore;
    }

    console.log(`Found ${files.length} PDF file(s)`);

    // Process each PDF file
    let totalChunks = 0;
    for (const file of files) {
        const filePath = path.join(pdfDirectory, file);
        console.log(`Processing ${filePath}...`);

        try {
            // Load PDF file
            const loader = new PDFLoader(filePath);
            const docs = await loader.load();
            console.log(`Loaded ${docs.length} page(s) from ${file}`);

            // Split documents into smaller chunks
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            const splits = await splitter.splitDocuments(docs);
            console.log(`Split ${file} into ${splits.length} chunks`);
            totalChunks += splits.length;

            // Add metadata to identify the source file
            const enhancedSplits = splits.map(split => {
                split.metadata = {
                    ...split.metadata,
                    source: file,
                    documentType: 'product'
                };
                return split;
            });

            // Add to vector store
            await vectorStore.addDocuments(enhancedSplits);
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }

    console.log(`Total: ${totalChunks} chunks added to vector store from ${files.length} files`);
    return vectorStore;
}

/**
 * Loads data into the vector store
 */
export async function loadData(embeddings: GoogleGenerativeAIEmbeddings) {
    // Create vector store
    const vectorStore = new MemoryVectorStore(embeddings);

    // Process product PDF data
    await processProductPDFs(vectorStore);

    return vectorStore;
} 