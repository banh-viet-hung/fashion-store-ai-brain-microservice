# Fashion Store Product Chatbot

Dự án này triển khai một hệ thống Retrieval Augmented Generation (RAG) sử dụng LangChain và LangGraph, kết hợp với mô hình Gemini của Google để tạo chatbot thông minh về sản phẩm thời trang.

## Tính năng

- **Hệ thống RAG**: Truy xuất thông tin từ catalog sản phẩm PDF
- **Agent thông minh**: Sử dụng framework ReAct của LangGraph để đưa ra quyết định suy luận
- **Chat có trạng thái**: Duy trì ngữ cảnh hội thoại qua các tương tác
- **Suy luận nhiều bước**: Có thể thực hiện nhiều bước truy xuất cho các câu hỏi phức tạp
- **Server API**: Cung cấp API cho frontend gọi đến
- **Frontend Web UI**: Giao diện người dùng thân thiện cho chatbot

## Yêu cầu hệ thống

- Node.js (v16 trở lên)
- Google AI API key (cho mô hình Gemini)

## Cài đặt

1. Clone repository
2. Cài đặt các dependencies:

```bash
npm install
```

3. Tạo file `.env` trong thư mục gốc với API key của Google:

```
GOOGLE_API_KEY=your_google_api_key_here
```

4. Thêm file PDF catalog sản phẩm vào thư mục `product-pdfs/`

## Cấu trúc dự án

```
├── src/
│   ├── agent.ts         # Triển khai Agent sử dụng LangGraph
│   ├── data-processor.ts # Xử lý và tải dữ liệu PDF cho RAG
│   ├── index.ts         # Entry point cho server
│   ├── models.ts        # Khởi tạo mô hình LLM và Embedding
│   ├── server.ts        # Cấu hình Express server
│   └── tools.ts         # Định nghĩa công cụ truy xuất
├── client/             # Frontend code
│   ├── index.html      # Trang HTML chính
│   ├── styles.css      # CSS styles
│   ├── app.js          # Frontend JavaScript
├── product-pdfs/       # Thư mục chứa catalog PDF sản phẩm
├── package.json
├── tsconfig.json
└── README.md
```

## Hoạt động của hệ thống

1. **Chỉ mục dữ liệu**: Tải và xử lý catalog sản phẩm từ các file PDF
2. **Lưu trữ vector**: Tạo embeddings và lưu trữ trong vector database
3. **Cấu hình Agent**: Thiết lập agent ReAct với khả năng truy xuất thông tin sản phẩm
4. **Xử lý truy vấn**: Nhận câu hỏi từ người dùng về sản phẩm và xác định:
   - Khi nào có thể trả lời trực tiếp
   - Khi nào cần truy xuất thông tin
   - Cách tạo truy vấn truy xuất tốt
   - Khi nào thực hiện nhiều truy xuất cho câu hỏi phức tạp
5. **API Server**: Cung cấp REST API cho frontend
6. **Web UI**: Giao diện người dùng để tương tác với chatbot

## Chạy ứng dụng

```bash
npm start
```

Server sẽ khởi động và có sẵn tại http://localhost:4444

## Chi tiết triển khai

- Sử dụng mô hình Gemini 2.5 Flash của Google
- Sử dụng mô hình text-embedding-004 của Google cho embeddings
- Triển khai mẫu Agent ReAct qua LangGraph
- Xử lý và chỉ mục dữ liệu từ các file PDF catalog sản phẩm
- Sử dụng MemoryVectorStore cho lưu trữ vector
- Duy trì trạng thái bằng MemorySaver của LangGraph
- Frontend được xây dựng với HTML, CSS, và JavaScript thuần
- Backend sử dụng Express.js 