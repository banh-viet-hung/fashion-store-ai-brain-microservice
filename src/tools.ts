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

            // 1. Increase the number of initial results to get a broader context
            const K = 50;
            const initialDocs = await vectorStore.similaritySearch(query, K);

            if (initialDocs.length === 0) {
                return "No relevant product information found. Please try a different query or check if product PDF files have been loaded.";
            }

            // 2. Re-rank the results based on relevance to the query keywords
            // This helps to filter out documents that are semantically similar but not directly relevant.
            const rerankedDocs = initialDocs.filter(doc =>
                doc.pageContent.toLowerCase().includes(query.toLowerCase())
            );

            // Use re-ranked docs if they exist, otherwise fall back to initial results
            const retrievedDocs = rerankedDocs.length > 0 ? rerankedDocs : initialDocs;

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