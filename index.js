import ResponseManager from './core/responseManager.js';
import { eventNames } from './utils/constants.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'quick_response_force',
    settings: {
        isEnabled: false,
        responses: [],
        hotkeys: {}
    },
    
    async onLoad() {
        this.responseManager = new ResponseManager();
        
        const settingsPath = path.join(process.cwd(), 'settings.json');
        if (fs.existsSync(settingsPath)) {
            try {
                const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                this.settings = { ...this.settings, ...savedSettings };
            } catch (error) {
                console.error('读取设置文件失败:', error);
            }
        } else {
            try {
                fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));
            } catch (error) {
                console.error('创建设置文件失败:', error);
            }
        }
    },
    
    async onMessage(message, sendResponse) {
        const { event, data } = message;
        
        switch (event) {
            case eventNames.SAVE_SETTINGS:
                this.settings = { ...this.settings, ...data };
                try {
                    fs.writeFileSync(path.join(process.cwd(), 'settings.json'), JSON.stringify(this.settings, null, 2));
                } catch (error) {
                    console.error('保存设置失败:', error);
                }
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.GET_SETTINGS:
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.ADD_RESPONSE:
                this.settings.responses.push({
                    id: Date.now(),
                    name: data.name,
                    content: data.content
                });
                this.saveSettings();
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.DELETE_RESPONSE:
                this.settings.responses = this.settings.responses.filter(r => r.id !== data.id);
                this.saveSettings();
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.UPDATE_RESPONSE:
                const response = this.settings.responses.find(r => r.id === data.id);
                if (response) {
                    response.name = data.name;
                    response.content = data.content;
                }
                this.saveSettings();
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.SET_HOTKEY:
                this.settings.hotkeys[data.responseId] = data.key;
                this.saveSettings();
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.REMOVE_HOTKEY:
                delete this.settings.hotkeys[data.responseId];
                this.saveSettings();
                sendResponse({ event: eventNames.SETTINGS_UPDATE, data: this.settings });
                break;
                
            case eventNames.SEND_RESPONSE:
                // 这个事件用于前端请求发送特定响应
                sendResponse({ 
                    event: 'quick_response_force_replace_send', 
                    data: { content: data.content } 
                });
                break;
                
            default:
                sendResponse({ error: '未知事件' });
        }
    },
    
    saveSettings() {
        try {
            fs.writeFileSync(path.join(process.cwd(), 'settings.json'), JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }
};