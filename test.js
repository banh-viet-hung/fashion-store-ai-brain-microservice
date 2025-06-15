import { StateGraph, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import "dotenv/config";

// State interface cho graph
class CommentModerationState {
    constructor() {
        this.comment = "";
        this.isObviouslyToxic = false;
        this.needsResearch = false;
        this.researchResults = "";
        this.finalResult = null;
        this.messages = [];
    }
}

// Tạo comment moderation agent
export async function createCommentModerationAgent(config = {}) {
    const {
        openaiApiKey,
        tavilyApiKey,
        model = "gemini-2.5-flash-preview-05-20",
        temperature = 0.1
    } = config;

    // Khởi tạo LLM
    const llm = new ChatGoogleGenerativeAI({
        apiKey: openaiApiKey,
        model: model,
        temperature: temperature,
        maxOutputTokens: 4096,
    });

    // Khởi tạo Tavily search tool
    const tavilyTool = new TavilySearchResults({
        apiKey: tavilyApiKey,
        maxResults: 5,
        searchDepth: "advanced"
    });

    // Template cho việc phân tích bình luận ban đầu
    const initialAnalysisPrompt = PromptTemplate.fromTemplate(`
Hãy phân tích bình luận sau đây của người dùng Việt Nam:

Bình luận: "{comment}"

Nhiệm vụ của bạn:
1. Phân tích ngữ điệu và giọng điệu của bình luận (châm biếm, giận dữ, vui vẻ, tiêu cực, v.v.)
2. Xác định xem bình luận này có RÕ RÀNG là độc hại, toxic, tiêu cực, phân biệt vùng miền hay không
3. Nếu rõ ràng là độc hại hoặc có giọng điệu tiêu cực rõ rệt → trả về "TOXIC"
4. Nếu có chứa tiếng lóng, viết tắt, từ mập mờ mà bạn không chắc chắn → trả về "NEEDS_RESEARCH"
5. Nếu bình thường, tích cực → trả về "SAFE"

Lưu ý đặc biệt về phân biệt vùng miền:
- Các từ như "backy", "bắc kỳ", "nam kỳ", hoặc bất kỳ biến thể nào của chúng thường mang tính phân biệt vùng miền
- Ngay cả khi câu có vẻ trung tính, việc sử dụng các từ này vẫn được xem là phân biệt vùng miền
- Nếu phát hiện các từ này, hãy trả về "TOXIC" ngay lập tức
- Cần nhạy cảm với các cách viết biến thể hoặc tiếng lóng ám chỉ các vùng miền

Lưu ý chung: 
- Đánh giá cả ngữ điệu của bình luận, không chỉ dựa vào từ ngữ đơn thuần
- Ngữ cảnh văn hóa của Việt Nam có thể ảnh hưởng đến cách diễn đạt

Chỉ trả về một từ: TOXIC, NEEDS_RESEARCH, hoặc SAFE

Phân tích:
`);

    // Template cho việc tạo query tìm kiếm
    const researchQueryPrompt = PromptTemplate.fromTemplate(`
Bình luận: "{comment}"

Trong bình luận này có các từ lóng/viết tắt cần tìm hiểu. Hãy xác định chính xác từng từ lóng hoặc viết tắt cần tìm hiểu.

Đặc biệt chú ý đến các từ có thể ám chỉ vùng miền hoặc nhóm người cụ thể, chẳng hạn:
- "backy" → có thể là cách viết khác của "Bắc Kỳ" (từ chỉ người miền Bắc, thường mang tính phân biệt)
- Các từ tương tự như "namky", "trungky" cũng cần được phân tích kỹ

Tạo một câu truy vấn ngắn gọn, tự nhiên để tìm hiểu ý nghĩa của từ đó. Ví dụ:
- Nếu có từ "vkl" → "vkl là gì trong tiếng lóng Việt Nam"
- Nếu có từ "backy" → "backy có phải là từ phân biệt vùng miền trong tiếng Việt"

Chỉ trả về câu truy vấn ngắn gọn, không giải thích:
`);

    // Template cho việc phân tích kết quả tìm kiếm
    const finalAnalysisPrompt = PromptTemplate.fromTemplate(`
Bình luận gốc: "{comment}"

Kết quả tìm kiếm về ý nghĩa các từ lóng/viết tắt:
{researchResults}

Dựa trên thông tin tìm được và cách phân tích ngữ điệu, giọng điệu của bình luận, hãy đánh giá bình luận này:

Các trường hợp CẦN ĐẶC BIỆT CHÚ Ý:

1. Phân biệt vùng miền:
   - Các từ như "backy", "bắc kỳ" hoặc bất kỳ cách viết biến thể nào LUÔN được coi là phân biệt vùng miền
   - Ngay cả khi câu nói có vẻ trung tính hoặc mang tính hỏi han, việc sử dụng những từ này vẫn là phân biệt vùng miền
   - Tương tự với "namky" (Nam Kỳ) và các biến thể khác

2. Tiếng lóng xúc phạm:
   - Ngay cả khi tiếng lóng được dùng như cách nói thông thường, nếu gốc của từ mang tính xúc phạm, vẫn cần đánh dấu là không an toàn

Trả về JSON với format chính xác như sau:
{{
  "pass": true/false,
  "reason": "lý do cụ thể nếu không pass, null nếu pass"
}}

Tiêu chí đánh giá:
- pass: false nếu bình luận có nội dung độc hại, toxic, xúc phạm, phân biệt vùng miền
- pass: false nếu bình luận có giọng điệu chế giễu, mỉa mai gây tổn thương
- pass: false nếu bình luận sử dụng các từ như "backy", "bắc kỳ" và các biến thể khác
- pass: true nếu bình luận bình thường, tích cực, hoặc từ lóng được dùng theo nghĩa tích cực/trung tính
- reason: giải thích chi tiết về đánh giá dựa trên ngữ điệu và từ ngữ (nếu không pass)
`);

    // Node: Phân tích ban đầu
    async function initialAnalysis(state) {
        console.log("🔍 Analyzing comment:", state.comment);

        // Kiểm tra nhanh các từ nhạy cảm về vùng miền
        const regionalTerms = ["backy", "bắc kỳ", "namky", "nam kỳ", "trungky", "trung kỳ"];

        // Kiểm tra không phân biệt hoa thường
        const lowerComment = state.comment.toLowerCase();
        const hasRegionalTerm = regionalTerms.some(term => lowerComment.includes(term.toLowerCase()));

        if (hasRegionalTerm) {
            console.log("⚠️ Detected regional discrimination term");
            state.isObviouslyToxic = true;
            state.finalResult = {
                pass: false,
                reason: "Bình luận có sử dụng từ ngữ mang tính phân biệt vùng miền"
            };
            return state;
        }

        const prompt = await initialAnalysisPrompt.format({ comment: state.comment });
        const result = await llm.invoke(prompt);
        const analysis = result.content.trim();

        console.log("📊 Initial analysis result:", analysis);

        if (analysis === "TOXIC") {
            state.isObviouslyToxic = true;
            state.finalResult = {
                pass: false,
                reason: "Bình luận chứa nội dung rõ ràng độc hại, toxic hoặc tiêu cực"
            };
        } else if (analysis === "NEEDS_RESEARCH") {
            state.needsResearch = true;
        } else {
            state.finalResult = {
                pass: true,
                reason: null
            };
        }

        return state;
    }

    // Node: Tìm kiếm thông tin
    async function researchSlang(state) {
        console.log("🔎 Researching slang/abbreviations...");

        // Tạo query tìm kiếm
        const queryPrompt = await researchQueryPrompt.format({ comment: state.comment });
        const queryResult = await llm.invoke(queryPrompt);
        const searchQuery = queryResult.content.trim();

        console.log("🔍 Search query:", searchQuery);

        try {
            // Thực hiện tìm kiếm
            const searchResults = await tavilyTool.invoke(searchQuery);
            state.researchResults = Array.isArray(searchResults)
                ? searchResults.map(r => r.content || r.snippet || '').join('\n\n')
                : searchResults.toString();

            console.log("📝 Research results obtained");
        } catch (error) {
            console.error("❌ Search error:", error);
            state.researchResults = "Không thể tìm kiếm thông tin bổ sung";
        }

        return state;
    }

    // Node: Phân tích cuối cùng
    async function finalAnalysis(state) {
        console.log("⚖️ Performing final analysis...");

        const prompt = await finalAnalysisPrompt.format({
            comment: state.comment,
            researchResults: state.researchResults
        });

        const result = await llm.invoke(prompt);
        const output = result.content.trim();

        try {
            // Parse JSON result
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                state.finalResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found in response");
            }
        } catch (error) {
            console.error("❌ JSON parsing error:", error);
            state.finalResult = {
                pass: false,
                reason: "Lỗi trong việc phân tích bình luận"
            };
        }

        console.log("✅ Final result:", state.finalResult);
        return state;
    }

    // Điều kiện routing
    function shouldResearch(state) {
        return state.needsResearch ? "research" : "end";
    }

    function shouldAnalyze(state) {
        return state.isObviouslyToxic ? "end" : "final_analysis";
    }

    // Tạo graph
    const workflow = new StateGraph({
        channels: {
            comment: null,
            isObviouslyToxic: null,
            needsResearch: null,
            researchResults: null,
            finalResult: null,
            messages: null
        }
    });

    // Thêm các nodes
    workflow.addNode("initial_analysis", initialAnalysis);
    workflow.addNode("research", researchSlang);
    workflow.addNode("final_analysis", finalAnalysis);

    // Thêm các edges
    workflow.setEntryPoint("initial_analysis");

    workflow.addConditionalEdges(
        "initial_analysis",
        shouldResearch,
        {
            research: "research",
            end: END
        }
    );

    workflow.addConditionalEdges(
        "research",
        shouldAnalyze,
        {
            final_analysis: "final_analysis",
            end: END
        }
    );

    workflow.addEdge("final_analysis", END);

    // Compile graph
    const app = workflow.compile();

    // Return agent với interface dễ sử dụng
    return {
        async moderateComment(comment) {
            const initialState = new CommentModerationState();
            initialState.comment = comment;

            console.log("🚀 Starting comment moderation for:", comment);

            const result = await app.invoke(initialState);

            console.log("🎯 Moderation completed");
            return result.finalResult;
        },

        // Expose graph để có thể stream hoặc debug
        graph: app
    };
}

// Utility functions
export function createModerationTools(tavilyApiKey) {
    return [
        new TavilySearchResults({
            apiKey: tavilyApiKey,
            maxResults: 5,
            searchDepth: "advanced",
            name: "slang_research",
            description: "Tìm kiếm thông tin về tiếng lóng và từ viết tắt tiếng Việt"
        })
    ];
}

// Example usage
async function example() {
    const agent = await createCommentModerationAgent({
        openaiApiKey: process.env.GOOGLE_API_KEY,
        tavilyApiKey: process.env.TAVILY_API_KEY
    });

    // Test cases
    const testComments = [
        "Sản phẩm này rất tốt, tôi khuyên mọi người nên mua",
        "Đồ rác vcl, shop lừa đảo",
        "Hàng oke, ship nhanh vcl",
        "Miền Nam thì làm gì có cái này, chỉ có miền Bắc mới biết thôi",
        "backy nay cũng bán quần áo nữa hả",
        "Phục vụ rất tử tế nhưng mà giá hơi cao xíu",
        "Em này xinh thế nhưng chắc não toàn nước",
        "Dịch vụ khách hàng khá tệ, nhân viên thiếu chuyên nghiệp =))",
        "Quần áo chất lượng quá tốt, đáng đồng tiền bát gạo",
        "Sao giờ ai cũng flex hàng hiệu thế nhỉ, ngán ngẩm",
        "Thời trang này chắc chỉ dành cho dân backy thôi",
        "Mẫu áo này đẹp thật, mà giá thì Bắc kỳ mới mua nổi",
        "Nam kỳ mặc áo này trông rất hợp",
        'Em này làm ở bar mà giờ cũng bán quần áo nữa haha'
    ];

    for (const comment of testComments) {
        console.log(`\n--- Testing: "${comment}" ---`);
        const result = await agent.moderateComment(comment);
        console.log("Result:", JSON.stringify(result, null, 2));
    }
}

example();

// Export để sử dụng
export { example };