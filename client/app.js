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

        // Format markdown-like text (basic formatting only)
        const formattedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        contentDiv.innerHTML = `<p>${formattedContent}</p>`;
        messageDiv.appendChild(contentDiv);

        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Show typing indicator
    function showTypingIndicator(status = 'thinking') {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing';
        typingDiv.id = 'typingIndicator';

        if (status === 'retrieving') {
            // Hiển thị hiệu ứng thu thập thông tin
            typingDiv.innerHTML = '<span style="margin-right:8px;">🔎</span> <span>Đang thu thập thông tin...</span>';
        } else {
            // Hiệu ứng ba chấm như cũ
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.className = 'dot';
                typingDiv.appendChild(dot);
            }
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
        let currentStatus = 'thinking';
        showTypingIndicator(currentStatus);
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

            // Nếu status khác với status hiện tại thì cập nhật hiệu ứng
            if (data.status && data.status !== currentStatus) {
                hideTypingIndicator();
                showTypingIndicator(data.status);
                currentStatus = data.status;
            }
            // Đợi một chút để user thấy hiệu ứng (tùy chỉnh nếu muốn)
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