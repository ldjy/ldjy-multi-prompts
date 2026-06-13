// 定義預設的 5 個不同的 Prompt 任務
const defaultTasks = [
    {
        id: 0,
        title: "📝 重點摘要",
        systemInstruction: "你是一個專業的編輯。請將使用者輸入的文字摘要成 3 到 5 個重點條列（Bullet points），不要過多的廢話。",
        temperature: 0.2
    },
    {
        id: 1,
        title: "🇺🇸 翻譯成英文",
        systemInstruction: "你是一個專業的翻譯。請將使用者輸入的文字翻譯成道地、流暢的商業英文。只輸出翻譯結果即可。",
        temperature: 0.1
    },
    {
        id: 2,
        title: "🔑 提取關鍵字",
        systemInstruction: "請從使用者輸入的文字中，提取出 5-10 個最重要的關鍵字或標籤 (Tags)，以逗號分隔。",
        temperature: 0.1
    },
    {
        id: 3,
        title: "👔 語氣轉換 (正式/專業)",
        systemInstruction: "請將使用者輸入的文字，改寫成極度正式、專業的商業書信語氣，適合寄給客戶或高階主管。",
        temperature: 0.4
    },
    {
        id: 4,
        title: "📱 社群貼文產生器",
        systemInstruction: "你是一位社群小編。請將使用者輸入的文字改寫成一篇適合發布在 Facebook 或 Instagram 的活潑貼文，請加上適當的 Emoji，並在結尾加上三個 Hashtag。",
        temperature: 0.7
    }
];

// 載入自訂任務或使用預設任務
let tasks = JSON.parse(localStorage.getItem('gemini_custom_tasks')) || defaultTasks;

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const userInput = document.getElementById('userInput');
    const executeBtn = document.getElementById('executeBtn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    const resultsSection = document.getElementById('resultsSection');

    // Modal elements
    const settingsModal = document.getElementById('settingsModal');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const saveTasksBtn = document.getElementById('saveTasksBtn');
    const tasksFormContainer = document.getElementById('tasksFormContainer');

    // 載入儲存的 API Key 與草稿
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    const savedInput = localStorage.getItem('gemini_user_input');
    if (savedInput) {
        userInput.value = savedInput;
    }

    // 當輸入文字時自動儲存草稿
    userInput.addEventListener('input', () => {
        localStorage.setItem('gemini_user_input', userInput.value);
    });

    // 初始化任務卡片標題與複製按鈕
    function initTaskUI() {
        tasks.forEach(task => {
            const titleEl = document.getElementById(`title-${task.id}`);
            if (titleEl) titleEl.innerText = task.title;
        });
    }

    // 初始化一次
    initTaskUI();

    tasks.forEach(task => {
        const copyBtn = document.getElementById(`copy-${task.id}`);
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const textToCopy = copyBtn.getAttribute('data-raw-text');
                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const originalHTML = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.innerHTML = originalHTML;
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    });
                }
            });
        }
    });

    // 渲染設定 Modal 表單
    function renderSettingsForm() {
        tasksFormContainer.innerHTML = '';
        tasks.forEach((task, index) => {
            const card = document.createElement('div');
            card.className = 'task-edit-card';
            card.innerHTML = `
                <h4>任務 ${index + 1}</h4>
                <label>按鈕與卡片標題</label>
                <input type="text" id="edit-title-${task.id}" value="${task.title}" placeholder="例如：📝 重點摘要">
                <label>給 AI 的系統提示詞 (System Prompt)</label>
                <textarea id="edit-prompt-${task.id}" rows="3" placeholder="告訴 AI 它應該扮演什麼角色以及要做什麼...">${task.systemInstruction}</textarea>
            `;
            tasksFormContainer.appendChild(card);
        });
    }

    // 開關 Modal
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            renderSettingsForm();
            settingsModal.style.display = 'flex';
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }

    // 儲存設定
    if (saveTasksBtn) {
        saveTasksBtn.addEventListener('click', () => {
            tasks.forEach(task => {
                task.title = document.getElementById(`edit-title-${task.id}`).value.trim() || task.title;
                task.systemInstruction = document.getElementById(`edit-prompt-${task.id}`).value.trim() || task.systemInstruction;
            });
            localStorage.setItem('gemini_custom_tasks', JSON.stringify(tasks));
            initTaskUI();
            settingsModal.style.display = 'none';
        });
    }


    executeBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const text = userInput.value.trim();

        if (!apiKey) {
            alert('請輸入 Gemini API Key');
            apiKeyInput.focus();
            return;
        }

        if (!text) {
            alert('請輸入要處理的文字');
            userInput.focus();
            return;
        }

        // 儲存 API Key
        localStorage.setItem('gemini_api_key', apiKey);

        // UI 狀態更新
        executeBtn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        resultsSection.style.display = 'flex';

        // 重置所有卡片狀態
        tasks.forEach(task => {
            const statusIndicator = document.getElementById(`status-${task.id}`);
            const contentDiv = document.getElementById(`content-${task.id}`);
            const copyBtn = document.getElementById(`copy-${task.id}`);
            statusIndicator.className = 'status-indicator loading';
            contentDiv.innerHTML = '正在處理中...';
            if(copyBtn) copyBtn.style.display = 'none';
        });

        try {
            // 同時發送 5 個請求
            const promises = tasks.map(task => callGeminiAPI(apiKey, text, task));
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('整體執行發生錯誤', error);
        } finally {
            // 恢復按鈕狀態
            executeBtn.disabled = false;
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
        }
    });

    async function callGeminiAPI(apiKey, text, task) {
        const statusIndicator = document.getElementById(`status-${task.id}`);
        const contentDiv = document.getElementById(`content-${task.id}`);

        try {
            // 使用最新的 Gemini Flash 模型 (Alias)
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
            
            const payload = {
                contents: [
                    {
                        parts: [
                            { text: `System Instruction: ${task.systemInstruction}\n\nUser Input: ${text}` }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: task.temperature,
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
                const markdownText = data.candidates[0].content.parts[0].text;
                // 解析 markdown
                contentDiv.innerHTML = marked.parse(markdownText);
                statusIndicator.className = 'status-indicator success';
                
                // 顯示複製按鈕並儲存文字
                const copyBtn = document.getElementById(`copy-${task.id}`);
                if (copyBtn) {
                    copyBtn.setAttribute('data-raw-text', markdownText);
                    copyBtn.style.display = 'flex';
                }
            } else {
                throw new Error('未取得有效的回傳內容');
            }

        } catch (error) {
            console.error(`Task ${task.id} Error:`, error);
            contentDiv.innerHTML = `<div style="color: var(--error);">錯誤：${error.message}</div>`;
            statusIndicator.className = 'status-indicator error';
        }
    }
});
