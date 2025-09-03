import fs from 'fs';
import path from 'path';

class ResponseManager {
    constructor() {
        this.responsesDir = path.join(process.cwd(), 'responses');
        if (!fs.existsSync(this.responsesDir)) {
            fs.mkdirSync(this.responsesDir, { recursive: true });
        }
    }

    listResponses() {
        try {
            const files = fs.readdirSync(this.responsesDir);
            return files.filter(file => path.extname(file) === '.json');
        } catch (error) {
            console.error('读取响应列表失败:', error);
            return [];
        }
    }

    saveResponse(fileName, content) {
        try {
            const filePath = path.join(this.responsesDir, fileName);
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('保存响应失败:', error);
            return false;
        }
    }

    deleteResponse(fileName) {
        try {
            const filePath = path.join(this.responsesDir, fileName);
            fs.unlinkSync(filePath);
            return true;
        } catch (error) {
            console.error('删除响应失败:', error);
            return false;
        }
    }

    getResponseContent(fileName) {
        try {
            const filePath = path.join(this.responsesDir, fileName);
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('读取响应内容失败:', error);
            return null;
        }
    }
}

export default ResponseManager;