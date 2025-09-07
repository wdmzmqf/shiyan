// ui/novelList.js
// 小说列表UI组件
import { fileManager } from '../core/fileManager.js';
import { injectionEngine } from '../core/injectionEngine.js';
import { emitEvent } from '../utils/events.js';

const extensionName = 'novel-injector';

class NovelListUI {
    constructor() {
        this.container = null;
        this.novels = [];
        this.activeNovelId = null;
    }

    /**
     * 初始化小说列表UI
     * @param {string} containerId - 容器元素ID
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`[${extensionName}] Novel list container not found: ${containerId}`);
            return;
        }

        this.setupEventListeners();
        this.refresh();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听文件上传完成事件
        document.addEventListener(`${extensionName}:novelUploaded`, () => {
            this.refresh();
        });

        // 监听小说删除事件
        document.addEventListener(`${extensionName}:novelDeleted`, () => {
            this.refresh();
        });

        // 监听进度更新事件
        document.addEventListener(`${extensionName}:progressUpdated`, () => {
            this.updateProgress();
        });
    }

    /**
     * 刷新小说列表
     */
    async refresh() {
        try {
            this.novels = fileManager.getAllNovels();
            this.activeNovelId = injectionEngine.getStatus().activeNovelId;
            this.render();
        } catch (error) {
            console.error(`[${extensionName}] Failed to refresh novel list:`, error);
            this.renderError('加载小说列表失败');
        }
    }

    /**
     * 渲染小说列表
     */
    render() {
        if (!this.container) return;

        if (this.novels.length === 0) {
            this.renderEmpty();
            return;
        }

        const listHtml = this.novels.map(novel => this.renderNovelItem(novel)).join('');
        
        this.container.innerHTML = `
            <div class="novel-list">
                <div class="novel-list-header">
                    <h4>📚 小说库 (${this.novels.length}本)</h4>
                    <div class="novel-list-actions">
                        <button id="refresh_novel_list" class="menu_button" title="刷新列表">
                            <i class="fa fa-refresh"></i>
                        </button>
                        <button id="sort_novel_list" class="menu_button" title="排序">
                            <i class="fa fa-sort"></i>
                        </button>
                    </div>
                </div>
                <div class="novel-list-content">
                    ${listHtml}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    /**
     * 渲染单个小说项目
     * @param {object} novel - 小说数据
     * @returns {string} HTML字符串
     */
    renderNovelItem(novel) {
        const isActive = novel.id === this.activeNovelId;
        const progress = this.calculateProgress(novel);
        const uploadDate = new Date(novel.uploadDate).toLocaleDateString();
        const fileSize = this.formatFileSize(novel.fileSize);

        return `
            <div class="novel-item ${isActive ? 'active' : ''}" data-novel-id="${novel.id}">
                <div class="novel-item-header">
                    <div class="novel-title">
                        <h5>${this.escapeHtml(novel.title)}</h5>
                        <div class="novel-meta">
                            <span class="novel-size">${fileSize}</span>
                            <span class="novel-date">${uploadDate}</span>
                        </div>
                    </div>
                    <div class="novel-status">
                        ${isActive ? '<span class="status-badge active">使用中</span>' : ''}
                    </div>
                </div>
                
                <div class="novel-progress">
                    <div class="progress-info">
                        <span>进度: ${progress.current}/${progress.total} (${progress.percentage}%)</span>
                        <span class="progress-text">${progress.text}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.percentage}%"></div>
                    </div>
                </div>

                <div class="novel-actions">
                    <button class="novel-btn select-btn" data-novel-id="${novel.id}" 
                            ${isActive ? 'disabled' : ''}>
                        ${isActive ? '已选择' : '选择'}
                    </button>
                    <button class="novel-btn preview-btn" data-novel-id="${novel.id}">
                        预览
                    </button>
                    <button class="novel-btn reset-btn" data-novel-id="${novel.id}"
                            ${progress.current === 0 ? 'disabled' : ''}>
                        重置进度
                    </button>
                    <button class="novel-btn delete-btn" data-novel-id="${novel.id}">
                        删除
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 计算进度信息
     * @param {object} novel - 小说数据
     * @returns {object} 进度信息
     */
    calculateProgress(novel) {
        const current = novel.currentParagraph || 0;
        const total = novel.totalParagraphs || 1;
        const percentage = Math.round((current / total) * 100);
        
        let text = '';
        if (current === 0) {
            text = '未开始';
        } else if (current >= total) {
            text = '已完成';
        } else {
            text = '阅读中';
        }

        return {
            current: current,
            total: total,
            percentage: percentage,
            text: text
        };
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化的大小
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * HTML转义
     * @param {string} text - 文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refresh_novel_list');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        // 排序按钮
        const sortBtn = document.getElementById('sort_novel_list');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.showSortMenu());
        }

        // 选择小说按钮
        this.container.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const novelId = e.target.dataset.novelId;
                this.selectNovel(novelId);
            });
        });

        // 预览按钮
        this.container.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const novelId = e.target.dataset.novelId;
                this.previewNovel(novelId);
            });
        });

        // 重置进度按钮
        this.container.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const novelId = e.target.dataset.novelId;
                this.resetProgress(novelId);
            });
        });

        // 删除按钮
        this.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const novelId = e.target.dataset.novelId;
                this.deleteNovel(novelId);
            });
        });
    }

    /**
     * 选择小说
     * @param {string} novelId - 小说ID
     */
    async selectNovel(novelId) {
        try {
            await injectionEngine.enable(novelId);
            this.activeNovelId = novelId;
            this.refresh(); // 刷新UI显示状态
            
            const novel = this.novels.find(n => n.id === novelId);
            toastr.success(`已选择小说: ${novel?.title}`, '小说注入器');
            
            emitEvent('novelSelected', { novelId, novel });
        } catch (error) {
            console.error(`[${extensionName}] Failed to select novel:`, error);
            toastr.error('选择小说失败', '小说注入器');
        }
    }

    /**
     * 预览小说
     * @param {string} novelId - 小说ID
     */
    async previewNovel(novelId) {
        try {
            const novel = fileManager.getNovel(novelId);
            if (!novel) {
                toastr.error('小说不存在', '小说注入器');
                return;
            }

            await fileManager.reloadNovelContent(novelId);
            const preview = novel.paragraphs?.slice(0, 3)?.join('\n\n') || '无法获取预览内容';
            
            this.showPreviewModal(novel.title, preview);
        } catch (error) {
            console.error(`[${extensionName}] Failed to preview novel:`, error);
            toastr.error('预览失败', '小说注入器');
        }
    }

    /**
     * 显示预览模态框
     * @param {string} title - 小说标题
     * @param {string} content - 预览内容
     */
    showPreviewModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'novel-preview-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📖 ${this.escapeHtml(title)}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="preview-content">${this.escapeHtml(content)}</div>
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
     * 重置进度
     * @param {string} novelId - 小说ID
     */
    async resetProgress(novelId) {
        const novel = this.novels.find(n => n.id === novelId);
        if (!novel) return;

        const confirmed = confirm(`确定要重置《${novel.title}》的阅读进度吗？`);
        if (!confirmed) return;

        try {
            await fileManager.resetProgress(novelId);
            this.refresh();
            toastr.success('进度已重置', '小说注入器');
            
            emitEvent('progressReset', { novelId, novel });
        } catch (error) {
            console.error(`[${extensionName}] Failed to reset progress:`, error);
            toastr.error('重置进度失败', '小说注入器');
        }
    }

    /**
     * 删除小说
     * @param {string} novelId - 小说ID
     */
    async deleteNovel(novelId) {
        const novel = this.novels.find(n => n.id === novelId);
        if (!novel) return;

        const confirmed = confirm(`确定要删除《${novel.title}》吗？此操作不可撤销！`);
        if (!confirmed) return;

        try {
            // 如果是当前活动小说，先禁用注入引擎
            if (novelId === this.activeNovelId) {
                await injectionEngine.disable();
            }

            await fileManager.deleteNovel(novelId);
            this.refresh();
            toastr.success('小说已删除', '小说注入器');
            
            emitEvent('novelDeleted', { novelId, novel });
        } catch (error) {
            console.error(`[${extensionName}] Failed to delete novel:`, error);
            toastr.error(`删除失败: ${error.message}`, '小说注入器');
        }
    }

    /**
     * 显示排序菜单
     */
    showSortMenu() {
        const sortOptions = [
            { key: 'title', label: '按标题排序' },
            { key: 'date', label: '按上传时间排序' },
            { key: 'size', label: '按文件大小排序' },
            { key: 'progress', label: '按进度排序' }
        ];

        const menu = document.createElement('div');
        menu.className = 'sort-menu';
        menu.innerHTML = `
            <div class="menu-overlay">
                <div class="menu-content">
                    <h4>排序方式</h4>
                    ${sortOptions.map(option => `
                        <button class="sort-option" data-sort="${option.key}">
                            ${option.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(menu);

        // 绑定排序事件
        menu.querySelectorAll('.sort-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sortKey = e.target.dataset.sort;
                this.sortNovels(sortKey);
                document.body.removeChild(menu);
            });
        });

        // 点击外部关闭
        menu.querySelector('.menu-overlay').addEventListener('click', (e) => {
            if (e.target === menu.querySelector('.menu-overlay')) {
                document.body.removeChild(menu);
            }
        });
    }

    /**
     * 排序小说列表
     * @param {string} sortKey - 排序键
     */
    sortNovels(sortKey) {
        this.novels.sort((a, b) => {
            switch (sortKey) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'date':
                    return new Date(b.uploadDate) - new Date(a.uploadDate);
                case 'size':
                    return b.fileSize - a.fileSize;
                case 'progress':
                    const progressA = (a.currentParagraph || 0) / (a.totalParagraphs || 1);
                    const progressB = (b.currentParagraph || 0) / (b.totalParagraphs || 1);
                    return progressB - progressA;
                default:
                    return 0;
            }
        });
        this.render();
    }

    /**
     * 更新进度显示
     */
    updateProgress() {
        this.novels.forEach(novel => {
            const item = this.container.querySelector(`[data-novel-id="${novel.id}"]`);
            if (item) {
                const progress = this.calculateProgress(novel);
                const progressInfo = item.querySelector('.progress-info span');
                const progressFill = item.querySelector('.progress-fill');
                const progressText = item.querySelector('.progress-text');

                if (progressInfo) {
                    progressInfo.textContent = `进度: ${progress.current}/${progress.total} (${progress.percentage}%)`;
                }
                if (progressFill) {
                    progressFill.style.width = `${progress.percentage}%`;
                }
                if (progressText) {
                    progressText.textContent = progress.text;
                }
            }
        });
    }

    /**
     * 渲染空状态
     */
    renderEmpty() {
        this.container.innerHTML = `
            <div class="novel-list-empty">
                <div class="empty-icon">📚</div>
                <h4>暂无小说</h4>
                <p>请先上传一些 .txt 格式的小说文件</p>
            </div>
        `;
    }

    /**
     * 渲染错误状态
     * @param {string} message - 错误信息
     */
    renderError(message) {
        this.container.innerHTML = `
            <div class="novel-list-error">
                <div class="error-icon">⚠️</div>
                <h4>加载失败</h4>
                <p>${this.escapeHtml(message)}</p>
                <button id="retry_load" class="menu_button">重试</button>
            </div>
        `;

        const retryBtn = document.getElementById('retry_load');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.refresh());
        }
    }

    /**
     * 获取选中的小说
     * @returns {object|null} 选中的小说数据
     */
    getSelectedNovel() {
        return this.novels.find(n => n.id === this.activeNovelId) || null;
    }

    /**
     * 销毁组件
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

export { NovelListUI };