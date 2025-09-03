class Renderer {
    constructor() {
        this.observer = null;
        this.initMutationObserver();
    }

    initMutationObserver() {
        const chatElement = document.getElementById('chat');
        if (!chatElement) return;

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('mes') && node.classList.contains('user')) {
                        this.processUserMessage(node);
                    }
                });
            });
        });

        this.observer.observe(chatElement, {
            childList: true,
            subtree: true
        });
    }

    processUserMessage(messageNode) {
        const messageContent = messageNode.innerHTML;
        const hiddenMarkerRegex = /\[NJ_START\](.*?)\[NJ_END\]/s;
        const match = messageContent.match(hiddenMarkerRegex);
        
        if (match) {
            const originalContent = match[1];
            const prefixContent = messageContent.replace(hiddenMarkerRegex, '').trim();
            
            // 创建新的HTML结构
            const newContent = `
                <div class="nj-prefix">${prefixContent}</div>
                <div class="nj-toggle-container">
                    <button class="nj-toggle-btn" data-expanded="false">【展开小说内容】</button>
                    <div class="nj-hidden-content" style="display: none;">${originalContent}</div>
                </div>
            `;
            
            messageNode.innerHTML = newContent;
            
            // 绑定点击事件
            const toggleBtn = messageNode.querySelector('.nj-toggle-btn');
            const hiddenContent = messageNode.querySelector('.nj-hidden-content');
            
            if (toggleBtn && hiddenContent) {
                toggleBtn.addEventListener('click', () => {
                    this.toggleContent(toggleBtn, hiddenContent);
                });
            }
        }
    }

    toggleContent(button, contentDiv) {
        const isExpanded = button.getAttribute('data-expanded') === 'true';
        
        if (isExpanded) {
            // 折叠内容
            contentDiv.style.display = 'none';
            button.textContent = '【展开小说内容】';
            button.setAttribute('data-expanded', 'false');
        } else {
            // 展开内容
            contentDiv.style.display = 'block';
            button.textContent = '【折叠小说内容】';
            button.setAttribute('data-expanded', 'true');
        }
    }
}

// 实例化渲染器
const renderer = new Renderer();

export default Renderer;