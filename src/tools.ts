import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

/**
 * Creates a retrieval tool that can be used by the Agent
 */
export function createRetrieveTool(vectorStore: MemoryVectorStore) {
    const retrieveSchema = z.object({ query: z.string() });

    const retrieve = tool(
        async ({ query }) => {
            console.log(`Retrieving product information for query: "${query}"`);

            // Increase the number of returned documents for better context
            const retrievedDocs = await vectorStore.similaritySearch(query, 4);

            if (retrievedDocs.length === 0) {
                return "No relevant product information found. Please try a different query or check if product PDF files have been loaded.";
            }

            // Group content by source document
            const groupedBySource: Record<string, string[]> = {};

            retrievedDocs.forEach(doc => {
                const source = doc.metadata.source || "Unknown Source";
                if (!groupedBySource[source]) {
                    groupedBySource[source] = [];
                }
                groupedBySource[source].push(doc.pageContent);
            });

            // Format the output for better readability
            const formattedResults = Object.entries(groupedBySource)
                .map(([source, contents]) => {
                    return `Product Catalog: ${source}\n\nInformation:\n${contents.join('\n---\n')}`;
                })
                .join('\n\n' + '-'.repeat(40) + '\n\n');

            return formattedResults;
        },
        {
            name: "retrieve",
            description: "Retrieves product information related to a query.",
            schema: retrieveSchema,
        }
    );

    return retrieve;
} 