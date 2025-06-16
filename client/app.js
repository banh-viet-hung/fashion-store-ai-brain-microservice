document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const quickRepliesContainer = document.getElementById('quick-replies');
    const typingIndicator = document.getElementById('typing-indicator');

    let sessionId = `user-${Date.now()}`;
    let isLoading = false;

    // Hiển thị tin nhắn chào mừng đầu tiên
    displayWelcomeMessage();

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const messageText = userInput.value.trim();
        if (messageText && !isLoading) {
            sendMessage(messageText);
            userInput.value = '';
        }
    });

    function displayWelcomeMessage() {
        const welcomeMessage = {
            answer: "Chào mừng bạn đến với **COOLMAN**! Tôi là trợ lý thời trang AI, sẵn sàng giúp bạn tìm kiếm sản phẩm, tư vấn phong cách và trả lời mọi câu hỏi về thời trang nam.",
            response_type: 'greeting',
            followup_questions: ["Bạn đang tìm kiếm sản phẩm gì hôm nay?", "Bạn cần tôi tư vấn về cách phối đồ không?"],
            suggested_actions: [
                { type: 'quick_reply', text: 'Tìm áo thun nam', value: 'Tìm áo thun nam' },
                { type: 'quick_reply', text: 'Tư vấn phối đồ công sở', value: 'Tư vấn phối đồ công sở' },
                { type: 'quick_reply', text: 'COOLMAN có gì mới?', value: 'COOLMAN có sản phẩm mới nào không?' },
            ]
        };
        displayBotMessage(welcomeMessage);
    }

    async function sendMessage(messageText) {
        if (isLoading) return;

        isLoading = true;
        displayUserMessage(messageText);
        clearQuickReplies();
        typingIndicator.style.display = 'block';
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, sessionId: sessionId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.errorMessage || 'Đã có lỗi xảy ra từ server.');
            }

            const data = await response.json();
            sessionId = data._meta.sessionId; // Cập nhật sessionId từ server
            await displayBotMessage(data);

        } catch (error) {
            console.error('Error sending message:', error);
            await displayBotMessage({ answer: `Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại. \n\n*Chi tiết lỗi: ${error.message}*`, response_type: 'error' });
        } finally {
            isLoading = false;
            typingIndicator.style.display = 'none';
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    function displayUserMessage(messageText) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'user');
        messageElement.innerHTML = `<div class="message-content">${messageText}</div>`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function displayBotMessage(data) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'bot');

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // Render main answer (with Markdown)
        if (data.answer) {
            const answerHtml = marked.parse(data.answer);
            const answerDiv = document.createElement('div');
            answerDiv.innerHTML = answerHtml;
            messageContent.appendChild(answerDiv);
        }

        // Render related products
        if (data.related_products && data.related_products.length > 0) {
            const productsCarousel = await createProductsCarousel(data.related_products);
            messageContent.appendChild(productsCarousel);
        }

        // Render follow-up questions
        if (data.followup_questions && data.followup_questions.length > 0) {
            messageContent.appendChild(createFollowUpQuestions(data.followup_questions));
        }

        messageElement.appendChild(messageContent);
        chatBox.appendChild(messageElement);

        // Render suggested actions / quick replies
        if (data.suggested_actions && data.suggested_actions.length > 0) {
            renderQuickReplies(data.suggested_actions);
        }

        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function createProductsCarousel(products) {
        const carousel = document.createElement('div');
        carousel.className = 'products-carousel';

        for (const productRef of products) {
            if (!productRef.id) continue;

            try {
                const response = await fetch(`https://fashion-store-backend-u0pj.onrender.com/products/${productRef.id}`);
                if (!response.ok) {
                    console.error(`Failed to fetch product with ID ${productRef.id}. Status: ${response.status}`);
                    continue;
                }
                const result = await response.json();
                if (!result.success || !result.data) {
                    console.error(`API did not return successful data for product ID ${productRef.id}`);
                    continue;
                }

                const product = result.data;
                const card = document.createElement('div');
                card.className = 'product-card';

                const price = product.price ? product.price.toLocaleString('vi-VN') + ' VNĐ' : 'N/A';
                const salePrice = product.salePrice ? product.salePrice.toLocaleString('vi-VN') + ' VNĐ' : '';

                let priceHTML = `<div class="price-original">${price}</div>`;
                if (salePrice && product.salePrice > 0 && product.salePrice < product.price) {
                    priceHTML = `<div class="price-sale">${salePrice}</div> <div class="price-original-slashed">${price}</div>`;
                }

                const imgHTML = product.imgForAi
                    ? `<img src="${product.imgForAi}" alt="${product.name}" class="product-image">`
                    : '<div class="product-image-placeholder"></div>';

                const buyNowBtnHTML = `<a href="http://localhost:3000/product/${productRef.id}" target="_blank" class="buy-now-btn">Mua ngay</a>`;

                card.innerHTML = `
                    ${imgHTML}
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <div class="price">${priceHTML}</div>
                    </div>
                    ${buyNowBtnHTML}
                `;
                carousel.appendChild(card);

            } catch (error) {
                console.error(`Error fetching or rendering product data for ID ${productRef.id}:`, error);
            }
        }
        return carousel;
    }

    function createFollowUpQuestions(questions) {
        const container = document.createElement('div');
        container.className = 'follow-up-questions';
        let listHTML = '<ul>';
        questions.forEach(q => {
            listHTML += `<li>${q}</li>`;
        });
        listHTML += '</ul>';
        container.innerHTML = `<p>Tôi có thể giúp bạn thêm:</p>${listHTML}`;
        return container;
    }

    function renderQuickReplies(actions) {
        clearQuickReplies();
        actions.forEach(action => {
            const button = document.createElement('button');
            if (action.type === 'quick_reply') {
                button.className = 'quick-reply-btn';
                button.textContent = action.text;
                button.onclick = () => {
                    const messageText = action.value || action.text;
                    if (messageText && messageText.trim() !== '') {
                        sendMessage(messageText);
                    } else {
                        console.error('Error: Quick reply has no text or value');
                    }
                };
            } else if (action.type === 'link') {
                button.className = 'link-btn';
                button.textContent = action.text;
                button.onclick = () => {
                    const url = action.value || action.url || action.text;
                    if (url && url.trim() !== '') {
                        window.open(url, '_blank');
                    } else {
                        console.error('Error: Link has no valid URL');
                    }
                };
            }
            quickRepliesContainer.appendChild(button);
        });
    }

    function clearQuickReplies() {
        quickRepliesContainer.innerHTML = '';
    }
});
