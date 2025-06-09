import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

/**
 * Creates a retrieval tool that can be used by the Agent
 */
export function createRetrieveTool(vectorStore: MemoryVectorStore) {
    const retrieveSchema = z.object({ query: z.string() });

    const retrieve = tool(
        async ({ query }) => {
            console.log(`Original query: "${query}"`);

            // Agent to generate a better query
            const llm = new ChatGoogleGenerativeAI({
                model: "gemini-2.5-flash-preview-05-20",
                temperature: 0,
            });

            const queryExpansionPrompt = ChatPromptTemplate.fromMessages([
                [
                    "system",
                    `You are a helpful AI assistant for a fashion store. Your task is to expand a user's search query to be more comprehensive for a vector database search.
Expand the given query into a comma-separated list of related search terms that are likely to appear in a product catalog.
For example:
- user: "jacket"
- assistant: "men's jacket, women's jacket, winter jacket, leather jacket, denim jacket"
- user: "áo khoác"
- assistant: "áo khoác nam, áo khoác nữ, áo phao, áo khoác da, áo khoác bò"
Return only the expanded query terms, separated by commas. Do not add any introductory text.`,
                ],
                ["human", "{query}"],
            ]);

            const queryExpansionChain = queryExpansionPrompt.pipe(llm);
            const expandedQueryResponse = await queryExpansionChain.invoke({
                query,
            });
            const expandedQuery = expandedQueryResponse.content.toString();

            const finalQuery = `${query}, ${expandedQuery}`;
            console.log(`Expanded search query: "${finalQuery}"`);

            const retrievedDocs = await vectorStore.similaritySearch(
                finalQuery,
                100
            );

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