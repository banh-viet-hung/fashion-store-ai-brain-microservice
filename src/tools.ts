import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

/**
 * Creates a retrieval tool that can be used by the Agent
 */
export function createRetrieveTool(vectorStore: MemoryVectorStore) {
    const retrieveSchema = z.object({
        query: z.string().describe("The user's query about product information"),
    });

    const retrieve = tool(
        async ({ query }) => {
            console.log(`Retrieving product information for query: "${query}"`);

            // Increase the number of returned documents for better context
            const retrievedDocs = await vectorStore.similaritySearch(query, 6);

            if (retrievedDocs.length === 0) {
                return "No relevant product information found. Please try a different query or check if product PDF files have been loaded.";
            }

            // Group content by source document
            const groupedBySource: Record<string, string[]> = {};

            retrievedDocs.forEach(doc => {
                const source = doc.metadata.source || "Unknown Source";
                // Include page number if available
                const pageInfo = doc.metadata.page ? ` (Page ${doc.metadata.page})` : "";
                const sourceWithPage = source + pageInfo;

                if (!groupedBySource[sourceWithPage]) {
                    groupedBySource[sourceWithPage] = [];
                }
                groupedBySource[sourceWithPage].push(doc.pageContent);
            });

            // Format the output for better readability
            const formattedResults = Object.entries(groupedBySource)
                .map(([source, contents]) => {
                    return `Source: ${source}\n\nInformation:\n${contents.join('\n---\n')}`;
                })
                .join('\n\n' + '-'.repeat(40) + '\n\n');

            // Add search summary for better context
            const searchSummary = `Found ${retrievedDocs.length} relevant sections from ${Object.keys(groupedBySource).length} sources for query: "${query}".\n\n`;

            return searchSummary + formattedResults;
        },
        {
            name: "retrieve",
            description: "Retrieves detailed product information related to a user query from the product catalog. Use this tool for ANY product-related questions to ensure accurate information.",
            schema: retrieveSchema,
        }
    );

    return retrieve;
} 