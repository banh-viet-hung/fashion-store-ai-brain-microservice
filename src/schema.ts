import { z } from "zod";

// Schema cho thông tin sản phẩm
const ProductInfo = z.object({
    id: z.number({
        required_error: "ID sản phẩm là bắt buộc và phải là số",
        invalid_type_error: "ID phải là số, không được là string hoặc kiểu dữ liệu khác"
    }).int().positive().describe("ID duy nhất của sản phẩm PHẢI được lấy từ công cụ retrieve (PHẢI CHÍNH XÁC LÀ ID THỰC SỰ CỦA SẢN PHẨM ĐƯỢC LẤY TỪ CÔNG CỤ RETRIEVE CHỨ KHÔNG ĐƯỢC BỊA RA HOẶC LẤY TÊN SẢN PHẨM LÀM ID)"),
    name: z.string().describe("Tên sản phẩm"),
    price: z.number().optional().describe("Giá sản phẩm (VND)"),
    sale_price: z.number().optional().describe("Giá khuyến mãi sản phẩm (VND)"),
    description: z.string().optional().describe("Mô tả ngắn sản phẩm"),
});

// Schema cho các hành động được đề xuất
const SuggestedAction = z.object({
    type: z.enum(["link", "quick_reply"]).describe("Loại hành động"),
    text: z.string().describe("Văn bản hiển thị trên nút/link để người dùng chọn"),
    value: z.string().describe("Giá trị được xử lý khi người dùng nhấn (URL, hoặc câu trả lời)"),
});

// Schema chính cho response
export const ChatbotResponse = z.object({
    // Nội dung trả lời chính
    answer: z.string().describe("Câu trả lời chính cho người dùng (hỗ trợ Markdown)"),

    // Loại phản hồi để UI xử lý phù hợp
    response_type: z.enum([
        "product_detail",      // Trả lời về sản phẩm cụ thể
        "product_list",        // Danh sách nhiều sản phẩm
        "general_info",        // Thông tin chung về dịch vụ/công ty
        "no_info",            // Không có thông tin
        "greeting",           // Chào hỏi
        "clarification",      // Yêu cầu làm rõ
        "order_support",      // Hỗ trợ đơn hàng
        "technical_support"   // Hỗ trợ kỹ thuật
    ]).describe("Loại phản hồi để UI xử lý phù hợp"),

    // Thông tin sản phẩm liên quan
    related_products: z.array(ProductInfo).optional().describe("Danh sách sản phẩm liên quan"),

    // Câu hỏi tiếp theo được đề xuất
    followup_questions: z.array(z.string()).optional().describe("Các câu hỏi mà AGENT muốn hỏi người dùng để thu thập thêm thông tin hoặc làm rõ yêu cầu"),

    // Các hành động được đề xuất
    suggested_actions: z.array(SuggestedAction).optional().describe("Các nút/hành động được gợi ý cho NGƯỜI DÙNG, trong đó quick_reply là các câu trả lời gợi ý cho các câu hỏi trong followup_questions"),

    // Cần chuyển sang nhân viên hỗ trợ
    escalate_to_human: z.boolean().optional().describe("Có cần chuyển sang nhân viên hỗ trợ không"),

    // Metadata bổ sung
    metadata: z.object({
        confidence_score: z.number().min(0).max(1).optional().describe("Độ tin cậy của câu trả lời"),
        search_keywords: z.array(z.string()).optional().describe("Từ khóa đã tìm kiếm"),
        category: z.string().optional().describe("Danh mục sản phẩm/dịch vụ liên quan")
    }).optional()
});