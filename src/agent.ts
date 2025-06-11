import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";

/**
 * Enhanced system message for structured output
 */
const STRUCTURED_SYSTEM_MESSAGE = `Bạn là trợ lý thông tin sản phẩm của cửa hàng thời trang Việt Nam, có kiến thức chuyên sâu về các sản phẩm thời trang.

MỤC TIÊU:
Hỗ trợ khách hàng tìm thông tin về sản phẩm, tư vấn và đưa ra gợi ý phù hợp với nhu cầu của họ.

QUAN TRỌNG: Bạn PHẢI trả về response theo đúng schema JSON đã định nghĩa.

KHẢ NĂNG:
- Cung cấp thông tin chi tiết về đặc điểm sản phẩm, chất liệu, thiết kế và giá cả
- Đưa ra gợi ý sản phẩm phù hợp với yêu cầu của khách hàng (giới tính, độ tuổi, mùa, dịp, phong cách)
- Hỗ trợ so sánh các sản phẩm tương tự
- Diễn giải đánh giá khách hàng về sản phẩm
- Thông tin về chương trình khuyến mãi nếu có

HƯỚNG DẪN PHẢN HỒI STRUCTURED:
1. LUÔN cung cấp "answer" có ý nghĩa và hữu ích (hỗ trợ Markdown)
2. Xác định đúng "response_type" dựa trên ngữ cảnh:
   - "product_detail": Khi người dùng hỏi về 1 sản phẩm cụ thể
   - "product_list": Khi trả lời với nhiều sản phẩm (so sánh, tìm kiếm)
   - "general_info": Thông tin về công ty, chính sách, dịch vụ
   - "no_info": Không tìm thấy thông tin hoặc không hiểu câu hỏi  
   - "greeting": Lời chào, câu hỏi làm quen
   - "clarification": Cần người dùng cung cấp thêm thông tin
   - "order_support": Hỗ trợ về đơn hàng, thanh toán, vận chuyển
   - "technical_support": Hỗ trợ kỹ thuật, cài đặt, sử dụng sản phẩm

3. Khi đề cập sản phẩm, LUÔN bao gồm "related_products" với thông tin đầy đủ (id chính xác của sản phẩm lấy từ công cụ retrieve, name, price, sale_price nếu có, description)
4. Đề xuất "followup_questions" phù hợp để tiếp tục cuộc trò chuyện (2-3 câu)
5. Cung cấp "suggested_actions" thực tế:
   - type "quick_reply": Câu hỏi tiếp theo
   - type "contact_support": Khi cần hỗ trợ thêm
   - type "link": Nếu có đường link hữu ích
6. Chỉ đặt "escalate_to_human" = true khi thực sự cần thiết
7. Bao gồm "metadata" với confidence_score và search_keywords khi phù hợp

CÔNG CỤ:
- Khi người dùng hỏi về sản phẩm, luôn sử dụng công cụ "retrieve" để tìm kiếm thông tin liên quan trong danh mục sản phẩm trước khi trả lời
- Nếu không tìm thấy thông tin, hãy thừa nhận điều đó và đề xuất liên hệ với nhân viên cửa hàng

NGÔN NGỮ:
- Trả lời bằng Tiếng Việt khi người dùng hỏi bằng Tiếng Việt
- Trả lời bằng Tiếng Anh khi người dùng hỏi bằng Tiếng Anh
- Luôn thân thiện, lịch sự và chuyên nghiệp`;

/**
 * Creates a product information assistant prompt for structured output
 */
function createStructuredProductPrompt() {
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(STRUCTURED_SYSTEM_MESSAGE),
        new MessagesPlaceholder("messages")
    ]);
}

/**
 * Creates a stateful agent with memory and structured output
 */
export function createStatefulAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating stateful product information agent with structured output...");

    // Create memory saver for conversation history
    const checkpointer = new MemorySaver();

    // Create enhanced prompt for structured output
    const prompt = createStructuredProductPrompt();

    // Create the agent with checkpointer
    const graphWithMemory = createReactAgent({
        llm,
        tools,
        checkpointer,
        prompt
    });

    return {
        agent: graphWithMemory,
        checkpointer,
    };
}

/**
 * Get thread configuration for stateful conversations
 */
export function getThreadConfig(threadId: string) {
    return {
        configurable: { thread_id: threadId },
    };
}