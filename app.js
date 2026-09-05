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
    },
    {
        id: 7,
        title: "💡 腦力激盪",
        systemInstruction: "你是一個創意總監。請根據使用者提供的想法或主題，發想出 3 到 5 個創新、有趣的擴充點子或應用場景。",
        temperature: 0.8
    },
    {
        id: 8,
        title: "✍️ 錯字與語句潤飾",
        systemInstruction: "你是一個專業的校稿人員。請幫忙抓出使用者輸入文字中的錯別字，並將語句潤飾得更通順、易讀。請直接輸出修改後的完整文字即可。",
        temperature: 0.1
    },
    {
        id: 9,
        title: "📊 情感與重點分析",
        systemInstruction: "請分析使用者輸入文字背後隱含的情感（例如：正面、負面、客觀、憤怒等），並用一句話總結這段文字的核心態度。",
        temperature: 0.3
    }
];

function cloneTasks(tasksList) {
    return JSON.parse(JSON.stringify(tasksList));
}

// 載入應用程式狀態 (支援 Tab A 與 Tab B 雙分頁架構)
let appState = JSON.parse(localStorage.getItem('gemini_app_state'));

if (!appState || !appState.tabs) {
    // 檢查舊版單一分頁儲存結構進行無縫遷移
    let legacyTasks = JSON.parse(localStorage.getItem('gemini_custom_tasks'));
    if (!legacyTasks) {
        legacyTasks = cloneTasks(defaultTasks);
    } else if (legacyTasks.length < 10) {
        for (let i = legacyTasks.length; i < 10; i++) {
            legacyTasks.push(cloneTasks(defaultTasks[i]));
        }
    }
    const legacyInput = localStorage.getItem('gemini_user_input') || '';

    appState = {
        activeTab: 'tabA',
        tabs: {
            tabA: {
                name: '任務組 A',
                input: legacyInput,
                tasks: legacyTasks,
                results: null
            },
            tabB: {
                name: '任務組 B',
                input: '',
                tasks: cloneTasks(legacyTasks),
                results: null
            }
        }
    };
    localStorage.setItem('gemini_app_state', JSON.stringify(appState));
} else {
    // 確保雙分頁結構完整
    if (!appState.tabs.tabA) {
        appState.tabs.tabA = { name: '任務組 A', input: '', tasks: cloneTasks(defaultTasks), results: null };
    }
    if (!appState.tabs.tabB) {
        appState.tabs.tabB = { name: '任務組 B', input: '', tasks: cloneTasks(appState.tabs.tabA.tasks || defaultTasks), results: null };
    }
    ['tabA', 'tabB'].forEach(key => {
        const t = appState.tabs[key];
        if (!t.tasks || t.tasks.length < 10) {
            t.tasks = t.tasks || [];
            for (let i = t.tasks.length; i < 10; i++) {
                t.tasks.push(cloneTasks(defaultTasks[i]));
            }
        }
    });
}

function saveAppState() {
    localStorage.setItem('gemini_app_state', JSON.stringify(appState));
}

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const userInput = document.getElementById('userInput');
    const clearInputBtn = document.getElementById('clearInputBtn');
    const executeBtn = document.getElementById('executeBtn');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');
    const resultsSection = document.getElementById('resultsSection');

    // Tab 導覽列按鈕
    const tabBtnA = document.getElementById('tabBtnA');
    const tabBtnB = document.getElementById('tabBtnB');

    // Modal elements
    const settingsModal = document.getElementById('settingsModal');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const saveTasksBtn = document.getElementById('saveTasksBtn');
    const tasksFormContainer = document.getElementById('tasksFormContainer');
    const modalTabBtnA = document.getElementById('modalTabBtnA');
    const modalTabBtnB = document.getElementById('modalTabBtnB');
    const tabNameInput = document.getElementById('tabNameInput');

    let editingModalTab = 'tabA';

    // 載入儲存的 API Key
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // 模型選擇相關元素
    const modelSelect = document.getElementById('modelSelect');
    const refreshModelsBtn = document.getElementById('refreshModelsBtn');
    const customModelInput = document.getElementById('customModelInput');
    const modelHelpText = document.getElementById('modelHelpText');

    function getActiveModel() {
        let selected = modelSelect?.value || 'gemini-2.0-flash';
        if (selected === 'custom') {
            selected = customModelInput?.value.trim() || 'gemini-2.0-flash';
        }
        return selected.replace('models/', '');
    }

    // 載入儲存的模型
    const savedModel = localStorage.getItem('gemini_selected_model');
    if (savedModel && modelSelect) {
        const match = Array.from(modelSelect.options).some(o => o.value === savedModel);
        if (match) {
            modelSelect.value = savedModel;
        } else {
            const opt = document.createElement('option');
            opt.value = savedModel;
            opt.textContent = `${savedModel} (已儲存)`;
            const customOpt = modelSelect.querySelector('option[value="custom"]');
            if (customOpt) {
                modelSelect.insertBefore(opt, customOpt);
            } else {
                modelSelect.appendChild(opt);
            }
            modelSelect.value = savedModel;
        }
    }

    const savedCustomModel = localStorage.getItem('gemini_custom_model_id');
    if (savedCustomModel && customModelInput) {
        customModelInput.value = savedCustomModel;
    }

    if (modelSelect && customModelInput) {
        if (modelSelect.value === 'custom') {
            customModelInput.style.display = 'block';
        }
        modelSelect.addEventListener('change', () => {
            if (modelSelect.value === 'custom') {
                customModelInput.style.display = 'block';
                customModelInput.focus();
            } else {
                customModelInput.style.display = 'none';
            }
            localStorage.setItem('gemini_selected_model', modelSelect.value);
        });
    }

    if (customModelInput) {
        customModelInput.addEventListener('input', () => {
            localStorage.setItem('gemini_custom_model_id', customModelInput.value.trim());
        });
    }

    async function fetchAvailableModels(apiKey, isManual = false) {
        if (!apiKey) {
            if (isManual) alert('請先輸入 Gemini API Key 後再重新載入模型清單！');
            return;
        }

        if (modelHelpText) {
            modelHelpText.textContent = '⏳ 正在向 Google 查詢可用模型清單...';
            modelHelpText.style.color = 'var(--text-muted)';
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.models && Array.isArray(data.models)) {
                // 篩選支援 generateContent 且名稱包含 gemini 的模型
                const geminiModels = data.models.filter(m => 
                    m.supportedGenerationMethods && 
                    m.supportedGenerationMethods.includes('generateContent') &&
                    m.name.toLowerCase().includes('gemini')
                );

                if (geminiModels.length > 0) {
                    const currentSelected = localStorage.getItem('gemini_selected_model') || modelSelect.value || 'gemini-2.0-flash';

                    modelSelect.innerHTML = '';
                    
                    // 排序：將 flash / lite 類熱門模型置頂
                    geminiModels.sort((a, b) => {
                        const nameA = a.name.toLowerCase();
                        const nameB = b.name.toLowerCase();
                        if (nameA.includes('2.5-flash') && !nameB.includes('2.5-flash')) return -1;
                        if (!nameA.includes('2.5-flash') && nameB.includes('2.5-flash')) return 1;
                        if (nameA.includes('2.0-flash') && !nameB.includes('2.0-flash')) return -1;
                        if (!nameA.includes('2.0-flash') && nameB.includes('2.0-flash')) return 1;
                        if (nameA.includes('flash') && !nameB.includes('flash')) return -1;
                        if (!nameA.includes('flash') && nameB.includes('flash')) return 1;
                        return nameA.localeCompare(nameB);
                    });

                    geminiModels.forEach(m => {
                        const cleanId = m.name.replace('models/', '');
                        const opt = document.createElement('option');
                        opt.value = cleanId;
                        opt.textContent = `${m.displayName || cleanId} (${cleanId})`;
                        modelSelect.appendChild(opt);
                    });

                    const customOpt = document.createElement('option');
                    customOpt.value = 'custom';
                    customOpt.textContent = '✏️ 自訂輸入模型代號...';
                    modelSelect.appendChild(customOpt);

                    const hasMatch = Array.from(modelSelect.options).some(o => o.value === currentSelected);
                    if (hasMatch) {
                        modelSelect.value = currentSelected;
                    } else if (currentSelected === 'custom') {
                        modelSelect.value = 'custom';
                    } else {
                        const extraOpt = document.createElement('option');
                        extraOpt.value = currentSelected;
                        extraOpt.textContent = `${currentSelected} (已儲存)`;
                        modelSelect.insertBefore(extraOpt, customOpt);
                        modelSelect.value = currentSelected;
                    }

                    if (modelHelpText) {
                        modelHelpText.textContent = `✅ 已成功向 Google 載入 ${geminiModels.length} 個可用模型！`;
                        modelHelpText.style.color = 'var(--success)';
                    }

                    if (isManual) {
                        alert(`成功載入 ${geminiModels.length} 個 Google Gemini 模型！`);
                    }
                } else {
                    throw new Error('未找到支援文字生成的 Gemini 模型');
                }
            }
        } catch (error) {
            console.warn('載入 Google 模型清單失敗：', error);
            if (modelHelpText) {
                modelHelpText.textContent = `⚠️ 模型查詢失敗（${error.message}），已保留目前選單。`;
                modelHelpText.style.color = 'var(--error)';
            }
            if (isManual) {
                alert(`查詢失敗：${error.message}\n已保留目前的模型清單。`);
            }
        }
    }

    if (refreshModelsBtn) {
        refreshModelsBtn.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();
            fetchAvailableModels(apiKey, true);
        });
    }

    // 當 API Key 輸入或變更時，自動抓取一次模型清單
    if (savedApiKey) {
        fetchAvailableModels(savedApiKey, false);
    }
    apiKeyInput.addEventListener('change', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            fetchAvailableModels(key, false);
        }
    });

    // 初始化 Tab 按鈕文字與 active 狀態
    function updateTabButtonsUI() {
        if (tabBtnA) tabBtnA.textContent = appState.tabs.tabA.name || '任務組 A';
        if (tabBtnB) tabBtnB.textContent = appState.tabs.tabB.name || '任務組 B';

        if (appState.activeTab === 'tabA') {
            tabBtnA?.classList.add('active');
            tabBtnB?.classList.remove('active');
        } else {
            tabBtnB?.classList.add('active');
            tabBtnA?.classList.remove('active');
        }
    }

    // 載入當前 Tab 的輸入文字
    function loadCurrentTabInput() {
        const curTab = appState.tabs[appState.activeTab];
        userInput.value = curTab.input || '';
    }

    // 還原指定 Tab 的結果卡片
    function restoreResultsUI(tabKey) {
        const tabData = appState.tabs[tabKey];
        resultsSection.innerHTML = '';

        if (!tabData.results || tabData.results.length === 0) {
            resultsSection.style.display = 'none';
            return;
        }

        resultsSection.style.display = 'flex';
        tabData.results.forEach(res => {
            const card = document.createElement('div');
            card.className = 'result-card glass-panel';
            card.id = `card-${res.taskId}`;
            card.innerHTML = `
                <div class="card-header">
                    <h3 class="task-title">${res.title}</h3>
                    <div class="header-actions">
                        <button class="copy-btn" id="copy-${res.taskId}" title="複製結果" style="${res.rawText ? 'display: flex;' : 'display: none;'}">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <div class="status-indicator ${res.status || 'success'}"></div>
                    </div>
                </div>
                <div class="result-content markdown-body">${res.html || res.rawText || ''}</div>
            `;
            resultsSection.appendChild(card);

            const copyBtn = card.querySelector(`#copy-${res.taskId}`);
            if (copyBtn && res.rawText) {
                copyBtn.setAttribute('data-raw-text', res.rawText);
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
    }

    // 切換主畫面 Tab
    function switchMainTab(targetTab) {
        if (appState.activeTab === targetTab) return;
        // 儲存當前輸入框文字
        appState.tabs[appState.activeTab].input = userInput.value;
        appState.activeTab = targetTab;
        saveAppState();

        updateTabButtonsUI();
        loadCurrentTabInput();
        restoreResultsUI(targetTab);
    }

    if (tabBtnA) tabBtnA.addEventListener('click', () => switchMainTab('tabA'));
    if (tabBtnB) tabBtnB.addEventListener('click', () => switchMainTab('tabB'));

    // 初始化介面狀態
    updateTabButtonsUI();
    loadCurrentTabInput();
    restoreResultsUI(appState.activeTab);

    // 當輸入文字時自動儲存到當前 Tab
    userInput.addEventListener('input', () => {
        appState.tabs[appState.activeTab].input = userInput.value;
        saveAppState();
    });

    // 清空輸入文字按鈕 (僅清空當前 Tab)
    if (clearInputBtn) {
        clearInputBtn.addEventListener('click', () => {
            userInput.value = '';
            appState.tabs[appState.activeTab].input = '';
            saveAppState();
            userInput.focus();
        });
    }

    // Modal 表單資料暫存同步
    function flushModalInputsToState() {
        const curTab = appState.tabs[editingModalTab];
        if (tabNameInput && tabNameInput.value.trim()) {
            curTab.name = tabNameInput.value.trim();
        }
        curTab.tasks.forEach(task => {
            const titleEl = document.getElementById(`edit-title-${task.id}`);
            const promptEl = document.getElementById(`edit-prompt-${task.id}`);
            if (titleEl) task.title = titleEl.value.trim();
            if (promptEl) task.systemInstruction = promptEl.value.trim();
        });
    }

    // 渲染設定 Modal 表單
    function renderSettingsForm() {
        if (modalTabBtnA) modalTabBtnA.textContent = appState.tabs.tabA.name || '任務組 A';
        if (modalTabBtnB) modalTabBtnB.textContent = appState.tabs.tabB.name || '任務組 B';

        if (editingModalTab === 'tabA') {
            modalTabBtnA?.classList.add('active');
            modalTabBtnB?.classList.remove('active');
        } else {
            modalTabBtnB?.classList.add('active');
            modalTabBtnA?.classList.remove('active');
        }

        const curTab = appState.tabs[editingModalTab];
        if (tabNameInput) {
            tabNameInput.value = curTab.name || '';
        }

        tasksFormContainer.innerHTML = '';
        curTab.tasks.forEach((task, index) => {
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

    // Modal 分頁切換
    function switchModalTab(targetTab) {
        if (editingModalTab === targetTab) return;
        flushModalInputsToState();
        editingModalTab = targetTab;
        renderSettingsForm();
    }

    if (modalTabBtnA) modalTabBtnA.addEventListener('click', () => switchModalTab('tabA'));
    if (modalTabBtnB) modalTabBtnB.addEventListener('click', () => switchModalTab('tabB'));

    // 開關 Modal
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            editingModalTab = appState.activeTab;
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
            flushModalInputsToState();
            saveAppState();
            updateTabButtonsUI();
            settingsModal.style.display = 'none';
        });
    }

    // 匯出 / 備份 Prompt
    const exportPromptsBtn = document.getElementById('exportPromptsBtn');
    if (exportPromptsBtn) {
        exportPromptsBtn.addEventListener('click', () => {
            flushModalInputsToState();
            const currentTabPrompts = appState.tabs[editingModalTab].tasks;
            const jsonText = JSON.stringify(currentTabPrompts, null, 2);
            navigator.clipboard.writeText(jsonText).then(() => {
                alert(`已複製「${appState.tabs[editingModalTab].name}」的 10 個 Prompt 備份至剪貼簿！\n您可以將它貼在筆記本中保存。`);
            }).catch(() => {
                prompt('請手動複製以下備份代碼：', jsonText);
            });
        });
    }

    // 匯入 Prompt 備份
    const importPromptsBtn = document.getElementById('importPromptsBtn');
    if (importPromptsBtn) {
        importPromptsBtn.addEventListener('click', () => {
            const pasteData = prompt('請貼上您先前備份的 Prompt 代碼 (JSON 格式)：');
            if (!pasteData || !pasteData.trim()) return;

            try {
                const parsed = JSON.parse(pasteData.trim());
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    alert('格式錯誤：備份內容應為任務陣列。');
                    return;
                }
                const curTasks = appState.tabs[editingModalTab].tasks;
                parsed.forEach((item, idx) => {
                    if (idx < 10) {
                        curTasks[idx] = {
                            id: idx,
                            title: item.title !== undefined ? item.title : (defaultTasks[idx]?.title || `任務 ${idx + 1}`),
                            systemInstruction: item.systemInstruction !== undefined ? item.systemInstruction : '',
                            temperature: item.temperature !== undefined ? item.temperature : 0.3
                        };
                    }
                });
                renderSettingsForm();
                alert(`已成功將備份載入至「${appState.tabs[editingModalTab].name}」！請記得點擊右下角「儲存設定」。`);
            } catch (e) {
                alert('解析失敗，請確認貼上的文字格式正確。');
            }
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

        // 當前 Tab 的任務清單
        const currentTasks = appState.tabs[appState.activeTab].tasks;

        // UI 狀態更新
        executeBtn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        resultsSection.style.display = 'flex';
        resultsSection.innerHTML = '';

        // 過濾掉 prompt 或標題為空的任務 (直接跳過)
        const activeTasks = currentTasks.filter(task => task.systemInstruction.trim() !== '' && task.title.trim() !== '');

        if (activeTasks.length === 0) {
            resultsSection.innerHTML = '<div style="text-align:center; padding: 2rem; color:var(--text-muted);">所有任務的 Prompt 皆為空，已跳過執行。請至右上角設定任務。</div>';
            executeBtn.disabled = false;
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
            appState.tabs[appState.activeTab].results = [];
            saveAppState();
            return;
        }

        // 初始化當前 Tab 結果暫存
        const runResults = [];

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
            // 錯開每個請求的發送時間 (每個延遲 600 毫秒) 來避免一次性觸發 Google API 的併發次數限制
            const promises = activeTasks.map((task, index) => {
                return new Promise(resolve => {
                    setTimeout(async () => {
                        const resObj = await callGeminiAPI(apiKey, text, task);
                        if (resObj) runResults.push(resObj);
                        resolve();
                    }, index * 600);
                });
            });
            await Promise.all(promises);

            // 依任務 ID 排序並持久化保存到當前 Tab
            runResults.sort((a, b) => a.taskId - b.taskId);
            appState.tabs[appState.activeTab].results = runResults;
            saveAppState();
        } catch (error) {
            console.error('整體執行發生錯誤', error);
        } finally {
            executeBtn.disabled = false;
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
        }
    });

    async function callGeminiAPI(apiKey, text, task, retries = 4) {
        const statusIndicator = document.getElementById(`status-${task.id}`);
        const contentDiv = document.getElementById(`content-${task.id}`);
        const copyBtn = document.getElementById(`copy-${task.id}`);

        try {
            const activeModel = getActiveModel();
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`;
            
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
                    contentDiv.innerHTML = '<span style="color:var(--text-muted);">免費額度限制，等待 8 秒後重新嘗試中...</span>';
                    await new Promise(r => setTimeout(r, 8000));
                    return callGeminiAPI(apiKey, text, task, retries - 1);
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `伺服器回應錯誤 (HTTP ${response.status})`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
                const markdownText = data.candidates[0].content.parts[0].text;
                const parsedHtml = marked.parse(markdownText);
                contentDiv.innerHTML = parsedHtml;
                statusIndicator.className = 'status-indicator success';
                
                if (copyBtn) {
                    copyBtn.setAttribute('data-raw-text', markdownText);
                    copyBtn.style.display = 'flex';
                }

                return {
                    taskId: task.id,
                    title: task.title,
                    rawText: markdownText,
                    html: parsedHtml,
                    status: 'success'
                };
            } else {
                throw new Error('未取得有效的回傳內容');
            }

        } catch (error) {
            console.error(`Task ${task.id} Error:`, error);
            const errHtml = `<div style="color: var(--error);">錯誤：${error.message}</div>`;
            contentDiv.innerHTML = errHtml;
            statusIndicator.className = 'status-indicator error';

            return {
                taskId: task.id,
                title: task.title,
                rawText: '',
                html: errHtml,
                status: 'error'
            };
        }
    }
});
