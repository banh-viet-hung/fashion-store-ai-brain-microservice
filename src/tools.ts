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
                    `Bạn là trợ lý AI chuyên về thời trang, đặc biệt là việc tối ưu hóa truy vấn tìm kiếm sản phẩm.

NHIỆM VỤ:
1. Đầu tiên, phân tích xem truy vấn có liên quan đến sản phẩm thời trang hay không:
   - Nếu là truy vấn về sản phẩm (áo, quần, giày dép, phụ kiện...): Tiến hành mở rộng truy vấn
   - Nếu là truy vấn khác (hỏi về chính sách, địa chỉ, giờ mở cửa...): Trả về chính xác truy vấn gốc, không mở rộng

2. Nếu là truy vấn về sản phẩm, mở rộng thành danh sách các từ khóa liên quan để tăng độ phủ khi tìm kiếm trong cơ sở dữ liệu vector. Kết quả cần bao gồm:

   a. Các biến thể ngôn ngữ (Tiếng Việt/Tiếng Anh)
   b. Các từ đồng nghĩa và từ liên quan chặt chẽ
   c. Phân loại theo giới tính (nam/nữ/unisex)
   d. Phân loại theo mùa/thời tiết
   e. Các chất liệu phổ biến
   f. Phong cách thiết kế
   g. Thương hiệu phổ biến (nếu phù hợp)

VÍ DỤ TRUY VẤN SẢN PHẨM:
- Truy vấn: "áo khoác"
  Kết quả: "áo khoác, jacket, áo khoác nam, áo khoác nữ, áo phao, áo khoác da, áo khoác bò, áo khoác dù, áo blazer, áo khoác gió, áo hoodie, áo khoác mùa đông, áo khoác nhẹ, áo cardigan, bomber jacket, overcoat"

- Truy vấn: "quần jean"
  Kết quả: "quần jean, quần bò, jeans, quần jeans nam, quần jeans nữ, quần jeans rách, quần jeans ống rộng, quần jeans ống suông, quần jeans skinny, quần jeans baggy, quần jeans lưng cao, quần denim, quần jeans trơn, quần jeans co giãn"

VÍ DỤ TRUY VẤN KHÔNG PHẢI SẢN PHẨM:
- Truy vấn: "cửa hàng mở cửa mấy giờ"
  Kết quả: "cửa hàng mở cửa mấy giờ"

- Truy vấn: "chính sách đổi trả hàng"
  Kết quả: "chính sách đổi trả hàng"

HƯỚNG DẪN:
- Đối với truy vấn sản phẩm: Trả về DANH SÁCH các từ khóa liên quan ngăn cách bằng dấu phẩy,
- Đối với truy vấn không phải sản phẩm: Trả về CHÍNH XÁC truy vấn gốc, không thêm từ khóa
- Ưu tiên các từ khóa tiếng Việt, sau đó thêm các từ tiếng Anh phổ biến
- Không thêm bất kỳ văn bản giải thích nào
- Số lượng từ khóa khoảng 10-20, tùy thuộc vào mức độ phổ biến của sản phẩm`,
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

            // Format products with their metadata
            const productDetails = retrievedDocs.map(doc => {
                // Extract essential metadata
                const { id, name, price, salePrice, description } = doc.metadata;

                // Create formatted product entry with explicit ID reference
                return {
                    product_info: doc.pageContent,
                    metadata: {
                        id: id,  // Explicitly include the numeric ID
                        name: name || "Unknown",
                        price: price,
                        sale_price: salePrice,
                        description: description || doc.pageContent.substring(0, 100)
                    }
                };
            });

            // Format the output with clear product IDs for the agent to use
            const formattedResults = `Retrieved ${productDetails.length} products:\n\n` +
                productDetails.map(product => {
                    return `PRODUCT ID: ${product.metadata.id}\nNAME: ${product.metadata.name}\nPRICE: ${product.metadata.price}\nSALE PRICE: ${product.metadata.sale_price}\nDETAILS: ${product.product_info}`;
                }).join('\n\n' + '-'.repeat(40) + '\n\n');

            // Add a reminder to use correct IDs
            return formattedResults + "\n\nIMPORTANT: When referring to these products in your response, ALWAYS use the exact numeric PRODUCT ID values shown above.";
        },
        {
            name: "retrieve",
            description: "Retrieves product information related to a query.",
            schema: retrieveSchema,
        }
    );

    return retrieve;
} 