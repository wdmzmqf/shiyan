import fs from 'fs';
import path from 'path';

class NovelManager {
    constructor() {
        this.novelParagraphs = [];
        this.currentIndex = -1;
        this.availableNovels = [];
        this.currentChapter = '';
        this.baseDir = '';
        this.sendResponse = null;
    }

    initialize(baseDir, sendResponse) {
        this.baseDir = baseDir;
        this.sendResponse = sendResponse;
        
        const novelsDir = path.join(baseDir, 'novels');
        if (!fs.existsSync(novelsDir)) {
            fs.mkdirSync(novelsDir, { recursive: true });
        }
        
        this.scanNovels();
    }

    scanNovels() {
        const novelsDir = path.join(this.baseDir, 'novels');
        if (fs.existsSync(novelsDir)) {
            this.availableNovels = fs.readdirSync(novelsDir)
                .filter(file => path.extname(file).toLowerCase() === '.txt');
        } else {
            this.availableNovels = [];
        }
    }

    handleUpload(fileData) {
        const novelsDir = path.join(this.baseDir, 'novels');
        const fileName = fileData.name;
        const filePath = path.join(novelsDir, fileName);
        
        fs.writeFileSync(filePath, fileData.content, 'utf8');
        this.scanNovels();
    }

    handleDelete(fileName) {
        const novelsDir = path.join(this.baseDir, 'novels');
        const filePath = path.join(novelsDir, fileName);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        this.scanNovels();
    }

    loadNovel(fileName) {
        const novelsDir = path.join(this.baseDir, 'novels');
        const filePath = path.join(novelsDir, fileName);
        
        if (!fs.existsSync(filePath)) {
            return;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const chapterRegex = /^第.*章.*/gm;
        
        // 识别章节并分割段落
        const paragraphs = content.split(/\r?\n\r?\n/).filter(p => p.trim());
        this.novelParagraphs = [];
        this.currentChapter = '';
        
        let chapterMatch;
        let lastChapter = '';
        
        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            chapterMatch = paragraph.match(chapterRegex);
            
            if (chapterMatch) {
                lastChapter = chapterMatch[0];
            }
            
            this.novelParagraphs.push({
                text: paragraph,
                chapter: lastChapter
            });
        }
        
        this.currentIndex = -1;
    }

    getNextChunk(chunkSize) {
        if (this.novelParagraphs.length === 0 || this.currentIndex >= this.novelParagraphs.length - 1) {
            return null;
        }
        
        let currentText = '';
        let startPara = this.currentIndex + 1;
        let endPara = startPara;
        let chapter = '';
        
        // 累加段落直到达到指定字数
        for (let i = startPara; i < this.novelParagraphs.length; i++) {
            const para = this.novelParagraphs[i];
            if (!chapter && para.chapter) {
                chapter = para.chapter;
            }
            
            currentText += para.text + '\n\n';
            endPara = i;
            
            if (currentText.length >= chunkSize) {
                break;
            }
        }
        
        // 更新当前索引
        this.currentIndex = endPara;
        
        return {
            text: currentText.trim(),
            start_para: startPara,
            end_para: endPara,
            chapter: chapter
        };
    }

    resetProgress() {
        this.currentIndex = -1;
    }

    getSettings() {
        return {
            availableNovels: this.availableNovels,
            currentIndex: this.currentIndex
        };
    }
}

export default NovelManager;