// ui/progressBar.js
// 进度条组件
import { emitEvent } from '../utils/events.js';

const extensionName = 'novel-injector';

class ProgressBar {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            showPercentage: true,
            showText: true,
            animated: false,
            color: '#007bff',
            backgroundColor: '#e9ecef',
            height: '20px',
            borderRadius: '4px',
            ...options
        };
        
        this.value = 0;
        this.max = 100;
        this.text = '';
        this.animationId = null;
        
        if (this.container) {
            this.init();
        }
    }

    /**
     * 初始化进度条
     */
    init() {
        this.render();
    }

    /**
     * 渲染进度条
     */
    render() {
        if (!this.container) return;

        const percentage = this.max > 0 ? Math.round((this.value / this.max) * 100) : 0;
        
        this.container.innerHTML = `
            <div class="novel-progress-bar" style="
                width: 100%;
                height: ${this.options.height};
                background-color: ${this.options.backgroundColor};
                border-radius: ${this.options.borderRadius};
                overflow: hidden;
                position: relative;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
            ">
                <div class="progress-fill" style="
                    width: ${percentage}%;
                    height: 100%;
                    background-color: ${this.options.color};
                    transition: width 0.3s ease-in-out;
                    position: relative;
                    ${this.options.animated ? this.getAnimationCSS() : ''}
                "></div>
                
                ${this.options.showPercentage || this.options.showText ? `
                    <div class="progress-label" style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 12px;
                        font-weight: 500;
                        color: ${this.getLabelColor(percentage)};
                        white-space: nowrap;
                        z-index: 2;
                        text-shadow: 0 0 3px rgba(0,0,0,0.3);
                    ">
                        ${this.getLabel(percentage)}
                    </div>
                ` : ''}
            </div>
        `;

        // 触发更新事件
        emitEvent('progressUpdated', {
            value: this.value,
            max: this.max,
            percentage: percentage,
            text: this.text
        });
    }

    /**
     * 获取动画CSS
     */
    getAnimationCSS() {
        return `
            background-image: linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.15) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.15) 50%,
                rgba(255, 255, 255, 0.15) 75%,
                transparent 75%,
                transparent
            );
            background-size: 20px 20px;
            animation: progress-bar-stripes 1s linear infinite;
        `;
    }

    /**
     * 获取标签颜色（根据背景选择合适的文字颜色）
     */
    getLabelColor(percentage) {
        // 如果进度大于50%，使用白色文字，否则使用深色文字
        return percentage > 50 ? '#ffffff' : '#333333';
    }

    /**
     * 获取标签文本
     */
    getLabel(percentage) {
        let label = '';
        
        if (this.options.showPercentage) {
            label += `${percentage}%`;
        }
        
        if (this.options.showText && this.text) {
            label += this.options.showPercentage ? ` - ${this.text}` : this.text;
        }
        
        return label;
    }

    /**
     * 设置进度值
     * @param {number} value - 进度值
     * @param {boolean} animate - 是否动画
     */
    setValue(value, animate = true) {
        const oldValue = this.value;
        this.value = Math.max(0, Math.min(value, this.max));
        
        if (animate && oldValue !== this.value) {
            this.animateToValue(oldValue, this.value);
        } else {
            this.render();
        }
    }

    /**
     * 设置最大值
     * @param {number} max - 最大值
     */
    setMax(max) {
        this.max = Math.max(1, max);
        this.render();
    }

    /**
     * 设置文本
     * @param {string} text - 文本内容
     */
    setText(text) {
        this.text = text || '';
        this.render();
    }

    /**
     * 设置颜色
     * @param {string} color - 颜色值
     */
    setColor(color) {
        this.options.color = color;
        this.render();
    }

    /**
     * 同时设置多个值
     * @param {object} values - 值对象 {value, max, text}
     */
    setValues(values) {
        if (values.max !== undefined) {
            this.max = Math.max(1, values.max);
        }
        if (values.text !== undefined) {
            this.text = values.text || '';
        }
        if (values.value !== undefined) {
            this.setValue(values.value, values.animate !== false);
        } else {
            this.render();
        }
    }

    /**
     * 动画到指定值
     * @param {number} from - 起始值
     * @param {number} to - 目标值
     */
    animateToValue(from, to) {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const duration = 500; // 动画持续时间
        const startTime = performance.now();
        const diff = to - from;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用缓动函数
            const easedProgress = this.easeInOutQuad(progress);
            const currentValue = from + (diff * easedProgress);
            
            // 更新显示
            this.updateDisplay(currentValue);
            
            if (progress < 1) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.animationId = null;
                this.render(); // 最终渲染
            }
        };

        this.animationId = requestAnimationFrame(animate);
    }

    /**
     * 缓动函数
     * @param {number} t - 时间进度 (0-1)
     * @returns {number} 缓动后的进度
     */
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    /**
     * 更新显示（用于动画）
     * @param {number} currentValue - 当前值
     */
    updateDisplay(currentValue) {
        const fill = this.container.querySelector('.progress-fill');
        const label = this.container.querySelector('.progress-label');
        
        if (fill) {
            const percentage = this.max > 0 ? Math.round((currentValue / this.max) * 100) : 0;
            fill.style.width = `${percentage}%`;
            
            if (label) {
                label.textContent = this.getLabel(percentage);
                label.style.color = this.getLabelColor(percentage);
            }
        }
    }

    /**
     * 增加进度
     * @param {number} increment - 增量
     */
    increment(increment = 1) {
        this.setValue(this.value + increment);
    }

    /**
     * 减少进度
     * @param {number} decrement - 减量
     */
    decrement(decrement = 1) {
        this.setValue(this.value - decrement);
    }

    /**
     * 重置进度
     */
    reset() {
        this.setValue(0);
    }

    /**
     * 设置为完成状态
     */
    complete() {
        this.setValue(this.max);
    }

    /**
     * 获取百分比
     * @returns {number} 百分比值
     */
    getPercentage() {
        return this.max > 0 ? Math.round((this.value / this.max) * 100) : 0;
    }

    /**
     * 是否已完成
     * @returns {boolean} 是否完成
     */
    isComplete() {
        return this.value >= this.max;
    }

    /**
     * 设置为不确定状态（显示加载动画）
     * @param {boolean} indeterminate - 是否为不确定状态
     */
    setIndeterminate(indeterminate) {
        const fill = this.container.querySelector('.progress-fill');
        if (!fill) return;

        if (indeterminate) {
            fill.style.width = '30%';
            fill.style.animation = 'progress-indeterminate 2s ease-in-out infinite';
        } else {
            fill.style.animation = this.options.animated ? 'progress-bar-stripes 1s linear infinite' : 'none';
            this.render();
        }
    }

    /**
     * 添加CSS动画样式
     */
    addAnimationStyles() {
        if (document.getElementById('progress-bar-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'progress-bar-styles';
        style.textContent = `
            @keyframes progress-bar-stripes {
                0% { background-position: 0 0; }
                100% { background-position: 20px 0; }
            }
            
            @keyframes progress-indeterminate {
                0% { 
                    left: -30%; 
                    width: 30%; 
                }
                50% { 
                    left: 50%; 
                    width: 30%; 
                }
                100% { 
                    left: 100%; 
                    width: 30%; 
                }
            }
            
            .progress-fill {
                position: relative;
            }
            
            .novel-progress-bar {
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 销毁进度条
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

/**
 * 创建简单的进度条
 * @param {string} containerId - 容器ID
 * @param {object} options - 选项
 * @returns {ProgressBar} 进度条实例
 */
export function createProgressBar(containerId, options = {}) {
    return new ProgressBar(containerId, options);
}

/**
 * 创建圆形进度条
 * @param {string} containerId - 容器ID
 * @param {object} options - 选项
 * @returns {CircularProgressBar} 圆形进度条实例
 */
export function createCircularProgressBar(containerId, options = {}) {
    return new CircularProgressBar(containerId, options);
}

/**
 * 圆形进度条类
 */
class CircularProgressBar {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            size: 120,
            strokeWidth: 8,
            color: '#007bff',
            backgroundColor: '#e9ecef',
            showPercentage: true,
            showText: true,
            ...options
        };
        
        this.value = 0;
        this.max = 100;
        this.text = '';
        
        if (this.container) {
            this.init();
        }
    }

    /**
     * 初始化圆形进度条
     */
    init() {
        this.render();
    }

    /**
     * 渲染圆形进度条
     */
    render() {
        if (!this.container) return;

        const percentage = this.max > 0 ? Math.round((this.value / this.max) * 100) : 0;
        const radius = (this.options.size - this.options.strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        this.container.innerHTML = `
            <div class="circular-progress" style="
                width: ${this.options.size}px;
                height: ${this.options.size}px;
                position: relative;
                display: inline-block;
            ">
                <svg width="${this.options.size}" height="${this.options.size}" style="
                    transform: rotate(-90deg);
                ">
                    <!-- 背景圆圈 -->
                    <circle
                        cx="${this.options.size / 2}"
                        cy="${this.options.size / 2}"
                        r="${radius}"
                        fill="transparent"
                        stroke="${this.options.backgroundColor}"
                        stroke-width="${this.options.strokeWidth}"
                    />
                    <!-- 进度圆圈 -->
                    <circle
                        cx="${this.options.size / 2}"
                        cy="${this.options.size / 2}"
                        r="${radius}"
                        fill="transparent"
                        stroke="${this.options.color}"
                        stroke-width="${this.options.strokeWidth}"
                        stroke-linecap="round"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${strokeDashoffset}"
                        style="
                            transition: stroke-dashoffset 0.3s ease-in-out;
                        "
                    />
                </svg>
                
                ${this.options.showPercentage || this.options.showText ? `
                    <div class="circular-progress-label" style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                        font-size: ${this.options.size / 8}px;
                        font-weight: 500;
                        color: #333;
                    ">
                        ${this.getLabel(percentage)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 获取标签文本
     */
    getLabel(percentage) {
        let label = '';
        
        if (this.options.showPercentage) {
            label += `${percentage}%`;
        }
        
        if (this.options.showText && this.text) {
            label += this.options.showPercentage ? `<br><small>${this.text}</small>` : this.text;
        }
        
        return label;
    }

    /**
     * 设置进度值
     * @param {number} value - 进度值
     */
    setValue(value) {
        this.value = Math.max(0, Math.min(value, this.max));
        this.render();
    }

    /**
     * 设置最大值
     * @param {number} max - 最大值
     */
    setMax(max) {
        this.max = Math.max(1, max);
        this.render();
    }

    /**
     * 设置文本
     * @param {string} text - 文本内容
     */
    setText(text) {
        this.text = text || '';
        this.render();
    }

    /**
     * 同时设置多个值
     * @param {object} values - 值对象
     */
    setValues(values) {
        if (values.max !== undefined) this.max = Math.max(1, values.max);
        if (values.text !== undefined) this.text = values.text || '';
        if (values.value !== undefined) this.value = Math.max(0, Math.min(values.value, this.max));
        this.render();
    }
}

export { ProgressBar, CircularProgressBar };