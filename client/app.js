document.addEventListener('DOMContentLoaded', () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');

    // Session management
    const sessionId = localStorage.getItem('chatSessionId') || `user-${Date.now()}`;
    localStorage.setItem('chatSessionId', sessionId);

    // Add message to chat UI
    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Nếu content là object structured
        if (typeof content === 'object' && content !== null) {
            // 1. Hiển thị answer (markdown)
            let answerHtml = '';
            if (content.answer) {
                answerHtml = content.answer
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br>');
            }
            contentDiv.innerHTML = `<p>${answerHtml}</p>`;

            // 2. Hiển thị related_products
            if (Array.isArray(content.related_products) && content.related_products.length > 0) {
                const productsDiv = document.createElement('div');
                productsDiv.className = 'related-products';
                productsDiv.innerHTML = '<strong>Sản phẩm liên quan:</strong>';
                content.related_products.forEach(prod => {
                    const prodDiv = document.createElement('div');
                    prodDiv.className = 'product-item';
                    prodDiv.innerHTML = `
                        <div><strong>${prod.name}</strong> (${prod.id})</div>
                        <div>${prod.description || ''}</div>
                        <div>Giá: ${prod.price ? prod.price + '₫' : 'N/A'}${prod.sale_price ? ' <span style="color:red">' + prod.sale_price + '₫</span>' : ''}</div>
                    `;
                    productsDiv.appendChild(prodDiv);
                });
                contentDiv.appendChild(productsDiv);
            }

            // 3. Hiển thị followup_questions
            if (Array.isArray(content.followup_questions) && content.followup_questions.length > 0) {
                const followDiv = document.createElement('div');
                followDiv.className = 'followup-questions';
                followDiv.innerHTML = '<strong>Câu hỏi gợi ý:</strong> ' + content.followup_questions.map(q => `<span class="followup">${q}</span>`).join(' | ');
                contentDiv.appendChild(followDiv);
            }

            // 4. Hiển thị suggested_actions
            if (Array.isArray(content.suggested_actions) && content.suggested_actions.length > 0) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'suggested-actions';
                content.suggested_actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'action-btn';
                    btn.innerText = action.text;
                    btn.onclick = () => {
                        if (action.type === 'quick_reply') {
                            messageInput.value = action.value;
                            messageInput.focus();
                        } else if (action.type === 'link') {
                            window.open(action.value, '_blank');
                        } else if (action.type === 'contact_support') {
                            alert('Vui lòng liên hệ bộ phận hỗ trợ!');
                        }
                    };
                    actionsDiv.appendChild(btn);
                });
                contentDiv.appendChild(actionsDiv);
            }
        } else {
            // Format markdown-like text (basic formatting only)
            const formattedContent = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            contentDiv.innerHTML = `<p>${formattedContent}</p>`;
        }

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Show typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing';
        typingDiv.id = 'typingIndicator';
        // Luôn hiển thị hiệu ứng ba chấm
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            typingDiv.appendChild(dot);
        }
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Hide typing indicator
    function hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // Send message to server
    async function sendMessage(message) {
        showTypingIndicator();
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    sessionId
                }),
            });
            if (!response.ok) {
                throw new Error('Server error');
            }
            const data = await response.json();
            setTimeout(() => {
                hideTypingIndicator();
                addMessage(data.response, 'bot');
            }, 600);
        } catch (error) {
            hideTypingIndicator();
            console.error('Error:', error);
            addMessage('Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.', 'bot');
        }
    }

    // Handle form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const message = messageInput.value.trim();
        if (!message) return;

        // Add user message to UI
        addMessage(message, 'user');

        // Clear input
        messageInput.value = '';

        // Send to server
        sendMessage(message);
    });

    // Focus input on page load
    messageInput.focus();
}); 