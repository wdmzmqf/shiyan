// index.js
// 小说注入器主入口文件
import { extension_settings } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';
import { fileManager } from './core/fileManager.js';
import { injectionEngine } from './core/injectionEngine.js';
import { SettingsUI } from './ui/settings.js';
import { getStorage, setStorage } from './utils/storage.js';
import { waitForSillyTavernReady } from './utils/events.js';

const extensionName = 'novel-injector';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 全局变量
let settingsUI = null;
let isInitialized = false;

/**
 * 初始化扩展
 */
async function init() {
    if (isInitialized) {
        console.log(`[${extensionName}] Already initialized`);
        return;
    }

    try {
        console.log(`[${extensionName}] Initializing...`);
        
        // 等待SillyTavern核心加载完成
        await waitForSillyTavernReady();
        
        // 初始化文件管理器
        await fileManager.init();
        
        // 初始化注入引擎
        await injectionEngine.init();
        
        // 创建设置UI
        settingsUI = new SettingsUI();
        await settingsUI.init();
        
        // 标记为已初始化
        isInitialized = true;
        
        console.log(`[${extensionName}] Initialization complete`);
        
    } catch (error) {
        console.error(`[${extensionName}] Initialization failed:`, error);
        toastr.error('小说注入器初始化失败', '错误');
    }
}

/**
 * 加载设置界面
 */
async function loadSettings() {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $('#extensions_settings').append(settingsHtml);
        
        // 初始化UI组件
        if (settingsUI) {
            // UI组件已在init中初始化
        }
        
        console.log(`[${extensionName}] Settings UI loaded`);
        
    } catch (error) {
        console.error(`[${extensionName}] Failed to load settings UI:`, error);
        toastr.error('加载设置界面失败', '错误');
    }
}

/**
 * 加载样式文件
 */
function loadStyles() {
    const styleId = `${extensionName}-styles`;
    if (document.getElementById(styleId)) {
        return;
    }
    
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `${extensionFolderPath}/style.css?v=${Date.now()}`;
    document.head.appendChild(link);
    
    console.log(`[${extensionName}] Styles loaded`);
}

/**
 * 清理资源
 */
function cleanup() {
    if (settingsUI) {
        settingsUI.destroy();
    }
    
    injectionEngine.cleanup();
    
    isInitialized = false;
    
    console.log(`[${extensionName}] Cleanup complete`);
}

/**
 * 导出函数供其他模块使用
 */
export {
    init,
    loadSettings,
    loadStyles,
    cleanup,
    extensionName,
    extensionFolderPath
};

/**
 * jQuery ready回调
 */
jQuery(async () => {
    try {
        // 加载样式
        loadStyles();
        
        // 加载设置界面
        await loadSettings();
        
        // 初始化扩展
        await init();
        
        console.log(`[${extensionName}] Extension loaded and ready`);
        
    } catch (error) {
        console.error(`[${extensionName}] Failed to load extension:`, error);
        toastr.error('加载小说注入器扩展失败', '错误');
    }
});

/**
 * 页面卸载时清理资源
 */
window.addEventListener('beforeunload', () => {
    cleanup();
});

/**
 * 导出一些实用函数供调试使用
 */
window.novelInjector = {
    getStatus: () => injectionEngine.getStatus(),
    getSettings: () => getStorage('settings'),
    getFileManager: () => fileManager,
    getInjectionEngine: () => injectionEngine,
    refreshNovelList: () => {
        if (settingsUI && settingsUI.novelListUI) {
            settingsUI.novelListUI.refresh();
        }
    }
};