// core/fileManager.js
// 文件上传和管理核心逻辑
import { getStorage, setStorage } from '../utils/storage.js';
import { generateId } from '../utils/events.js';

const extensionName = 'novel-injector';

class FileManager {
    constructor() {
        this.novels = new Map();
        this.basePath = `/scripts/extensions/third-party/${extensionName}/novels/`;
    }

    /**
     * 初始化文件管理器，加载已存储的小说数据
     */
    async init() {
        const savedNovels = await getStorage('novels') || {};
        for (const [id, novelData] of Object.entries(savedNovels)) {
            this.novels.set(id, novelData);
        }
        console.log(`[${extensionName}] FileManager initialized with ${this.novels.size} novels`);
    }

    /**
     * 上传小说文件到服务器
     * @param {File} file - 上传的文件对象
     * @returns {Promise<object>} 返回上传结果
     */
    async uploadNovel(file) {
        if (!file || !file.name.endsWith('.txt')) {
            throw new Error('请选择有效的 .txt 文件');
        }

        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            throw new Error('文件大小不能超过 50MB');
        }

        const novelId = generateId();
        const fileName = `${novelId}_${file.name}`;
        
        try {
            // 创建 FormData 对象
            const formData = new FormData();
            formData.append('file', file, fileName);
            formData.append('path', `extensions/third-party/${extensionName}/novels/`);

            // 上传文件到服务器
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`上传失败: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            // 读取文件内容并解析段落
            const textContent = await this.readFileContent(fileName);
            const paragraphs = this.parseParagraphs(textContent);

            // 创建小说数据对象
            const novelData = {
                id: novelId,
                filename: fileName,
                originalName: file.name,
                title: this.extractTitle(file.name),
                totalParagraphs: paragraphs.length,
                currentParagraph: 0,
                uploadDate: new Date().toISOString(),
                fileSize: file.size,
                paragraphs: paragraphs // 缓存段落内容
            };

            // 存储到内存和持久化
            this.novels.set(novelId, novelData);
            await this.saveNovelsData();

            console.log(`[${extensionName}] Novel uploaded successfully: ${file.name}`);
            return {
                success: true,
                novelId: novelId,
                data: novelData
            };

        } catch (error) {
            console.error(`[${extensionName}] Upload failed:`, error);
            throw new Error(`上传失败: ${error.message}`);
        }
    }

    /**
     * 读取服务器上的文件内容
     * @param {string} fileName - 文件名
     * @returns {Promise<string>} 文件内容
     */
    async readFileContent(fileName) {
        try {
            const response = await fetch(`${this.basePath}${fileName}`);
            if (!response.ok) {
                throw new Error(`读取文件失败: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`[${extensionName}] Failed to read file:`, error);
            throw error;
        }
    }

    /**
     * 解析文本内容为段落数组
     * @param {string} content - 文本内容
     * @returns {Array<string>} 段落数组
     */
    parseParagraphs(content) {
        if (!content || typeof content !== 'string') {
            return [];
        }

        // 统一换行符
        const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // 按双换行符分割段落，过滤空段落
        const paragraphs = normalizedContent
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        return paragraphs;
    }

    /**
     * 从文件名提取标题
     * @param {string} fileName - 文件名
     * @returns {string} 提取的标题
     */
    extractTitle(fileName) {
        return fileName.replace(/\.[^/.]+$/, ""); // 移除扩展名
    }

    /**
     * 获取所有小说列表
     * @returns {Array} 小说列表
     */
    getAllNovels() {
        return Array.from(this.novels.values()).map(novel => ({
            ...novel,
            paragraphs: undefined // 不返回段落内容，只返回元数据
        }));
    }

    /**
     * 根据ID获取小说数据
     * @param {string} novelId - 小说ID
     * @returns {object|null} 小说数据
     */
    getNovel(novelId) {
        return this.novels.get(novelId) || null;
    }

    /**
     * 删除小说
     * @param {string} novelId - 小说ID
     * @returns {Promise<boolean>} 删除是否成功
     */
    async deleteNovel(novelId) {
        const novel = this.novels.get(novelId);
        if (!novel) {
            throw new Error('小说不存在');
        }

        try {
            // 删除服务器上的文件
            const response = await fetch('/api/files/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: `extensions/third-party/${extensionName}/novels/${novel.filename}`
                })
            });

            if (!response.ok) {
                console.warn(`[${extensionName}] Failed to delete file from server, but removing from list anyway`);
            }

            // 从内存中移除
            this.novels.delete(novelId);
            await this.saveNovelsData();

            console.log(`[${extensionName}] Novel deleted: ${novel.title}`);
            return true;

        } catch (error) {
            console.error(`[${extensionName}] Delete failed:`, error);
            throw new Error(`删除失败: ${error.message}`);
        }
    }

    /**
     * 更新小说进度
     * @param {string} novelId - 小说ID
     * @param {number} paragraphIndex - 段落索引
     */
    async updateProgress(novelId, paragraphIndex) {
        const novel = this.novels.get(novelId);
        if (!novel) {
            throw new Error('小说不存在');
        }

        novel.currentParagraph = Math.max(0, Math.min(paragraphIndex, novel.totalParagraphs - 1));
        await this.saveNovelsData();
    }

    /**
     * 重置小说进度
     * @param {string} novelId - 小说ID
     */
    async resetProgress(novelId) {
        await this.updateProgress(novelId, 0);
    }

    /**
     * 获取小说的指定段落内容
     * @param {string} novelId - 小说ID
     * @param {number} startIndex - 起始段落索引
     * @param {number} endIndex - 结束段落索引（不包含）
     * @returns {Array<string>} 段落内容数组
     */
    getParagraphs(novelId, startIndex, endIndex) {
        const novel = this.novels.get(novelId);
        if (!novel || !novel.paragraphs) {
            return [];
        }

        return novel.paragraphs.slice(startIndex, endIndex);
    }

    /**
     * 保存小说数据到持久化存储
     */
    async saveNovelsData() {
        const novelsData = {};
        for (const [id, novel] of this.novels.entries()) {
            // 保存时排除段落内容以节省空间，只保存元数据
            const { paragraphs, ...metadata } = novel;
            novelsData[id] = metadata;
        }
        await setStorage('novels', novelsData);
    }

    /**
     * 重新加载小说的段落内容（如果内存中没有）
     * @param {string} novelId - 小说ID
     */
    async reloadNovelContent(novelId) {
        const novel = this.novels.get(novelId);
        if (!novel) {
            throw new Error('小说不存在');
        }

        if (!novel.paragraphs) {
            try {
                const content = await this.readFileContent(novel.filename);
                novel.paragraphs = this.parseParagraphs(content);
                console.log(`[${extensionName}] Reloaded content for novel: ${novel.title}`);
            } catch (error) {
                console.error(`[${extensionName}] Failed to reload novel content:`, error);
                throw error;
            }
        }
    }
}

// 创建单例实例
const fileManager = new FileManager();

export { fileManager, FileManager };