// utils/events.js
// 事件处理工具
const extensionName = 'novel-injector';

// 事件监听器存储
const eventListeners = new Map();

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 触发自定义事件
 * @param {string} eventName - 事件名称
 * @param {*} data - 事件数据
 */
export function emitEvent(eventName, data = null) {
    const event = new CustomEvent(`${extensionName}:${eventName}`, {
        detail: data,
        bubbles: true,
        cancelable: true
    });
    
    document.dispatchEvent(event);
    console.log(`[${extensionName}] Event emitted: ${eventName}`, data);
}

/**
 * 监听自定义事件
 * @param {string} eventName - 事件名称
 * @param {function} callback - 回调函数
 * @param {object} options - 选项
 * @returns {string} 监听器ID，用于取消监听
 */
export function onEvent(eventName, callback, options = {}) {
    const fullEventName = `${extensionName}:${eventName}`;
    const listenerId = generateId();
    
    const wrappedCallback = (event) => {
        try {
            callback(event.detail, event);
        } catch (error) {
            console.error(`[${extensionName}] Event callback error for ${eventName}:`, error);
        }
    };
    
    document.addEventListener(fullEventName, wrappedCallback, options);
    
    // 存储监听器信息以便后续移除
    eventListeners.set(listenerId, {
        eventName: fullEventName,
        callback: wrappedCallback,
        originalCallback: callback
    });
    
    console.log(`[${extensionName}] Event listener added: ${eventName} (ID: ${listenerId})`);
    return listenerId;
}

/**
 * 取消事件监听
 * @param {string} listenerId - 监听器ID
 * @returns {boolean} 是否成功取消
 */
export function offEvent(listenerId) {
    const listenerInfo = eventListeners.get(listenerId);
    if (!listenerInfo) {
        return false;
    }
    
    document.removeEventListener(listenerInfo.eventName, listenerInfo.callback);
    eventListeners.delete(listenerId);
    
    console.log(`[${extensionName}] Event listener removed: ID ${listenerId}`);
    return true;
}

/**
 * 取消所有事件监听
 */
export function offAllEvents() {
    for (const [listenerId, listenerInfo] of eventListeners.entries()) {
        document.removeEventListener(listenerInfo.eventName, listenerInfo.callback);
    }
    eventListeners.clear();
    console.log(`[${extensionName}] All event listeners removed`);
}

/**
 * 一次性事件监听器
 * @param {string} eventName - 事件名称
 * @param {function} callback - 回调函数
 * @returns {string} 监听器ID
 */
export function onceEvent(eventName, callback) {
    const listenerId = onEvent(eventName, (data, event) => {
        offEvent(listenerId);
        callback(data, event);
    }, { once: true });
    
    return listenerId;
}

/**
 * 等待事件发生（Promise方式）
 * @param {string} eventName - 事件名称
 * @param {number} timeout - 超时时间（毫秒），0表示不超时
 * @returns {Promise} Promise对象
 */
export function waitForEvent(eventName, timeout = 0) {
    return new Promise((resolve, reject) => {
        let timeoutId = null;
        
        const listenerId = onceEvent(eventName, (data) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            resolve(data);
        });
        
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                offEvent(listenerId);
                reject(new Error(`Event ${eventName} timeout after ${timeout}ms`));
            }, timeout);
        }
    });
}

/**
 * 批量事件监听
 * @param {object} eventMap - 事件映射对象 {eventName: callback, ...}
 * @param {object} options - 选项
 * @returns {Array<string>} 监听器ID数组
 */
export function onMultipleEvents(eventMap, options = {}) {
    const listenerIds = [];
    
    for (const [eventName, callback] of Object.entries(eventMap)) {
        const listenerId = onEvent(eventName, callback, options);
        listenerIds.push(listenerId);
    }
    
    return listenerIds;
}

/**
 * 批量取消事件监听
 * @param {Array<string>} listenerIds - 监听器ID数组
 */
export function offMultipleEvents(listenerIds) {
    for (const listenerId of listenerIds) {
        offEvent(listenerId);
    }
}

/**
 * 防抖事件触发器
 * @param {string} eventName - 事件名称
 * @param {*} data - 事件数据
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {function} 取消函数
 */
export function debounceEmit(eventName, data, delay = 300) {
    const debounceKey = `debounce_${eventName}`;
    
    // 清除之前的定时器
    if (window[debounceKey]) {
        clearTimeout(window[debounceKey]);
    }
    
    // 设置新的定时器
    window[debounceKey] = setTimeout(() => {
        emitEvent(eventName, data);
        delete window[debounceKey];
    }, delay);
    
    // 返回取消函数
    return () => {
        if (window[debounceKey]) {
            clearTimeout(window[debounceKey]);
            delete window[debounceKey];
        }
    };
}

/**
 * 节流事件触发器
 * @param {string} eventName - 事件名称
 * @param {*} data - 事件数据
 * @param {number} interval - 间隔时间（毫秒）
 * @returns {boolean} 是否触发成功
 */
export function throttleEmit(eventName, data, interval = 300) {
    const throttleKey = `throttle_${eventName}`;
    const lastEmitKey = `lastEmit_${eventName}`;
    
    const now = Date.now();
    const lastEmit = window[lastEmitKey] || 0;
    
    if (now - lastEmit >= interval) {
        emitEvent(eventName, data);
        window[lastEmitKey] = now;
        return true;
    }
    
    return false;
}

/**
 * 事件统计信息
 * @returns {object} 统计信息
 */
export function getEventStats() {
    const stats = {
        totalListeners: eventListeners.size,
        listenersByEvent: new Map()
    };
    
    for (const [listenerId, listenerInfo] of eventListeners.entries()) {
        const eventName = listenerInfo.eventName;
        if (!stats.listenersByEvent.has(eventName)) {
            stats.listenersByEvent.set(eventName, 0);
        }
        stats.listenersByEvent.set(eventName, stats.listenersByEvent.get(eventName) + 1);
    }
    
    return stats;
}

/**
 * 监听SillyTavern核心事件（如果可用）
 * @param {string} eventType - SillyTavern事件类型
 * @param {function} callback - 回调函数
 * @returns {string|null} 监听器ID或null
 */
export function onSillyTavernEvent(eventType, callback) {
    // 检查SillyTavern的eventSource是否可用
    if (typeof eventSource !== 'undefined' && eventSource && eventSource.on) {
        try {
            eventSource.on(eventType, callback);
            console.log(`[${extensionName}] SillyTavern event listener added: ${eventType}`);
            return generateId(); // 返回一个ID用于跟踪
        } catch (error) {
            console.error(`[${extensionName}] Failed to add SillyTavern event listener:`, error);
        }
    }
    return null;
}

/**
 * 等待SillyTavern核心加载完成
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否加载完成
 */
export function waitForSillyTavernReady(timeout = 10000) {
    return new Promise((resolve) => {
        let timeoutId;
        
        const checkReady = () => {
            // 检查关键的SillyTavern对象是否存在
            if (typeof eventSource !== 'undefined' && 
                typeof extension_settings !== 'undefined' &&
                typeof saveSettingsDebounced !== 'undefined') {
                
                if (timeoutId) clearTimeout(timeoutId);
                resolve(true);
                return true;
            }
            return false;
        };
        
        // 立即检查一次
        if (checkReady()) {
            return;
        }
        
        // 定期检查
        const checkInterval = setInterval(() => {
            if (checkReady()) {
                clearInterval(checkInterval);
            }
        }, 100);
        
        // 设置超时
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                clearInterval(checkInterval);
                console.warn(`[${extensionName}] SillyTavern ready check timeout after ${timeout}ms`);
                resolve(false);
            }, timeout);
        }
    });
}

/**
 * DOM元素变化观察器
 * @param {string} selector - CSS选择器
 * @param {function} callback - 回调函数
 * @param {object} options - 观察选项
 * @returns {object} 观察器对象
 */
export function observeElementChanges(selector, callback, options = {}) {
    const defaultOptions = {
        childList: true,
        subtree: true,
        attributes: false,
        attributeOldValue: false,
        characterData: false,
        characterDataOldValue: false
    };
    
    const observerOptions = { ...defaultOptions, ...options };
    
    const observer = new MutationObserver((mutations) => {
        try {
            callback(mutations);
        } catch (error) {
            console.error(`[${extensionName}] DOM observer callback error:`, error);
        }
    });
    
    const targetElement = document.querySelector(selector);
    if (targetElement) {
        observer.observe(targetElement, observerOptions);
        console.log(`[${extensionName}] DOM observer started for: ${selector}`);
    } else {
        console.warn(`[${extensionName}] Element not found for observer: ${selector}`);
    }
    
    return {
        observer: observer,
        disconnect: () => observer.disconnect(),
        reconnect: () => {
            const element = document.querySelector(selector);
            if (element) {
                observer.observe(element, observerOptions);
            }
        }
    };
}

/**
 * 延迟执行函数
 * @param {function} func - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {number} 定时器ID
 */
export function delay(func, delay) {
    return setTimeout(func, delay);
}

/**
 * 异步延迟
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise} Promise对象
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的JSON解析
 * @param {string} jsonString - JSON字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析结果或默认值
 */
export function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn(`[${extensionName}] JSON parse failed:`, error);
        return defaultValue;
    }
}

/**
 * 安全的JSON序列化
 * @param {*} obj - 要序列化的对象
 * @param {string} defaultValue - 默认值
 * @returns {string} JSON字符串或默认值
 */
export function safeJsonStringify(obj, defaultValue = '{}') {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        console.warn(`[${extensionName}] JSON stringify failed:`, error);
        return defaultValue;
    }
}

/**
 * 清理所有资源
 */
export function cleanup() {
    // 移除所有事件监听器
    offAllEvents();
    
    // 清理防抖定时器
    Object.keys(window)
        .filter(key => key.startsWith('debounce_') || key.startsWith('throttle_') || key.startsWith('lastEmit_'))
        .forEach(key => {
            if (typeof window[key] === 'number') {
                clearTimeout(window[key]);
            }
            delete window[key];
        });
    
    console.log(`[${extensionName}] Event utilities cleaned up`);
}