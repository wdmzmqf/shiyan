// core/injectionEngine.js
// 注入引擎和拦截逻辑
import { fileManager } from './fileManager.js';
import { TextProcessor } from './textProcessor.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { emitEvent } from '../utils/events.js';

const extensionName = 'novel-injector';

class InjectionEngine {
    constructor() {
        this.isEnabled = false;
        this.activeNovelId = null;
        this.textProcessor = new TextProcessor();
        this.originalSendMessage = null;
        this.isAutoPilotEnabled = false;
        this.autoPilotDelay = 3000;
        this.isWaitingForAI = false;
        this.autoPilotTimer = null;
        this.settings = {};
    }

    /**
     * 初始化注入引擎
     */
    async init() {
        // 加载设置
        await this.loadSettings();
        
        // 初始化文本处理器
        this.textProcessor.init(this.settings);
        
        // 设置发送消息拦截
        this.setupMessageInterception();
        
        // 设置自动驾驶模式监听
        this.setupAutoPilotListening();
        
        console.log(`[${extensionName}] InjectionEngine initialized`);
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        this.settings = await getStorage('settings') || {};
        this.isEnabled = this.settings.enabled || false;
        this.activeNovelId = this.settings.activeNovelId || null;
        this.isAutoPilotEnabled = this.settings.autopilotEnabled || false;
        this.autoPilotDelay = (this.settings.autopilotDelay || 3) * 1000;
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        this.settings = {
            ...this.settings,
            enabled: this.isEnabled,
            activeNovelId: this.activeNovelId,
            autopilotEnabled: this.isAutoPilotEnabled,
            autopilotDelay: this.autoPilotDelay / 1000
        };
        await setStorage('settings', this.settings);
    }

    /**
     * 设置发送消息拦截
     */
    setupMessageInterception() {
        // 等待 SillyTavern 核心加载完成
        const checkAndIntercept = () => {
            if (typeof Generate !== 'undefined' && typeof sendTextareaMessage !== 'undefined') {
                // 备份原始发送函数
                if (!this.originalSendMessage) {
                    this.originalSendMessage = sendTextareaMessage;
                }

                // 重写发送消息函数
                window.sendTextareaMessage = async (text) => {
                    if (this.shouldInterceptMessage(text)) {
                        return await this.handleInterception(text);
                    }
                    // 如果不应该拦截，调用原始函数
                    return this.originalSendMessage.call(this, text);
                };

                console.log(`[${extensionName}] Message interception setup complete`);
                clearInterval(interceptInterval);
            }
        };

        const interceptInterval = setInterval(checkAndIntercept, 500);
        
        // 5秒后停止尝试
        setTimeout(() => {
            clearInterval(interceptInterval);
        }, 5000);
    }

    /**
     * 设置自动驾驶模式监听
     */
    setupAutoPilotListening() {
        // 监听消息接收事件
        if (typeof eventSource !== 'undefined') {
            eventSource.on('message_received', (data) => {
                this.onAIMessageReceived(data);
            });
        }

        // 如果 eventSource 不存在，使用 MutationObserver 监听聊天区域变化
        this.setupChatObserver();
    }

    /**
     * 设置聊天观察器（备用方案）
     */
    setupChatObserver() {
        const chatContainer = document.getElementById('chat');
        if (!chatContainer) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            node.classList.contains('mes') && 
                            !node.classList.contains('is_user')) {
                            this.onAIMessageReceived();
                        }
                    });
                }
            });
        });

        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
    }

    /**
     * 检查是否应该拦截消息
     * @param {string} text - 消息内容
     * @returns {boolean} 是否应该拦截
     */
    shouldInterceptMessage(text) {
        // 插件未启用
        if (!this.isEnabled) {
            return false;
        }

        // 没有活动小说
        if (!this.activeNovelId) {
            return false;
        }

        // 如果消息是小说内容（避免循环拦截）
        if (this.isNovelContent(text)) {
            return false;
        }

        return true;
    }

    /**
     * 检查文本是否是小说内容
     * @param {string} text - 文本内容
     * @returns {boolean} 是否是小说内容
     */
    isNovelContent(text) {
        // 检查是否包含小说注入器的标记
        return text.includes('[小说注入器]') || text.includes('[Novel Injector]');
    }

    /**
     * 处理消息拦截
     * @param {string} originalText - 原始消息内容
     * @returns {Promise<void>}
     */
    async handleInterception(originalText) {
        try {
            // 获取下一块内容
            const nextChunk = await this.getNextChunk();
            
            if (!nextChunk) {
                toastr.warning('小说已读完，已切换回正常模式', '小说注入器');
                await this.disable();
                // 发送原始消息
                return this.originalSendMessage.call(this, originalText);
            }

            // 发送小说内容
            await this.sendNovelChunk(nextChunk, originalText);
            
            // 触发事件
            emitEvent('chunkInjected', {
                novelId: this.activeNovelId,
                chunk: nextChunk
            });

        } catch (error) {
            console.error(`[${extensionName}] Injection failed:`, error);
            toastr.error(`注入失败: ${error.message}`, '小说注入器');
            
            // 发送原始消息作为备选
            return this.originalSendMessage.call(this, originalText);
        }
    }

    /**
     * 获取下一块内容
     * @returns {Promise<object|null>} 内容块对象或null
     */
    async getNextChunk() {
        if (!this.activeNovelId) {
            return null;
        }

        const novel = fileManager.getNovel(this.activeNovelId);
        if (!novel) {
            return null;
        }

        // 检查是否已读完
        if (novel.currentParagraph >= novel.totalParagraphs) {
            return null;
        }

        // 确保小说内容已加载
        await fileManager.reloadNovelContent(this.activeNovelId);

        // 获取下一块内容
        const chunk = await this.textProcessor.getNextChunk(
            this.activeNovelId, 
            novel.currentParagraph
        );

        if (chunk) {
            // 更新进度
            await fileManager.updateProgress(this.activeNovelId, chunk.endParagraph);
        }

        return chunk;
    }

    /**
     * 发送小说内容块
     * @param {object} chunk - 内容块
     * @param {string} originalText - 原始用户输入
     */
    async sendNovelChunk(chunk, originalText) {
        // 格式化内容
        const formattedContent = this.formatChunkContent(chunk, originalText);
        
        // 发送到聊天
        return this.originalSendMessage.call(this, formattedContent);
    }

    /**
     * 格式化内容块
     * @param {object} chunk - 内容块
     * @param {string} originalText - 原始用户输入
     * @returns {string} 格式化后的内容
     */
    formatChunkContent(chunk, originalText) {
        const novel = fileManager.getNovel(this.activeNovelId);
        const settings = this.settings;
        
        let content = '';
        
        // 添加自定义前缀
        if (settings.prefixTemplate) {
            const prefix = settings.prefixTemplate
                .replace('{title}', novel?.title || '未知小说')
                .replace('{chapter}', chunk.chapter || '1')
                .replace('{start_para}', chunk.startParagraph + 1)
                .replace('{end_para}', chunk.endParagraph)
                .replace('{progress}', `${chunk.endParagraph}/${novel?.totalParagraphs || 0}`);
            
            content += prefix + '\n\n';
        }

        // 添加小说内容
        if (settings.collapseContent) {
            // 折叠模式
            content += this.createCollapsibleContent(chunk.content, originalText);
        } else {
            // 直接显示
            content += chunk.content;
        }

        // 添加标记
        content += '\n\n[小说注入器 - 自动注入]';
        
        return content;
    }

    /**
     * 创建可折叠的内容
     * @param {string} novelContent - 小说内容
     * @param {string} originalText - 原始用户输入
     * @returns {string} 可折叠的HTML内容
     */
    createCollapsibleContent(novelContent, originalText) {
        const contentId = `novel_content_${Date.now()}`;
        const shortPreview = novelContent.substring(0, 100) + (novelContent.length > 100 ? '...' : '');
        
        return `
<div class="novel-injector-collapsible">
    <div class="novel-injector-header" onclick="toggleNovelContent('${contentId}')">
        <strong>📖 小说内容 (点击展开/折叠)</strong>
        <span class="novel-injector-preview">${shortPreview}</span>
    </div>
    <div id="${contentId}" class="novel-injector-content" style="display: none;">
        <div class="novel-injector-text">${novelContent}</div>
    </div>
</div>
${originalText ? `\n用户原始输入: ${originalText}` : ''}
        `;
    }

    /**
     * AI消息接收处理
     */
    onAIMessageReceived() {
        if (!this.isAutoPilotEnabled || !this.isEnabled || !this.activeNovelId) {
            return;
        }

        // 清除之前的定时器
        if (this.autoPilotTimer) {
            clearTimeout(this.autoPilotTimer);
        }

        // 设置自动发送定时器
        this.autoPilotTimer = setTimeout(() => {
            this.triggerAutoPilotInjection();
        }, this.autoPilotDelay);

        console.log(`[${extensionName}] AutoPilot scheduled in ${this.autoPilotDelay}ms`);
    }

    /**
     * 触发自动驾驶注入
     */
    async triggerAutoPilotInjection() {
        if (!this.isAutoPilotEnabled || !this.isEnabled) {
            return;
        }

        try {
            await this.manualInject('');
        } catch (error) {
            console.error(`[${extensionName}] AutoPilot injection failed:`, error);
        }
    }

    /**
     * 手动注入下一块内容
     * @param {string} userInput - 用户输入（可选）
     */
    async manualInject(userInput = '') {
        if (!this.isEnabled || !this.activeNovelId) {
            toastr.warning('请先启用插件并选择小说', '小说注入器');
            return;
        }

        await this.handleInterception(userInput);
    }

    /**
     * 启用注入引擎
     * @param {string} novelId - 小说ID
     */
    async enable(novelId) {
        this.isEnabled = true;
        this.activeNovelId = novelId;
        await this.saveSettings();
        
        toastr.success('小说注入器已启用', '小说注入器');
        console.log(`[${extensionName}] Engine enabled with novel: ${novelId}`);
    }

    /**
     * 禁用注入引擎
     */
    async disable() {
        this.isEnabled = false;
        this.activeNovelId = null;
        
        // 清除自动驾驶定时器
        if (this.autoPilotTimer) {
            clearTimeout(this.autoPilotTimer);
            this.autoPilotTimer = null;
        }
        
        await this.saveSettings();
        
        toastr.info('小说注入器已禁用', '小说注入器');
        console.log(`[${extensionName}] Engine disabled`);
    }

    /**
     * 设置自动驾驶模式
     * @param {boolean} enabled - 是否启用
     * @param {number} delay - 延迟时间（秒）
     */
    async setAutoPilot(enabled, delay = 3) {
        this.isAutoPilotEnabled = enabled;
        this.autoPilotDelay = delay * 1000;
        await this.saveSettings();
        
        const status = enabled ? '已启用' : '已禁用';
        toastr.info(`自动驾驶模式${status}`, '小说注入器');
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        const novel = this.activeNovelId ? fileManager.getNovel(this.activeNovelId) : null;
        
        return {
            enabled: this.isEnabled,
            activeNovelId: this.activeNovelId,
            activeNovelTitle: novel?.title || null,
            currentProgress: novel ? `${novel.currentParagraph}/${novel.totalParagraphs}` : null,
            autoPilotEnabled: this.isAutoPilotEnabled,
            autoPilotDelay: this.autoPilotDelay / 1000
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 恢复原始发送函数
        if (this.originalSendMessage && window.sendTextareaMessage !== this.originalSendMessage) {
            window.sendTextareaMessage = this.originalSendMessage;
        }

        // 清除定时器
        if (this.autoPilotTimer) {
            clearTimeout(this.autoPilotTimer);
        }
    }
}

// 添加全局函数用于折叠内容控制
window.toggleNovelContent = function(contentId) {
    const element = document.getElementById(contentId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
};

// 创建单例实例
const injectionEngine = new InjectionEngine();

export { injectionEngine, InjectionEngine };