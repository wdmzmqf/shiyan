// utils/storage.js
// 数据持久化工具
import { extension_settings } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';

const extensionName = 'novel-injector';

/**
 * 初始化扩展设置
 */
function initExtensionSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    return extension_settings[extensionName];
}

/**
 * 获取存储的数据
 * @param {string} key - 数据键名
 * @param {*} defaultValue - 默认值
 * @returns {Promise<*>} 存储的值或默认值
 */
export async function getStorage(key, defaultValue = null) {
    try {
        const settings = initExtensionSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    } catch (error) {
        console.error(`[${extensionName}] Failed to get storage for key: ${key}`, error);
        return defaultValue;
    }
}

/**
 * 设置存储数据
 * @param {string} key - 数据键名
 * @param {*} value - 要存储的值
 * @returns {Promise<boolean>} 是否成功
 */
export async function setStorage(key, value) {
    try {
        const settings = initExtensionSettings();
        settings[key] = value;
        saveSettingsDebounced();
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Failed to set storage for key: ${key}`, error);
        return false;
    }
}

/**
 * 删除存储数据
 * @param {string} key - 数据键名
 * @returns {Promise<boolean>} 是否成功
 */
export async function removeStorage(key) {
    try {
        const settings = initExtensionSettings();
        delete settings[key];
        saveSettingsDebounced();
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Failed to remove storage for key: ${key}`, error);
        return false;
    }
}

/**
 * 清除所有存储数据
 * @returns {Promise<boolean>} 是否成功
 */
export async function clearStorage() {
    try {
        extension_settings[extensionName] = {};
        saveSettingsDebounced();
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Failed to clear storage`, error);
        return false;
    }
}

/**
 * 获取所有存储数据
 * @returns {Promise<object>} 所有存储的数据
 */
export async function getAllStorage() {
    try {
        return { ...initExtensionSettings() };
    } catch (error) {
        console.error(`[${extensionName}] Failed to get all storage`, error);
        return {};
    }
}

/**
 * 批量设置多个存储项
 * @param {object} data - 键值对对象
 * @returns {Promise<boolean>} 是否成功
 */
export async function setBatchStorage(data) {
    try {
        const settings = initExtensionSettings();
        Object.assign(settings, data);
        saveSettingsDebounced();
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Failed to set batch storage`, error);
        return false;
    }
}

/**
 * 检查存储项是否存在
 * @param {string} key - 数据键名
 * @returns {Promise<boolean>} 是否存在
 */
export async function hasStorage(key) {
    try {
        const settings = initExtensionSettings();
        return settings.hasOwnProperty(key);
    } catch (error) {
        console.error(`[${extensionName}] Failed to check storage for key: ${key}`, error);
        return false;
    }
}

/**
 * 获取存储使用情况统计
 * @returns {Promise<object>} 统计信息
 */
export async function getStorageStats() {
    try {
        const settings = initExtensionSettings();
        const dataString = JSON.stringify(settings);
        const sizeInBytes = new Blob([dataString]).size;
        const keys = Object.keys(settings);

        return {
            keyCount: keys.length,
            sizeInBytes: sizeInBytes,
            sizeFormatted: formatBytes(sizeInBytes),
            keys: keys
        };
    } catch (error) {
        console.error(`[${extensionName}] Failed to get storage stats`, error);
        return {
            keyCount: 0,
            sizeInBytes: 0,
            sizeFormatted: '0 B',
            keys: []
        };
    }
}

/**
 * 格式化字节大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化的大小字符串
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 导出设置到JSON文件
 * @returns {Promise<string>} JSON字符串
 */
export async function exportSettings() {
    try {
        const settings = await getAllStorage();
        return JSON.stringify(settings, null, 2);
    } catch (error) {
        console.error(`[${extensionName}] Failed to export settings`, error);
        throw error;
    }
}

/**
 * 从JSON字符串导入设置
 * @param {string} jsonString - JSON字符串
 * @param {boolean} merge - 是否合并现有设置
 * @returns {Promise<boolean>} 是否成功
 */
export async function importSettings(jsonString, merge = true) {
    try {
        const importedData = JSON.parse(jsonString);
        
        if (merge) {
            const currentSettings = await getAllStorage();
            const mergedSettings = { ...currentSettings, ...importedData };
            extension_settings[extensionName] = mergedSettings;
        } else {
            extension_settings[extensionName] = importedData;
        }
        
        saveSettingsDebounced();
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Failed to import settings`, error);
        return false;
    }
}

/**
 * 创建设置备份
 * @returns {Promise<object>} 备份数据
 */
export async function createBackup() {
    try {
        const settings = await getAllStorage();
        const backup = {
            timestamp: new Date().toISOString(),
            version: '8.0.0',
            data: settings
        };
        return backup;
    } catch (error) {
        console.error(`[${extensionName}] Failed to create backup`, error);
        throw error;
    }
}

/**
 * 恢复设置备份
 * @param {object} backup - 备份数据
 * @returns {Promise<boolean>} 是否成功
 */
export async function restoreBackup(backup) {
    try {
        if (!backup || !backup.data) {
            throw new Error('Invalid backup data');
        }
        
        extension_settings[extensionName] = backup.data;
        saveSettingsDebounced();
        return true;
    } catch (error) {
        console.error(`[${extensionName}] Failed to restore backup`, error);
        return false;
    }
}