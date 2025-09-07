// core/textProcessor.js
// 文本分块和格式化处理
import { fileManager } from './fileManager.js';

const extensionName = 'novel-injector';

class TextProcessor {
    constructor() {
        this.settings = {};
        this.defaultTargetWordCount = 500;
    }

    /**
     * 初始化文本处理器
     * @param {object} settings - 设置对象
     */
    init(settings) {
        this.settings = settings || {};
    }

    /**
     * 获取下一块内容
     * @param {string} novelId - 小说ID
     * @param {number} currentParagraph - 当前段落索引
     * @returns {Promise<object|null>} 内容块对象
     */
    async getNextChunk(novelId, currentParagraph) {
        const novel = fileManager.getNovel(novelId);
        if (!novel || !novel.paragraphs) {
            return null;
        }

        const targetWordCount = this.settings.targetWordCount || this.defaultTargetWordCount;
        const paragraphs = novel.paragraphs;
        
        if (currentParagraph >= paragraphs.length) {
            return null; // 已读完
        }

        // 收集段落直到达到目标字数
        const collectedParagraphs = [];
        let totalWordCount = 0;
        let endParagraph = currentParagraph;

        for (let i = currentParagraph; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const paragraphWordCount = this.countWords(paragraph);
            
            // 检查是否添加这个段落会超出目标字数
            if (totalWordCount > 0 && (totalWordCount + paragraphWordCount) > targetWordCount) {
                // 如果当前已有内容且添加此段落会超出限制，则停止
                break;
            }
            
            collectedParagraphs.push(paragraph);
            totalWordCount += paragraphWordCount;
            endParagraph = i + 1; // +1 因为这是结束位置（不包含）
            
            // 如果已达到目标字数，检查是否在合适的断句点
            if (totalWordCount >= targetWordCount) {
                if (this.isGoodBreakPoint(paragraph)) {
                    break;
                }
                // 如果不是好的断句点，继续收集下一段落（如果不会超出太多）
                if (i + 1 < paragraphs.length) {
                    const nextParagraph = paragraphs[i + 1];
                    const nextWordCount = this.countWords(nextParagraph);
                    
                    // 如果下一段落很短（少于100字），则包含它
                    if (nextWordCount < 100) {
                        continue;
                    }
                }
                break;
            }
        }

        if (collectedParagraphs.length === 0) {
            return null;
        }

        // 创建内容块
        const content = collectedParagraphs.join('\n\n');
        const chapter = this.extractChapter(content, currentParagraph);

        return {
            content: content,
            startParagraph: currentParagraph,
            endParagraph: endParagraph,
            paragraphCount: collectedParagraphs.length,
            wordCount: totalWordCount,
            chapter: chapter
        };
    }

    /**
     * 计算文本字数（中英文混合）
     * @param {string} text - 文本内容
     * @returns {number} 字数
     */
    countWords(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        // 移除多余空白字符
        const cleanText = text.trim();
        if (cleanText.length === 0) {
            return 0;
        }

        // 中文字符（包括标点符号）
        const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]/g) || []).length;
        
        // 英文单词（按空格分割）
        const englishWords = cleanText
            .replace(/[\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]/g, ' ') // 替换中文为空格
            .split(/\s+/)
            .filter(word => word.trim().length > 0).length;

        return chineseChars + englishWords;
    }

    /**
     * 检查是否是好的断句点
     * @param {string} paragraph - 段落内容
     * @returns {boolean} 是否是好的断句点
     */
    isGoodBreakPoint(paragraph) {
        if (!paragraph) {
            return false;
        }

        const lastChar = paragraph.trim().slice(-1);
        
        // 中文断句符号
        const chineseEndings = ['。', '！', '？', '"', ''', ')', '）', '…'];
        
        // 英文断句符号
        const englishEndings = ['.', '!', '?', '"', "'", ')'];
        
        return chineseEndings.includes(lastChar) || englishEndings.includes(lastChar);
    }

    /**
     * 从内容中提取章节信息
     * @param {string} content - 内容
     * @param {number} paragraphIndex - 段落索引
     * @returns {string} 章节名称
     */
    extractChapter(content, paragraphIndex) {
        // 检查内容是否存在
        if (!content || typeof content !== 'string') {
            return `第${Math.floor(paragraphIndex / 50) + 1}章`;
        }
        
        // 尝试从内容中提取章节标题
        const lines = (content || '').split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 匹配常见的章节格式
            const chapterPatterns = [
                /^第[一二三四五六七八九十百千万\d]+章.*/,  // 第X章
                /^第[一二三四五六七八九十百千万\d]+节.*/,  // 第X节  
                /^[第]?[一二三四五六七八九十百千万\d]+[、\.].*/,  // X、或X.
                /^Chapter\s+\d+.*/i,  // Chapter X
                /^Ch\.\s*\d+.*/i      // Ch. X
            ];
            
            for (const pattern of chapterPatterns) {
                if (pattern.test(trimmedLine)) {
                    return trimmedLine.length > 50 ? trimmedLine.substring(0, 50) + '...' : trimmedLine;
                }
            }
        }

        // 如果没有找到明确的章节标题，尝试使用段落索引生成
        const chapterNumber = Math.floor(paragraphIndex / 50) + 1; // 假设每50段为一章
        return `第${chapterNumber}章`;
    }

    /**
     * 格式化内容用于显示
     * @param {string} content - 原始内容
     * @param {object} options - 格式化选项
     * @returns {string} 格式化后的内容
     */
    formatContent(content, options = {}) {
        if (!content) {
            return '';
        }

        let formatted = content;

        // 统一换行符
        formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 移除多余的空白行（保留段落分隔）
        formatted = formatted.replace(/\n{3,}/g, '\n\n');

        // 如果需要，添加段落缩进
        if (options.addIndent) {
            formatted = (formatted || '')
                .split('\n\n')
                .map(paragraph => {
                    if (paragraph.trim().length === 0) {
                        return paragraph;
                    }
                    // 为非空段落添加缩进，除非已经有缩进或是特殊格式
                    if (!paragraph.match(/^[\s　]/) && !paragraph.match(/^[第\d]/)) {
                        return '　　' + paragraph;
                    }
                    return paragraph;
                })
                .join('\n\n');
        }

        // 如果需要，限制行宽
        if (options.maxLineWidth && options.maxLineWidth > 0) {
            formatted = this.wrapLines(formatted, options.maxLineWidth);
        }

        return formatted;
    }

    /**
     * 换行处理
     * @param {string} text - 文本
     * @param {number} maxWidth - 最大宽度
     * @returns {string} 处理后的文本
     */
    wrapLines(text, maxWidth) {
        if (!text) return '';
        
        return text
            .split('\n')
            .map(line => {
                if (line.length <= maxWidth) {
                    return line;
                }
                
                const wrapped = [];
                let current = '';
                
                for (let i = 0; i < line.length; i++) {
                    current += line[i];
                    
                    if (current.length >= maxWidth) {
                        // 尝试在标点符号处断行
                        const lastPunctIndex = Math.max(
                            current.lastIndexOf('，'),
                            current.lastIndexOf('。'),
                            current.lastIndexOf('；'),
                            current.lastIndexOf('：'),
                            current.lastIndexOf('！'),
                            current.lastIndexOf('？')
                        );
                        
                        if (lastPunctIndex > maxWidth * 0.7) {
                            wrapped.push(current.substring(0, lastPunctIndex + 1));
                            current = current.substring(lastPunctIndex + 1);
                        } else {
                            wrapped.push(current);
                            current = '';
                        }
                    }
                }
                
                if (current.trim()) {
                    wrapped.push(current);
                }
                
                return wrapped.join('\n');
            })
            .join('\n');
    }

    /**
     * 估算阅读时间
     * @param {string} content - 内容
     * @param {number} wordsPerMinute - 每分钟阅读字数，默认300
     * @returns {object} 阅读时间估算
     */
    estimateReadingTime(content, wordsPerMinute = 300) {
        const wordCount = this.countWords(content);
        const minutes = wordCount / wordsPerMinute;
        
        return {
            wordCount: wordCount,
            minutes: Math.ceil(minutes),
            formattedTime: this.formatReadingTime(minutes)
        };
    }

    /**
     * 格式化阅读时间
     * @param {number} minutes - 分钟数
     * @returns {string} 格式化的时间字符串
     */
    formatReadingTime(minutes) {
        if (minutes < 1) {
            return '不到1分钟';
        } else if (minutes < 60) {
            return `${Math.ceil(minutes)}分钟`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = Math.ceil(minutes % 60);
            return `${hours}小时${remainingMinutes}分钟`;
        }
    }

    /**
     * 获取内容预览
     * @param {string} content - 内容
     * @param {number} maxLength - 最大长度，默认100
     * @returns {string} 预览文本
     */
    getPreview(content, maxLength = 100) {
        if (!content || content.length <= maxLength) {
            return content || '';
        }

        let preview = content.substring(0, maxLength);
        
        // 尝试在合适的位置截断
        const lastPunctIndex = Math.max(
            preview.lastIndexOf('。'),
            preview.lastIndexOf('！'),
            preview.lastIndexOf('？'),
            preview.lastIndexOf('\n')
        );
        
        if (lastPunctIndex > maxLength * 0.7) {
            preview = preview.substring(0, lastPunctIndex + 1);
        } else {
            preview = preview + '...';
        }
        
        return preview;
    }

    /**
     * 分析文本统计信息
     * @param {string} content - 内容
     * @returns {object} 统计信息
     */
    analyzeText(content) {
        if (!content) {
            return {
                wordCount: 0,
                paragraphCount: 0,
                lineCount: 0,
                chapterCount: 0
            };
        }

        const paragraphs = (content || '').split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const lines = (content || '').split('\n').filter(l => l.trim().length > 0);
        const wordCount = this.countWords(content);
        
        // 估算章节数
        let chapterCount = 0;
        const chapterPattern = /^第[一二三四五六七八九十百千万\d]+章|^Chapter\s+\d+/im;
        const chapterMatches = content.match(new RegExp(chapterPattern.source, 'gim'));
        chapterCount = chapterMatches ? chapterMatches.length : Math.ceil(paragraphs.length / 50);

        return {
            wordCount: wordCount,
            paragraphCount: paragraphs.length,
            lineCount: lines.length,
            chapterCount: chapterCount,
            estimatedReadingTime: this.estimateReadingTime(content)
        };
    }
}

export { TextProcessor };