import { MemoryVectorStore } from "langchain/vectorstores/memory";
import type { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import axios from "axios";

const PRODUCT_JSON_PATH = path.join(__dirname, "../product-json/products.json");
const PRODUCT_API_URL = "http://localhost:8080/products/public/all";

function cleanHTML(html: string): string {
    if (!html) return "";
    try {
        // Dùng cheerio để loại bỏ thẻ HTML
        const $ = cheerio.load(html);
        return $.text().replace(/\s+/g, " ").trim();
    } catch (error) {
        console.warn("Lỗi khi làm sạch HTML:", error);
        // Fallback: xóa thẻ HTML bằng regex đơn giản
        return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
}

function buildProductText(product: any): string {
    // Xử lý các trường có thể thiếu
    const name = product.name || "Không rõ tên sản phẩm";
    const description = cleanHTML(product.description || "Không có mô tả");
    const price = product.price ? `${product.price} VNĐ` : "Không rõ giá";
    const salePrice = product.salePrice ? `${product.salePrice} VNĐ` : "Không có giá khuyến mãi";
    const averageRating = product.averageRating !== undefined ? `${product.averageRating} sao` : "Chưa có đánh giá";
    const categories = Array.isArray(product.categories) && product.categories.length > 0 ? product.categories.join(", ") : "Không rõ danh mục";
    const colors = Array.isArray(product.colors) && product.colors.length > 0 ? product.colors.join(", ") : "Không có màu sắc";
    const sizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes.join(", ") : "Không có kích thước";
    let feedbackText = "";
    if (Array.isArray(product.feedbacks) && product.feedbacks.length > 0) {
        feedbackText = ` Một số đánh giá: ` + product.feedbacks.map((fb: any) => {
            const user = fb.userName || "Ẩn danh";
            const rating = fb.rating !== undefined ? `${fb.rating} sao` : "Không rõ sao";
            const comment = fb.comment ? cleanHTML(fb.comment) : "Không có bình luận";
            return `[${user} - ${rating}]: ${comment}`;
        }).join("; ");
    } else {
        feedbackText = " Chưa có đánh giá từ người dùng.";
    }

    return `Tên sản phẩm: ${name}. Mô tả: ${description}. Giá: ${price}. Giá khuyến mãi: ${salePrice}. Đánh giá trung bình: ${averageRating}. Danh mục: ${categories}. Màu sắc có sẵn: ${colors}. Kích thước có sẵn: ${sizes}.${feedbackText}`;
}

export async function processProductJSONs(vectorStore: MemoryVectorStore, jsonPath: string = PRODUCT_JSON_PATH) {
    let json;

    // Thử lấy dữ liệu từ API trước
    try {
        console.log(`Đang tải dữ liệu sản phẩm từ API: ${PRODUCT_API_URL}`);
        const response = await axios.get(PRODUCT_API_URL);
        json = response.data;
        console.log("✅ Lấy dữ liệu từ API thành công.");
    } catch (error: any) {
        console.warn(`❌ Không thể lấy dữ liệu từ API: ${error.message}`);
        console.log("Đang sử dụng dữ liệu local từ file JSON...");

        // Fallback: Đọc từ file local
        if (!fs.existsSync(jsonPath)) {
            console.error(`Không tìm thấy file dữ liệu sản phẩm: ${jsonPath}`);
            return vectorStore;
        }

        const raw = fs.readFileSync(jsonPath, "utf8");
        try {
            json = JSON.parse(raw);
            console.log("✅ Đọc dữ liệu từ file JSON local thành công.");
        } catch (e) {
            console.error("❌ Lỗi khi parse JSON:", e);
            return vectorStore;
        }
    }

    const products = Array.isArray(json.data) ? json.data : [];
    if (products.length === 0) {
        console.warn("⚠️ Không có sản phẩm nào trong dữ liệu.");
        return vectorStore;
    }

    // Tạo document cho từng sản phẩm
    const documents = products.map((product: any) => {
        const productText = buildProductText(product);
        const metadata = {
            id: product.id,
            name: product.name,
            price: product.price,
            salePrice: product.salePrice,
            averageRating: product.averageRating,
            categories: product.categories,
            full_product_data: product,
        };
        return { pageContent: productText, metadata };
    });

    await vectorStore.addDocuments(documents);
    console.log(`✅ Đã thêm ${documents.length} sản phẩm vào vector store.`);
    return vectorStore;
}

export async function loadData(embeddings: GoogleGenerativeAIEmbeddings) {
    const vectorStore = new MemoryVectorStore(embeddings);
    await processProductJSONs(vectorStore);
    return vectorStore;
} 