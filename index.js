import NovelManager from './core/novelManager.js';
import { eventNames } from './utils/constants.js';

// 实例化小说管理器
const novelManager = new NovelManager();

// 插件启动时初始化
function onStart() {
    const baseDir = process.cwd();
    novelManager.initialize(baseDir, sendResponse);
}

// WebSocket 消息监听器
function onMessage(message) {
    const { event, data } = message;
    
    switch (event) {
        case eventNames.LOAD_NOVEL:
            novelManager.loadNovel(data.fileName);
            sendResponse({ event: eventNames.LOAD_NOVEL, data: { success: true } });
            break;
            
        case eventNames.RESET_PROGRESS:
            novelManager.resetProgress();
            sendResponse({ event: eventNames.RESET_PROGRESS, data: { success: true } });
            break;
            
        case eventNames.GET_NEXT_CHUNK:
            const chunk = novelManager.getNextChunk(data.chunkSize);
            sendResponse({ event: eventNames.GET_NEXT_CHUNK, data: chunk });
            break;
            
        case eventNames.UPLOAD_NOVEL:
            novelManager.handleUpload(data.fileData);
            sendResponse({ event: eventNames.UPLOAD_NOVEL, data: { success: true, availableNovels: novelManager.availableNovels } });
            break;
            
        case eventNames.DELETE_NOVEL:
            novelManager.handleDelete(data.fileName);
            sendResponse({ event: eventNames.DELETE_NOVEL, data: { success: true, availableNovels: novelManager.availableNovels } });
            break;
            
        case eventNames.GET_SETTINGS:
            const settings = novelManager.getSettings();
            sendResponse({ event: eventNames.SETTINGS_UPDATE, data: settings });
            break;
            
        default:
            // 处理未知事件
            break;
    }
}

// 导出插件接口
export {
    onStart,
    onMessage
};