class Interceptor {
    constructor() {
        this.originalSendMessage = null;
        this.initInterceptor();
    }

    initInterceptor() {
        // 保存原始的sendMessage函数引用
        this.originalSendMessage = window.sendMessage;
        
        // 重写全局的sendMessage函数
        window.sendMessage = (text, ...args) => {
            this.interceptSendMessage(text, ...args);
        };
    }

    interceptSendMessage(text, ...args) {
        // 检查插件是否启用
        if (!uiManager || !uiManager.isPluginEnabled()) {
            // 如果未启用，则直接调用原始的sendMessage函数
            if (this.originalSendMessage) {
                this.originalSendMessage(text, ...args);
            }
            return;
        }

        // 如果已启用，则阻止默认发送行为，并触发小说注入
        uiManager.triggerNovelInjection(text, ...args);
    }

    sendOriginal(text, ...args) {
        // 调用原始的sendMessage函数来完成最终的发送
        if (this.originalSendMessage) {
            this.originalSendMessage(text, ...args);
        }
    }
}

// 实例化拦截器
const interceptor = new Interceptor();

export default Interceptor;