import { eventNames } from '../utils/constants.js';

class UIManager {
    constructor() {
        this.renderer = null;
        this.interceptor = null;
        this.websocket = null;
        this.isAutoSendMode = false;
        this.autoSendInterval = null;
        
        this.initUIManager();
    }

    initUIManager() {
        // 实例化Renderer和Interceptor
        this.renderer = new Renderer();
        this.interceptor = new Interceptor();
        
        // 获取所有UI元素的引用
        this.getUIElements();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化WebSocket连接
        this.initWebSocket();
        
        // 获取初始设置
        this.requestSettings();
    }

    getUIElements() {
        // 主控与状态
        this.pluginEnabledCheckbox = document.getElementById('plugin-enabled');
        this.statusInfoDiv = document.getElementById('status-info');
        
        // 小说库管理
        this.novelListSelect = document.getElementById('novel-list');
        this.novelUploadFile = document.getElementById('novel-upload-file');
        this.novelUploadBtn = document.getElementById('novel-upload-btn');
        this.novelLoadBtn = document.getElementById('novel-load-btn');
        this.novelDeleteBtn = document.getElementById('novel-delete-btn');
        this.resetProgressBtn = document.getElementById('reset-progress-btn');
        
        // 注入与格式化
        this.chunkSizeInput = document.getElementById('chunk-size');
        this.contentHiddenCheckbox = document.getElementById('content-hidden');
        this.prefixTemplateTextarea = document.getElementById('prefix-template');
        
        // 自动化
        this.autoSendEnabledCheckbox = document.getElementById('auto-send-enabled');
        this.delaySecondsInput = document.getElementById('delay-seconds');
    }

    bindEvents() {
        // 主控与状态事件
        if (this.pluginEnabledCheckbox) {
            this.pluginEnabledCheckbox.addEventListener('change', (e) => {
                this.sendWebSocketMessage(eventNames.SETTINGS_UPDATE, {
                    pluginEnabled: e.target.checked
                });
            });
        }
        
        // 小说库管理事件
        if (this.novelUploadBtn) {
            this.novelUploadBtn.addEventListener('click', () => {
                this.handleNovelUpload();
            });
        }
        
        if (this.novelLoadBtn) {
            this.novelLoadBtn.addEventListener('click', () => {
                const selectedNovel = this.novelListSelect.value;
                if (selectedNovel) {
                    this.sendWebSocketMessage(eventNames.LOAD_NOVEL, {
                        fileName: selectedNovel
                    });
                }
            });
        }
        
        if (this.novelDeleteBtn) {
            this.novelDeleteBtn.addEventListener('click', () => {
                const selectedNovel = this.novelListSelect.value;
                if (selectedNovel) {
                    this.sendWebSocketMessage(eventNames.DELETE_NOVEL, {
                        fileName: selectedNovel
                    });
                }
            });
        }
        
        if (this.resetProgressBtn) {
            this.resetProgressBtn.addEventListener('click', () => {
                this.sendWebSocketMessage(eventNames.RESET_PROGRESS, {});
            });
        }
        
        // 注入与格式化事件
        if (this.chunkSizeInput) {
            this.chunkSizeInput.addEventListener('change', (e) => {
                this.sendWebSocketMessage(eventNames.SETTINGS_UPDATE, {
                    chunkSize: parseInt(e.target.value) || 500
                });
            });
        }
        
        if (this.contentHiddenCheckbox) {
            this.contentHiddenCheckbox.addEventListener('change', (e) => {
                this.sendWebSocketMessage(eventNames.SETTINGS_UPDATE, {
                    contentHidden: e.target.checked
                });
            });
        }
        
        if (this.prefixTemplateTextarea) {
            this.prefixTemplateTextarea.addEventListener('change', (e) => {
                this.sendWebSocketMessage(eventNames.SETTINGS_UPDATE, {
                    prefixTemplate: e.target.value
                });
            });
        }
        
        // 自动化事件
        if (this.autoSendEnabledCheckbox) {
            this.autoSendEnabledCheckbox.addEventListener('change', (e) => {
                this.toggleAutoSend(e.target.checked);
            });
        }
        
        if (this.delaySecondsInput) {
            this.delaySecondsInput.addEventListener('change', (e) => {
                this.sendWebSocketMessage(eventNames.SETTINGS_UPDATE, {
                    delaySeconds: parseInt(e.target.value) || 3
                });
            });
        }
    }

    initWebSocket() {
        // 假设SillyTavern提供WebSocket连接
        this.websocket = window.websocket;
        
        if (this.websocket) {
            this.websocket.addEventListener('message', (event) => {
                this.handleWebSocketMessage(event);
            });
        }
    }

    handleWebSocketMessage(event) {
        const message = JSON.parse(event.data);
        const { event: eventName, data } = message;
        
        switch (eventName) {
            case eventNames.SETTINGS_UPDATE:
                this.updateSettings(data);
                break;
            case eventNames.GET_NEXT_CHUNK:
                this.handleNextChunk(data);
                break;
            case eventNames.LOAD_NOVEL:
                this.handleNovelLoad(data);
                break;
            case eventNames.UPLOAD_NOVEL:
                this.handleNovelUploadResponse(data);
                break;
            case eventNames.DELETE_NOVEL:
                this.handleNovelDeleteResponse(data);
                break;
            case eventNames.RESET_PROGRESS:
                this.handleResetProgress(data);
                break;
        }
    }

    sendWebSocketMessage(event, data) {
        if (this.websocket) {
            this.websocket.send(JSON.stringify({ event, data }));
        }
    }

    requestSettings() {
        this.sendWebSocketMessage(eventNames.GET_SETTINGS, {});
    }

    updateSettings(settings) {
        // 更新小说列表
        if (settings.availableNovels && this.novelListSelect) {
            this.novelListSelect.innerHTML = '';
            settings.availableNovels.forEach(novel => {
                const option = document.createElement('option');
                option.value = novel;
                option.textContent = novel;
                this.novelListSelect.appendChild(option);
            });
        }
        
        // 更新状态显示
        if (this.statusInfoDiv) {
            this.statusInfoDiv.textContent = `当前进度：${settings.currentIndex >= 0 ? `段落 ${settings.currentIndex + 1}` : '未开始'}`;
        }
    }

    isPluginEnabled() {
        return this.pluginEnabledCheckbox && this.pluginEnabledCheckbox.checked;
    }

    triggerNovelInjection(originalText, ...args) {
        const chunkSize = parseInt(this.chunkSizeInput.value) || 500;
        
        // 向后端发送GET_NEXT_CHUNK请求
        this.sendWebSocketMessage(eventNames.GET_NEXT_CHUNK, {
            chunkSize: chunkSize,
            originalText: originalText
        });
    }

    handleNextChunk(chunkData) {
        if (!chunkData) return;
        
        let formattedText = '';
        const prefixTemplate = this.prefixTemplateTextarea.value || '{chapter} (段落 {start_para}-{end_para})';
        
        // 格式化前缀
        const prefix = prefixTemplate
            .replace('{chapter}', chunkData.chapter || '未知章节')
            .replace('{start_para}', chunkData.start_para + 1)
            .replace('{end_para}', chunkData.end_para + 1);
        
        if (this.contentHiddenCheckbox.checked) {
            // 隐藏模式
            formattedText = `${prefix}[NJ_START]${chunkData.text}[NJ_END]`;
        } else {
            // 正常模式
            formattedText = `${prefix}\n\n${chunkData.text}`;
        }
        
        // 调用拦截器的原始发送方法
        this.interceptor.sendOriginal(formattedText);
    }

    toggleAutoSend(isEnabled) {
        this.isAutoSendMode = isEnabled;
        
        if (this.autoSendInterval) {
            clearInterval(this.autoSendInterval);
            this.autoSendInterval = null;
        }
        
        if (isEnabled) {
            const delaySeconds = parseInt(this.delaySecondsInput.value) || 3;
            this.autoSendInterval = setInterval(() => {
                // 检查是否有AI回复完成
                if (this.isAIResponseReceived()) {
                    this.triggerNovelInjection('');
                }
            }, delaySeconds * 1000);
        }
    }

    isAIResponseReceived() {
        // 这里需要实现检查AI回复是否完成的逻辑
        // 可以通过监听聊天区域的变化或检查特定元素来实现
        return true; // 临时返回true，实际需要根据具体情况判断
    }

    handleNovelUpload() {
        const fileInput = this.novelUploadFile;
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const fileData = {
                    name: file.name,
                    content: e.target.result
                };
                
                this.sendWebSocketMessage(eventNames.UPLOAD_NOVEL, {
                    fileData: fileData
                });
            };
            
            reader.readAsText(file);
        }
    }

    handleNovelUploadResponse(data) {
        if (data.success) {
            // 刷新小说列表
            this.requestSettings();
        }
    }

    handleNovelLoad(data) {
        if (data.success) {
            // 更新状态显示
            this.requestSettings();
        }
    }

    handleNovelDeleteResponse(data) {
        if (data.success) {
            // 刷新小说列表
            this.requestSettings();
        }
    }

    handleResetProgress(data) {
        if (data.success) {
            // 更新状态显示
            this.requestSettings();
        }
    }
}

// 实例化UI管理器
const uiManager = new UIManager();

export default UIManager;