import { eventNames } from '../utils/constants.js';

// 获取UI元素
const isEnabled = document.getElementById('isEnabled');
const responseList = document.getElementById('responseList');
const addResponse = document.getElementById('addResponse');
const editResponse = document.getElementById('editResponse');
const deleteResponse = document.getElementById('deleteResponse');
const responseModal = document.getElementById('responseModal');
const modalTitle = document.getElementById('modalTitle');
const responseForm = document.getElementById('responseForm');
const responseName = document.getElementById('responseName');
const responseContent = document.getElementById('responseContent');
const responseHotkey = document.getElementById('responseHotkey');
const responseId = document.getElementById('responseId');
const closeBtn = document.querySelector('.close');
const saveResponse = document.getElementById('saveResponse');
const cancelResponse = document.getElementById('cancelResponse');
const hotkeyBindings = document.getElementById('hotkeyBindings');

// 获取SillyTavern上下文
const context = getContext();
const ws = context.ws;

// 发送设置
function sendSettings() {
    const settings = {
        isEnabled: isEnabled.checked
    };
    
    ws.send(JSON.stringify({
        event: eventNames.SAVE_SETTINGS,
        data: settings
    }));
}

// 添加响应
function handleAddResponse() {
    modalTitle.textContent = '添加快速响应';
    responseName.value = '';
    responseContent.value = '';
    responseHotkey.value = '';
    responseId.value = '';
    responseModal.style.display = 'block';
}

// 编辑响应
function handleEditResponse() {
    if (!responseList.value) {
        alert('请选择一个响应');
        return;
    }
    
    const selectedId = parseInt(responseList.value);
    const responses = JSON.parse(localStorage.getItem('quick_response_force_responses') || '[]');
    const response = responses.find(r => r.id === selectedId);
    
    if (response) {
        modalTitle.textContent = '编辑快速响应';
        responseName.value = response.name;
        responseContent.value = response.content;
        responseId.value = response.id;
        
        const hotkeys = JSON.parse(localStorage.getItem('quick_response_force_hotkeys') || '{}');
        responseHotkey.value = hotkeys[response.id] || '';
        
        responseModal.style.display = 'block';
    }
}

// 删除响应
function handleDeleteResponse() {
    if (!responseList.value) {
        alert('请选择一个响应');
        return;
    }
    
    if (confirm('确定要删除这个快速响应吗？')) {
        ws.send(JSON.stringify({
            event: eventNames.DELETE_RESPONSE,
            data: { id: parseInt(responseList.value) }
        }));
    }
}

// 保存响应
function handleSaveResponse(e) {
    e.preventDefault();
    
    const id = responseId.value ? parseInt(responseId.value) : Date.now();
    const name = responseName.value;
    const content = responseContent.value;
    const hotkey = responseHotkey.value.toLowerCase();
    
    if (!name || !content) {
        alert('请填写名称和内容');
        return;
    }
    
    const data = { id, name, content };
    
    if (responseId.value) {
        // 编辑现有响应
        ws.send(JSON.stringify({
            event: eventNames.UPDATE_RESPONSE,
            data: data
        }));
    } else {
        // 添加新响应
        ws.send(JSON.stringify({
            event: eventNames.ADD_RESPONSE,
            data: { name, content }
        }));
    }
    
    // 如果有热键，设置热键
    if (hotkey) {
        ws.send(JSON.stringify({
            event: eventNames.SET_HOTKEY,
            data: { responseId: id, key: hotkey }
        }));
    }
    
    responseModal.style.display = 'none';
}

// 关闭模态框
function closeModal() {
    responseModal.style.display = 'none';
}

// 渲染响应列表
function renderResponseList(responses) {
    responseList.innerHTML = '';
    responses.forEach(response => {
        const option = document.createElement('option');
        option.value = response.id;
        option.textContent = response.name;
        responseList.appendChild(option);
    });
}

// 渲染热键绑定
function renderHotkeyBindings(responses, hotkeys) {
    hotkeyBindings.innerHTML = '';
    responses.forEach(response => {
        if (hotkeys[response.id]) {
            const binding = document.createElement('div');
            binding.className = 'hotkey-binding';
            binding.innerHTML = `
                <span>${response.name}: [${hotkeys[response.id].toUpperCase()}]</span>
            `;
            hotkeyBindings.appendChild(binding);
        }
    });
}

// 初始化
function initSettings() {
    // 请求当前设置
    ws.send(JSON.stringify({
        event: eventNames.GET_SETTINGS
    }));
}

// 绑定事件
function bindEvents() {
    isEnabled.addEventListener('change', sendSettings);
    addResponse.addEventListener('click', handleAddResponse);
    editResponse.addEventListener('click', handleEditResponse);
    deleteResponse.addEventListener('click', handleDeleteResponse);
    responseForm.addEventListener('submit', handleSaveResponse);
    cancelResponse.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === responseModal) {
            closeModal();
        }
    });
}

// 监听WebSocket消息
ws.addEventListener('message', function(event) {
    const message = JSON.parse(event.data);
    
    switch (message.event) {
        case eventNames.SETTINGS_UPDATE:
            isEnabled.checked = message.data.isEnabled;
            if (message.data.responses) {
                renderResponseList(message.data.responses);
                renderHotkeyBindings(message.data.responses, message.data.hotkeys || {});
            }
            break;
    }
});

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initSettings();
    bindEvents();
});