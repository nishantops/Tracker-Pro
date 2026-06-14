// =========================================================================
// AI CHAT MODULE — GPT & Gemini integration for UPSC Command Center
// Provides floating chat widget accessible from every section
// =========================================================================

const AI_CHAT = (() => {
    let isOpen = false;
    let currentProvider = 'gpt'; // 'gpt' or 'gemini'
    let chatHistory = [];
    let currentSection = 'General';

    function getApiKey(provider) {
        return localStorage.getItem(`upsc_ai_key_${provider}`) || '';
    }

    function setApiKey(provider, key) {
        localStorage.setItem(`upsc_ai_key_${provider}`, key);
    }

    function getCurrentSectionContext() {
        // Detect which section is currently visible
        const visiblePanes = document.querySelectorAll('.master-pane-view:not(.hidden), .root-pane-view:not(.hidden)');
        let context = 'User is on the UPSC CSE Command Center tracker app.\n';
        
        // Get user profile
        const name = document.getElementById('user-display-name')?.textContent || 'User';
        const age = document.getElementById('user-age-text')?.textContent || 'unknown';
        const attempt = document.getElementById('user-attempt-text')?.textContent || 'unknown';
        context += `Student: ${name}, Age: ${age}, Attempt: ${attempt}\n`;
        
        // Get progress stats
        const checked = document.getElementById('global-count-checked')?.textContent || '0';
        const total = document.getElementById('global-count-total')?.textContent || '0';
        const pct = document.getElementById('global-perc-text')?.textContent || '0%';
        context += `Progress: ${checked}/${total} topics completed (${pct})\n`;

        // Detect active section
        if (!document.getElementById('view-marathon')?.classList.contains('hidden')) {
            context += 'Currently viewing: Marathon Tracker (Syllabus, CA, PYQ, Test Series)\n';
            currentSection = 'Marathon Tracker';
        } else if (!document.getElementById('view-planner')?.classList.contains('hidden')) {
            context += 'Currently viewing: Strategy Planner\n';
            currentSection = 'Strategy Planner';
        }

        return context;
    }

    async function callGPT(message, apiKey) {
        const systemPrompt = `You are an expert UPSC CSE preparation assistant. Help the student with their queries about syllabus, strategy, current affairs, answer writing, and study planning. Be concise, actionable, and encouraging. Context:\n${getCurrentSectionContext()}`;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...chatHistory.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: message }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `GPT API error: ${response.status}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async function callGemini(message, apiKey) {
        const context = getCurrentSectionContext();
        const systemInstruction = `You are an expert UPSC CSE preparation assistant. Help the student with their queries about syllabus, strategy, current affairs, answer writing, and study planning. Be concise, actionable, and encouraging.\n\nContext:\n${context}`;

        const contents = chatHistory.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async function sendMessage(msg) {
        const inputEl = document.getElementById('ai-chat-input');
        const message = msg || inputEl?.value || '';
        if (!message.trim()) return;
        if (inputEl) inputEl.value = '';

        const apiKey = getApiKey(currentProvider);
        if (!apiKey) {
            appendMessage('system', `⚠️ No ${currentProvider.toUpperCase()} API key set. Click the ⚙️ icon to add your key.`);
            return;
        }

        appendMessage('user', message);
        chatHistory.push({ role: 'user', content: message });

        const typingEl = appendMessage('assistant', '● ● ●');
        typingEl.classList.add('typing-indicator');

        try {
            const reply = currentProvider === 'gpt' 
                ? await callGPT(message, apiKey) 
                : await callGemini(message, apiKey);
            
            typingEl.remove();
            appendMessage('assistant', reply);
            chatHistory.push({ role: 'assistant', content: reply });
        } catch(e) {
            typingEl.remove();
            appendMessage('system', `❌ Error: ${e.message}`);
        }
    }

    function appendMessage(role, content) {
        const container = document.getElementById('ai-chat-messages');
        const div = document.createElement('div');
        div.className = `ai-msg ai-msg-${role}`;
        
        // Simple markdown-ish formatting
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        div.innerHTML = formatted;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    function toggle() {
        isOpen = !isOpen;
        const panel = document.getElementById('ai-chat-panel');
        const fab = document.getElementById('ai-chat-fab');
        if (isOpen) {
            panel.classList.remove('hidden');
            fab.innerHTML = '✕';
            fab.style.background = 'linear-gradient(135deg, #ef4444, #f97316)';
        } else {
            panel.classList.add('hidden');
            fab.innerHTML = '🤖';
            fab.style.background = 'linear-gradient(135deg, #6366f1, #a855f7)';
        }
    }

    function switchProvider(provider) {
        currentProvider = provider;
        document.getElementById('btn-provider-gpt').className = provider === 'gpt' ? 'ai-provider-btn active' : 'ai-provider-btn';
        document.getElementById('btn-provider-gemini').className = provider === 'gemini' ? 'ai-provider-btn active' : 'ai-provider-btn';
        document.getElementById('ai-chat-input').placeholder = `Ask ${provider === 'gpt' ? 'GPT' : 'Gemini'} about UPSC...`;
    }

    function showSettings() {
        const gptKey = getApiKey('gpt');
        const geminiKey = getApiKey('gemini');
        document.getElementById('ai-settings-panel').classList.remove('hidden');
        document.getElementById('ai-chat-view').classList.add('hidden');
        document.getElementById('ai-key-gpt').value = gptKey ? '••••••' + gptKey.slice(-6) : '';
        document.getElementById('ai-key-gemini').value = geminiKey ? '••••••' + geminiKey.slice(-6) : '';
    }

    function hideSettings() {
        document.getElementById('ai-settings-panel').classList.add('hidden');
        document.getElementById('ai-chat-view').classList.remove('hidden');
    }

    function saveSettings() {
        const gptVal = document.getElementById('ai-key-gpt').value.trim();
        const geminiVal = document.getElementById('ai-key-gemini').value.trim();
        // Only save if it's a real key (not masked)
        if (gptVal && !gptVal.startsWith('••••')) setApiKey('gpt', gptVal);
        if (geminiVal && !geminiVal.startsWith('••••')) setApiKey('gemini', geminiVal);
        hideSettings();
        appendMessage('system', '✅ API keys saved securely in your browser.');
    }

    function clearChat() {
        chatHistory = [];
        document.getElementById('ai-chat-messages').innerHTML = '';
        appendMessage('system', `🤖 Chat cleared. Ask me anything about UPSC prep! Using: ${currentProvider.toUpperCase()}`);
    }

    // Public API
    return { toggle, sendMessage, switchProvider, showSettings, hideSettings, saveSettings, clearChat };
})();
