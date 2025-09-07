// ui/settings.js
// 设置面板绑定
import { fileManager } from '../core/fileManager.js';
import { injectionEngine } from '../core/injectionEngine.js';
import { getStorage, setStorage } from '../utils/storage.js';
import { NovelListUI } from './novelList.js';
import { emitEvent } from '../utils/events.js';

const extensionName = 'novel-injector';

class SettingsUI {
    constructor() {
        this.novelListUI = null; // 延迟初始化
        this.settings = {};
    }

    /**
     * 初始化设置UI
     */
    async init() {
        // 等待SillyTavern核心加载完成
        await this.waitForSillyTavernReady();
        
        // 加载设置
        await this.loadSettings();
        
        // 初始化小说列表UI
        if (!this.novelListUI) {
            this.novelListUI = new NovelListUI();
        }
        this.novelListUI.init('novel_list_container');
        
        // 绑定事件
        this.bindEvents();
        
        // 更新UI状态
        this.updateUI();
        
        console.log(`[${extensionName}] SettingsUI initialized`);
    }

    /**
     * 等待SillyTavern核心加载完成
     */
    async waitForSillyTavernReady() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (typeof extension_settings !== 'undefined' && 
                    typeof saveSettingsDebounced !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // 5秒超时
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        });
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        this.settings = await getStorage('settings') || {};
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        await setStorage('settings', this.settings);
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 插件启用开关
        const enableToggle = document.getElementById('enable_novel_injector');
        if (enableToggle) {
            enableToggle.addEventListener('change', (e) => {
                this.settings.enabled = e.target.checked;
                this.saveSettings();
                
                if (this.settings.enabled) {
                    toastr.success('小说注入器已启用', '小说注入器');
                } else {
                    injectionEngine.disable();
                    toastr.info('小说注入器已禁用', '小说注入器');
                }
                
                this.updateUI();
            });
        }

        // 文件上传
        const fileInput = document.getElementById('novel_file_input');
        const uploadBtn = document.getElementById('upload_novel_btn');
        if (fileInput && uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                const file = fileInput.files[0];
                if (file) {
                    this.uploadNovel(file);
                } else {
                    toastr.warning('请选择一个文件', '小说注入器');
                }
            });
        }

        // 目标字数设置
        const targetWordCountInput = document.getElementById('target_word_count');
        if (targetWordCountInput) {
            targetWordCountInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 500;
                this.settings.targetWordCount = Math.max(100, Math.min(5000, value));
                e.target.value = this.settings.targetWordCount;
                this.saveSettings();
                toastr.success(`目标字数已设置为: ${this.settings.targetWordCount}`, '小说注入器');
            });
        }

        // 自定义前缀模板
        const prefixTemplateInput = document.getElementById('prefix_template');
        if (prefixTemplateInput) {
            prefixTemplateInput.addEventListener('change', (e) => {
                this.settings.prefixTemplate = e.target.value;
                this.saveSettings();
                toastr.success('前缀模板已更新', '小说注入器');
            });
        }

        // 内容折叠开关
        const collapseToggle = document.getElementById('collapse_content');
        if (collapseToggle) {
            collapseToggle.addEventListener('change', (e) => {
                this.settings.collapseContent = e.target.checked;
                this.saveSettings();
                toastr.success('内容折叠设置已更新', '小说注入器');
            });
        }

        // 自动驾驶模式开关
        const autopilotToggle = document.getElementById('autopilot_enabled');
        if (autopilotToggle) {
            autopilotToggle.addEventListener('change', (e) => {
                this.settings.autopilotEnabled = e.target.checked;
                injectionEngine.setAutoPilot(this.settings.autopilotEnabled, this.settings.autopilotDelay);
                this.saveSettings();
                this.updateUI();
                
                const status = this.settings.autopilotEnabled ? '已启用' : '已禁用';
                toastr.info(`自动驾驶模式${status}`, '小说注入器');
            });
        }

        // 自动驾驶延迟设置
        const autopilotDelayInput = document.getElementById('autopilot_delay');
        if (autopilotDelayInput) {
            autopilotDelayInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 3;
                this.settings.autopilotDelay = Math.max(1, Math.min(300, value));
                e.target.value = this.settings.autopilotDelay;
                injectionEngine.setAutoPilot(this.settings.autopilotEnabled, this.settings.autopilotDelay);
                this.saveSettings();
                toastr.success(`等待延迟已设置为: ${this.settings.autopilotDelay}秒`, '小说注入器');
            });
        }

        // 立即发送下一块按钮
        const manualInjectBtn = document.getElementById('manual_inject_btn');
        if (manualInjectBtn) {
            manualInjectBtn.addEventListener('click', async () => {
                try {
                    await injectionEngine.manualInject('');
                    toastr.success('已发送下一块内容', '小说注入器');
                } catch (error) {
                    toastr.error(`发送失败: ${error.message}`, '小说注入器');
                }
            });
        }

        // 重置进度按钮
        const resetProgressBtn = document.getElementById('reset_progress_btn');
        if (resetProgressBtn) {
            resetProgressBtn.addEventListener('click', async () => {
                const status = injectionEngine.getStatus();
                if (!status.activeNovelId) {
                    toastr.warning('请先选择一本小说', '小说注入器');
                    return;
                }

                const confirmed = confirm('确定要重置当前小说的阅读进度吗？');
                if (confirmed) {
                    try {
                        await fileManager.resetProgress(status.activeNovelId);
                        this.novelListUI.refresh();
                        toastr.success('进度已重置', '小说注入器');
                        emitEvent('progressReset', { novelId: status.activeNovelId });
                    } catch (error) {
                        toastr.error(`重置失败: ${error.message}`, '小说注入器');
                    }
                }
            });
        }

        // 导出设置按钮
        const exportSettingsBtn = document.getElementById('export_settings_btn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => {
                this.exportSettings();
            });
        }

        // 导入设置按钮
        const importSettingsBtn = document.getElementById('import_settings_btn');
        const importSettingsInput = document.getElementById('import_settings_file');
        if (importSettingsBtn && importSettingsInput) {
            importSettingsBtn.addEventListener('click', () => {
                importSettingsInput.click();
            });
            
            importSettingsInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importSettings(file);
                }
            });
        }

        // 清空所有数据按钮
        const clearAllDataBtn = document.getElementById('clear_all_data_btn');
        if (clearAllDataBtn) {
            clearAllDataBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }
    }

    /**
     * 上传小说
     * @param {File} file - 文件对象
     */
    async uploadNovel(file) {
        const uploadBtn = document.getElementById('upload_novel_btn');
        const originalText = uploadBtn.textContent;
        
        try {
            uploadBtn.textContent = '上传中...';
            uploadBtn.disabled = true;
            
            const result = await fileManager.uploadNovel(file);
            
            if (result.success) {
                toastr.success(`小说《${result.data.title}》上传成功！`, '小说注入器');
                document.getElementById('novel_file_input').value = '';
                this.novelListUI.refresh();
                emitEvent('novelUploaded', result);
            }
        } catch (error) {
            console.error(`[${extensionName}] Upload failed:`, error);
            toastr.error(`上传失败: ${error.message}`, '小说注入器');
        } finally {
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
        }
    }

    /**
     * 更新UI状态
     */
    updateUI() {
        // 更新插件启用状态
        const enableToggle = document.getElementById('enable_novel_injector');
        if (enableToggle) {
            enableToggle.checked = this.settings.enabled || false;
        }

        // 更新目标字数
        const targetWordCountInput = document.getElementById('target_word_count');
        if (targetWordCountInput) {
            targetWordCountInput.value = this.settings.targetWordCount || 500;
        }

        // 更新前缀模板
        const prefixTemplateInput = document.getElementById('prefix_template');
        if (prefixTemplateInput) {
            prefixTemplateInput.value = this.settings.prefixTemplate || '第{title}章 段落{start_para}-{end_para}\n\n';
        }

        // 更新内容折叠设置
        const collapseToggle = document.getElementById('collapse_content');
        if (collapseToggle) {
            collapseToggle.checked = this.settings.collapseContent !== false; // 默认为true
        }

        // 更新自动驾驶模式设置
        const autopilotToggle = document.getElementById('autopilot_enabled');
        if (autopilotToggle) {
            autopilotToggle.checked = this.settings.autopilotEnabled || false;
        }

        const autopilotDelayInput = document.getElementById('autopilot_delay');
        if (autopilotDelayInput) {
            autopilotDelayInput.value = this.settings.autopilotDelay || 3;
        }

        // 更新自动驾驶相关控件的启用状态
        const autopilotControls = document.querySelectorAll('.autopilot-control');
        autopilotControls.forEach(control => {
            control.disabled = !this.settings.autopilotEnabled;
        });

        // 更新状态显示
        this.updateStatusDisplay();
    }

    /**
     * 更新状态显示
     */
    updateStatusDisplay() {
        const statusElement = document.getElementById('injector_status');
        if (statusElement) {
            const status = injectionEngine.getStatus();
            let statusText = '';
            
            if (!this.settings.enabled) {
                statusText = '❌ 已禁用';
            } else if (!status.activeNovelId) {
                statusText = '🟡 等待选择小说';
            } else if (status.currentProgress) {
                statusText = `🟢 运行中 - ${status.activeNovelTitle} (${status.currentProgress})`;
            } else {
                statusText = `🟢 运行中 - ${status.activeNovelTitle}`;
            }
            
            statusElement.innerHTML = statusText;
        }
    }

    /**
     * 导出设置
     */
    async exportSettings() {
        try {
            const settingsData = await getStorage('settings') || {};
            const novelsData = await getStorage('novels') || {};
            
            const exportData = {
                timestamp: new Date().toISOString(),
                version: '8.0.0',
                settings: settingsData,
                novels: novelsData
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `novel-injector-settings-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            toastr.success('设置已导出', '小说注入器');
        } catch (error) {
            console.error(`[${extensionName}] Export failed:`, error);
            toastr.error(`导出失败: ${error.message}`, '小说注入器');
        }
    }

    /**
     * 导入设置
     * @param {File} file - 文件对象
     */
    async importSettings(file) {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (importData.settings) {
                        await setStorage('settings', importData.settings);
                        this.settings = importData.settings;
                    }
                    
                    if (importData.novels) {
                        await setStorage('novels', importData.novels);
                        await fileManager.init(); // 重新初始化文件管理器
                    }
                    
                    this.updateUI();
                    this.novelListUI.refresh();
                    
                    toastr.success('设置已导入', '小说注入器');
                } catch (parseError) {
                    toastr.error('导入文件格式错误', '小说注入器');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            console.error(`[${extensionName}] Import failed:`, error);
            toastr.error(`导入失败: ${error.message}`, '小说注入器');
        }
    }

    /**
     * 清空所有数据
     */
    async clearAllData() {
        const confirmed = confirm('确定要清空所有数据吗？此操作不可撤销！');
        if (!confirmed) return;

        try {
            // 禁用插件
            await injectionEngine.disable();
            
            // 清空存储
            await setStorage('settings', {});
            await setStorage('novels', {});
            
            // 重新初始化
            await fileManager.init();
            this.settings = {};
            
            // 更新UI
            this.updateUI();
            this.novelListUI.refresh();
            
            toastr.success('所有数据已清空', '小说注入器');
        } catch (error) {
            console.error(`[${extensionName}] Clear failed:`, error);
            toastr.error(`清空失败: ${error.message}`, '小说注入器');
        }
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        const helpContent = `
            <div class="help-modal">
                <h3>📖 小说注入器使用帮助</h3>
                <div class="help-section">
                    <h4>📚 基本使用流程</h4>
                    <ol>
                        <li>上传 .txt 格式的小说文件</li>
                        <li>从列表中选择要注入的小说</li>
                        <li>启用插件开关</li>
                        <li>正常聊天时会自动注入小说内容</li>
                    </ol>
                </div>
                <div class="help-section">
                    <h4>⚙️ 核心功能说明</h4>
                    <ul>
                        <li><strong>智能分块</strong>: 根据目标字数自动分割小说内容</li>
                        <li><strong>断点续传</strong>: 自动记录阅读进度，下次继续</li>
                        <li><strong>内容折叠</strong>: 长内容默认折叠，保持界面整洁</li>
                        <li><strong>自定义前缀</strong>: 支持动态占位符的前缀模板</li>
                        <li><strong>自动驾驶</strong>: AI回复后自动注入下一块内容</li>
                    </ul>
                </div>
                <div class="help-section">
                    <h4>💡 高级技巧</h4>
                    <ul>
                        <li>使用手动注入按钮可以随时发送下一块内容</li>
                        <li>支持章节标题自动识别和显示</li>
                        <li>可以随时重置进度从头开始</li>
                        <li>支持完整的设置导入导出功能</li>
                    </ul>
                </div>
            </div>
        `;

        this.showModal('使用帮助', helpContent);
    }

    /**
     * 显示模态框
     * @param {string} title - 标题
     * @param {string} content - 内容
     */
    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'novel-injector-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn close-btn">关闭</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定关闭事件
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.close-btn').addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) {
                closeModal();
            }
        });

        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 销毁UI组件
     */
    destroy() {
        // 销毁小说列表UI
        if (this.novelListUI) {
            this.novelListUI.destroy();
        }
    }
}

export { SettingsUI };