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
    },
    {
        id: 5,
        title: "🤔 反方辯論",
        systemInstruction: "你是一個專業的辯論家。請針對使用者輸入的觀點，提出三個強而有力的反對意見或盲點分析。",
        temperature: 0.6
    },
    {
        id: 6,
        title: "📚 延伸閱讀",
        systemInstruction: "請針對使用者輸入的主題，推薦 5 個適合深入研究的專有名詞或延伸閱讀方向。",
        temperature: 0.3
    }
];

// 載入自訂任務或使用預設任務
let tasks = JSON.parse(localStorage.getItem('gemini_custom_tasks'));
if (!tasks) {
    tasks = defaultTasks;
} else if (tasks.length < 7) {
    // 升級：如果舊版只有 5 個任務，自動補齊到 7 個
    for (let i = tasks.length; i < 7; i++) {
        tasks.push(defaultTasks[i]);
    }
    localStorage.setItem('gemini_custom_tasks', JSON.stringify(tasks));
}

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
        resultsSection.innerHTML = ''; // 清空先前的結果

        // 過濾掉 prompt 或標題為空的任務 (直接跳過)
        const activeTasks = tasks.filter(task => task.systemInstruction.trim() !== '' && task.title.trim() !== '');

        if (activeTasks.length === 0) {
            resultsSection.innerHTML = '<div style="text-align:center; padding: 2rem; color:var(--text-muted);">所有任務的 Prompt 皆為空，已跳過執行。請至右上角設定任務。</div>';
            executeBtn.disabled = false;
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
            return;
        }

        // 動態生成只有啟用的卡片
        activeTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'result-card glass-panel';
            card.id = `card-${task.id}`;
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="task-title" id="title-${task.id}">${task.title}</h3>
                    <div class="header-actions">
                        <button class="copy-btn" id="copy-${task.id}" title="複製結果" style="display: none;">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <div class="status-indicator loading" id="status-${task.id}"></div>
                    </div>
                </div>
                <div class="result-content markdown-body" id="content-${task.id}">正在處理中...</div>
            `;
            resultsSection.appendChild(card);

            // 綁定動態生成的複製按鈕事件
            const copyBtn = card.querySelector(`#copy-${task.id}`);
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
        });

        try {
            // 錯開每個請求的發送時間 (每個延遲 400 毫秒) 來避免一次性觸發 Google API 的併發次數限制
            const promises = activeTasks.map((task, index) => {
                return new Promise(resolve => {
                    setTimeout(async () => {
                        await callGeminiAPI(apiKey, text, task);
                        resolve();
                    }, index * 400); // 0ms, 400ms, 800ms...
                });
            });
            await Promise.all(promises);
        } catch (error) {
            console.error('整體執行發生錯誤', error);
        } finally {
            // 恢復按鈕狀態
            executeBtn.disabled = false;
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
        }
    });

    async function callGeminiAPI(apiKey, text, task, retries = 2) {
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
                if (response.status === 429 && retries > 0) {
                    // 如果遇到 429 Rate Limit 錯誤，等待 3 秒後自動重試
                    contentDiv.innerHTML = '<span style="color:var(--text-muted);">觸發次數限制，自動重新嘗試中...</span>';
                    await new Promise(r => setTimeout(r, 3000));
                    return callGeminiAPI(apiKey, text, task, retries - 1);
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `伺服器回應錯誤 (HTTP ${response.status})`);
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
