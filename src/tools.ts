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
                    `Bạn là trợ lý AI chuyên về thời trang nam, đặc biệt là việc tối ưu hóa truy vấn tìm kiếm sản phẩm cho COOLMAN - thương hiệu thời trang nam hàng đầu Việt Nam.

NHIỆM VỤ:
1. Đầu tiên, phân tích xem truy vấn có liên quan đến sản phẩm thời trang nam của COOLMAN hay không:
   - Nếu là truy vấn về sản phẩm thời trang nam (áo, quần, giày dép, phụ kiện nam...): Tiến hành mở rộng truy vấn
   - Nếu là truy vấn khác (hỏi về chính sách, địa chỉ, giờ mở cửa...): Trả về chính xác truy vấn gốc, không mở rộng

2. Nếu là truy vấn về sản phẩm, mở rộng thành danh sách các từ khóa liên quan đến thời trang nam để tăng độ phủ khi tìm kiếm trong cơ sở dữ liệu. Kết quả cần bao gồm:

   a. Các biến thể ngôn ngữ (Tiếng Việt/Tiếng Anh)
   b. Các từ đồng nghĩa và từ liên quan chặt chẽ
   c. Các loại sản phẩm thời trang nam cụ thể
   d. Phân loại theo mùa/thời tiết phù hợp với nam giới
   e. Các chất liệu phổ biến trong thời trang nam
   f. Phong cách thiết kế đặc trưng cho nam giới (casual, formal, sporty, streetwear)
   g. Dịp sử dụng (công sở, dạo phố, tiệc, thể thao)

DANH MỤC SẢN PHẨM COOLMAN:
- Áo: sơ mi, thun, polo, khoác, vest, hoodie, sweater
- Quần: jeans, kaki, tây, shorts, jogger
- Giày dép nam: giày tây, giày thể thao, sandals, dép
- Phụ kiện: mũ nón, vớ tất, túi xách, thắt lưng, ví, đồng hồ
- Đồ lót: boxer, brief, tanktop

VÍ DỤ TRUY VẤN SẢN PHẨM:
- Truy vấn: "áo khoác"
  Kết quả: "áo khoác nam, jacket nam, áo khoác bomber nam, áo khoác denim nam, áo blazer nam, áo khoác gió nam, áo hoodie nam, áo khoác mùa đông nam, áo cardigan nam, áo khoác da nam, áo khoác jean nam, men's jacket, men's coat, áo khoác dạo phố nam, áo khoác công sở nam"

- Truy vấn: "quần jean"
  Kết quả: "quần jean nam, quần bò nam, jeans nam, quần jeans rách nam, quần jeans ống rộng nam, quần jeans ống suông nam, quần jeans skinny nam, quần jeans baggy nam, quần jeans lưng cao nam, quần denim nam, quần jeans trơn nam, quần jeans co giãn nam, men's jeans"

VÍ DỤ TRUY VẤN KHÔNG PHẢI SẢN PHẨM:
- Truy vấn: "cửa hàng COOLMAN mở cửa mấy giờ"
  Kết quả: "cửa hàng COOLMAN mở cửa mấy giờ"

- Truy vấn: "chính sách đổi trả COOLMAN"
  Kết quả: "chính sách đổi trả COOLMAN"

HƯỚNG DẪN:
- Đối với truy vấn sản phẩm thời trang nam: Trả về DANH SÁCH các từ khóa liên quan đến thời trang nam ngăn cách bằng dấu phẩy
- Đối với truy vấn không phải sản phẩm: Trả về CHÍNH XÁC truy vấn gốc, không thêm từ khóa
- Ưu tiên các từ khóa tiếng Việt, sau đó thêm các từ tiếng Anh phổ biến
- Nhớ rằng COOLMAN chỉ bán sản phẩm thời trang và phụ kiện dành cho NAM giới
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
                return "Không tìm thấy thông tin sản phẩm COOLMAN phù hợp với yêu cầu của bạn. Vui lòng thử với từ khóa khác hoặc liên hệ với đội ngũ COOLMAN để được hỗ trợ.";
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
                        name: name || "Chưa xác định",
                        price: price,
                        sale_price: salePrice,
                        description: description || doc.pageContent.substring(0, 100)
                    }
                };
            });

            // Format the output with clear product IDs for the agent to use
            const formattedResults = `Tìm thấy ${productDetails.length} sản phẩm COOLMAN phù hợp:\n\n` +
                productDetails.map(product => {
                    return `SẢN PHẨM ID: ${product.metadata.id}\nTÊN: ${product.metadata.name}\nGIÁ: ${product.metadata.price}\nGIÁ KHUYẾN MÃI: ${product.metadata.sale_price}\nCHI TIẾT: ${product.product_info}`;
                }).join('\n\n' + '-'.repeat(40) + '\n\n');

            // Add a reminder to use correct IDs
            return formattedResults + "\n\nLƯU Ý QUAN TRỌNG: Khi đề cập đến các sản phẩm COOLMAN trong phản hồi của bạn, LUÔN sử dụng chính xác các giá trị số ID SẢN PHẨM được hiển thị ở trên.";
        },
        {
            name: "retrieve",
            description: "Tìm kiếm thông tin sản phẩm thời trang nam COOLMAN liên quan đến yêu cầu.",
            schema: retrieveSchema,
        }
    );

    return retrieve;
} 