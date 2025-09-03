import { eventNames } from './utils/constants.js';

// 插件状态
let settings = {
    isEnabled: false,
    responses: [],
    hotkeys: {}
};

// 获取SillyTavern上下文
const context = getContext();
const ws = context.ws;

// 原始发送消息函数引用
let originalSendMessage = null;

// 初始化插件
function initPlugin() {
    // 保存原始sendMessage函数
    if (!originalSendMessage) {
        originalSendMessage = context.sendMessage;
    }
    
    // 请求当前设置
    ws.send(JSON.stringify({
        event: eventNames.GET_SETTINGS
    }));
}

// 处理热键事件
function handleHotkey(event) {
    if (!settings.isEnabled) return;
    
    const key = event.key.toLowerCase();
    const responseId = Object.keys(settings.hotkeys).find(id => settings.hotkeys[id] === key);
    
    if (responseId) {
        const response = settings.responses.find(r => r.id == responseId);
        if (response) {
            event.preventDefault();
            sendQuickResponse(response.content);
        }
    }
}

// 发送快速响应
function sendQuickResponse(content) {
    if (originalSendMessage) {
        originalSendMessage.call(context, content);
    }
}

// WebSocket消息监听
ws.addEventListener('message', function(event) {
    const message = JSON.parse(event.data);
    
    switch (message.event) {
        case eventNames.SETTINGS_UPDATE:
            settings = { ...settings, ...message.data };
            break;
            
        case 'quick_response_force_replace_send':
            sendQuickResponse(message.data.content);
            break;
    }
});

// 绑定热键事件
document.addEventListener('keydown', handleHotkey);

// 初始化插件
initPlugin();