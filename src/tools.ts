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
            console.log(`Retrieving documents for query: "${query}"`);

            const retrievedDocs = await vectorStore.similaritySearch(query, 2);

            const serialized = retrievedDocs
                .map(doc => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`)
                .join("\n\n");

            return serialized;
        },
        {
            name: "retrieve",
            description: "Retrieves information related to a query.",
            schema: retrieveSchema,
        }
    );

    return retrieve;
} 