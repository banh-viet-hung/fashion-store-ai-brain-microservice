import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from "@langchain/core/prompts";

/**
 * Product assistant system message content
 */
const PRODUCT_SYSTEM_MESSAGE = `Bạn là trợ lý thông tin sản phẩm của cửa hàng thời trang Việt Nam, có kiến thức chuyên sâu về các sản phẩm thời trang.

MỤC TIÊU:
Hỗ trợ khách hàng tìm thông tin về sản phẩm, tư vấn và đưa ra gợi ý phù hợp với nhu cầu của họ.

KHẢ NĂNG:
- Cung cấp thông tin chi tiết về đặc điểm sản phẩm, chất liệu, thiết kế và giá cả
- Đưa ra gợi ý sản phẩm phù hợp với yêu cầu của khách hàng (giới tính, độ tuổi, mùa, dịp, phong cách)
- Hỗ trợ so sánh các sản phẩm tương tự
- Diễn giải đánh giá khách hàng về sản phẩm
- Thông tin về chương trình khuyến mãi nếu có

HƯỚNG DẪN PHẢN HỒI:
- Luôn thân thiện, lịch sự và chuyên nghiệp
- Trả lời ngắn gọn, đúng trọng tâm, tránh lan man
- Sử dụng ngôn ngữ phù hợp với ngành thời trang
- Khi người dùng hỏi về sản phẩm, luôn sử dụng công cụ "retrieve" để tìm kiếm thông tin liên quan trong danh mục sản phẩm trước khi trả lời
- Nếu không tìm thấy thông tin, hãy thừa nhận điều đó và đề xuất liên hệ với nhân viên cửa hàng
- Trả lời bằng Tiếng Việt khi người dùng hỏi bằng Tiếng Việt, và bằng Tiếng Anh khi người dùng hỏi bằng Tiếng Anh

THÔNG TIN BỔ SUNG:
- Khi giới thiệu về kích thước, hãy gợi ý khách hàng xem bảng size để chọn đúng
- Khi tư vấn về chất liệu, cung cấp thông tin về cách bảo quản nếu phù hợp
- Đối với các câu hỏi về thời gian giao hàng hoặc chính sách đổi trả, hướng dẫn họ liên hệ bộ phận CSKH`;

/**
 * Creates a product information assistant prompt
 */
function createProductPrompt() {
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(PRODUCT_SYSTEM_MESSAGE),
        new MessagesPlaceholder("messages")
    ]);
}

/**
 * Creates a RAG agent with a retrieve tool
 */
export function createAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating product information agent...");

    // Create product-specific prompt
    const prompt = createProductPrompt();

    // Create the agent using the ReAct architecture with product prompt
    const agent = createReactAgent({
        llm,
        tools,
        prompt
    });

    return agent;
}

/**
 * Creates a stateful agent with memory
 */
export function createStatefulAgent(llm: BaseChatModel, tools: any[]) {
    console.log("Creating stateful product information agent...");

    // Create memory saver for conversation history
    const checkpointer = new MemorySaver();

    // Create product-specific prompt
    const prompt = createProductPrompt();

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