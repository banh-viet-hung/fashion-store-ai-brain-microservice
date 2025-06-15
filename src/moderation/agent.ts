import { StateGraph, END, StateGraphArgs } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { PromptTemplate } from "@langchain/core/prompts";

// This is a simplified, direct implementation to avoid complex typing issues.

export function createCommentModerationAgent(config: any = {}) {
    const {
        googleApiKey,
        tavilyApiKey,
        model = "gemini-2.5-flash-preview-05-20",
        temperature = 0.1
    } = config;

    if (!googleApiKey || !tavilyApiKey) {
        throw new Error("Google and Tavily API keys are required for the moderation agent.");
    }

    const llm = new ChatGoogleGenerativeAI({ apiKey: googleApiKey, model, temperature });
    const tavilyTool = new TavilySearchResults({ apiKey: tavilyApiKey, maxResults: 5 });

    // All prompts remain the same
    const initialAnalysisPrompt = PromptTemplate.fromTemplate(
        `Hãy phân tích bình luận sau đây của người dùng Việt Nam:

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

Phân tích:`
    );

    const researchQueryPrompt = PromptTemplate.fromTemplate(
        `Bình luận: "{comment}"

Trong bình luận này có các từ lóng/viết tắt cần tìm hiểu. Hãy xác định chính xác từng từ lóng hoặc viết tắt cần tìm hiểu.

Đặc biệt chú ý đến các từ có thể ám chỉ vùng miền hoặc nhóm người cụ thể, chẳng hạn:
- "backy" → có thể là cách viết khác của "Bắc Kỳ" (từ chỉ người miền Bắc, thường mang tính phân biệt)
- Các từ tương tự như "namky", "trungky" cũng cần được phân tích kỹ

Tạo một câu truy vấn ngắn gọn, tự nhiên để tìm hiểu ý nghĩa của từ đó. Ví dụ:
- Nếu có từ "vkl" → "vkl là gì trong tiếng lóng Việt Nam"
- Nếu có từ "backy" → "backy có phải là từ phân biệt vùng miền trong tiếng Việt"

Chỉ trả về câu truy vấn ngắn gọn, không giải thích:`
    );

    const finalAnalysisPrompt = PromptTemplate.fromTemplate(
        `Bình luận gốc: "{comment}"

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

    return {
        async moderateComment(comment: string) {
            console.log("🚀 [Moderation] Starting moderation for:", comment);

            // 1. Direct check for regional terms
            const regionalTerms = ["backy", "bắc kỳ", "namky", "nam kỳ", "trungky", "trung kỳ"];
            const lowerComment = comment.toLowerCase();
            if (regionalTerms.some(term => lowerComment.includes(term))) {
                console.log("⚠️ [Moderation] Detected regional discrimination term");
                return { pass: false, reason: "Bình luận có sử dụng từ ngữ mang tính phân biệt vùng miền" };
            }

            // 2. Initial analysis
            console.log("🔍 [Moderation] Analyzing comment...");
            const initialPrompt = await initialAnalysisPrompt.format({ comment });
            const initialResult = await llm.invoke(initialPrompt);
            const analysis = initialResult.content.toString().trim();
            console.log("📊 [Moderation] Initial analysis result:", analysis);

            if (analysis === "SAFE") {
                return { pass: true, reason: null };
            }
            if (analysis === "TOXIC") {
                return { pass: false, reason: "Bình luận chứa nội dung rõ ràng độc hại, toxic hoặc tiêu cực" };
            }

            // 3. Needs research
            if (analysis === "NEEDS_RESEARCH") {
                console.log("🔎 [Moderation] Researching slang/abbreviations...");
                const queryPrompt = await researchQueryPrompt.format({ comment });
                const queryResult = await llm.invoke(queryPrompt);
                const searchQuery = queryResult.content.toString().trim();
                console.log("🔍 [Moderation] Search query:", searchQuery);

                let researchResults = "";
                try {
                    const searchResults = await tavilyTool.invoke(searchQuery);
                    researchResults = Array.isArray(searchResults)
                        ? searchResults.map(r => r.content || r.snippet || '').join('\n\n')
                        : searchResults.toString();
                    console.log("📝 [Moderation] Research results obtained");
                } catch (error) {
                    console.error("❌ [Moderation] Search error:", error);
                    researchResults = "Không thể tìm kiếm thông tin bổ sung";
                }

                // 4. Final analysis after research
                console.log("⚖️ [Moderation] Performing final analysis...");
                const finalPrompt = await finalAnalysisPrompt.format({ comment, researchResults });
                const finalResult = await llm.invoke(finalPrompt);
                const output = finalResult.content.toString().trim();

                try {
                    const jsonMatch = output.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const finalJson = JSON.parse(jsonMatch[0]);
                        console.log("✅ [Moderation] Final result:", finalJson);
                        return finalJson;
                    }
                    throw new Error("No JSON found in response");
                } catch (error) {
                    console.error("❌ [Moderation] JSON parsing error:", error);
                    return { pass: false, reason: "Lỗi trong việc phân tích bình luận" };
                }
            }

            // Fallback
            return { pass: true, reason: "Không xác định được, tạm thời chấp nhận" };
        }
    };
} 