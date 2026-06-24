import { useState, useRef, useCallback, useEffect } from 'react';
import { ENV } from '../lib/env';

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const STORAGE_KEY = 'upsc_ai_chat_history';
const CUSTOM_KEY_STORAGE = 'upsc_ai_key_gemini_custom';

const APP_KNOWLEDGE = `You are the built-in AI assistant of "UPSC CSE Command Center 2027" — a personal study tracker app for UPSC Civil Services Examination preparation (target: 2027).

APP FEATURES YOU MUST KNOW:
1. MARATHON TRACKER: Syllabus tracking (Prelims, Mains, Anthro), CA Tracker, PYQ browser, Test Series tracker.
2. STRATEGY PLANNER: Custom study plans (Daily/Weekly/Monthly), Sources & Links management.
3. KEY METRICS: Global syllabus absorption %, section-wise pies, exam countdown timers.
4. FOCUS MODE: Study session timer with daily/weekly totals and history.
5. AI Study Buddy (this chat!) for UPSC advice and app guidance.

BEHAVIOR RULES:
- Give actionable UPSC-specific advice: booklist suggestions, answer writing tips, revision strategies, current affairs sources.
- If asked about app features, explain them from the list above.
- Keep answers concise (2-4 paragraphs max) unless a detailed explanation is requested.
- NEVER mention internal technical details: no database names, API names, library names, developer-facing terms.`;

function getApiKey(): string {
  return localStorage.getItem(CUSTOM_KEY_STORAGE) || ENV.GEMINI_API_KEY || '';
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch { /* storage full */ }
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setMessages((prev) => [...prev, { role: 'system', content: '⚠️ No API key configured. Click ⚙️ to add your Gemini key.' }]);
      return;
    }

    const userMsg: ChatMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      abortRef.current = new AbortController();

      const recentHistory = [...messages.slice(-10), userMsg].map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const model = ENV.GEMINI_MODEL || 'gemini-1.5-pro';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: APP_KNOWLEDGE }] },
            contents: recentHistory,
            generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message || `API error: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.candidates[0].content.parts[0].text;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error && (e.message.includes('quota') || e.message.includes('429'))
        ? '⚠️ Rate limit reached. Please wait and try again.'
        : `❌ ${e instanceof Error ? e.message : 'Unknown error'}`;
      setMessages((prev) => [...prev, { role: 'system', content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const clear = useCallback(() => {
    setMessages([{ role: 'system', content: '🤖 Chat cleared. Ask me anything about UPSC prep!' }]);
  }, []);

  const setCustomKey = useCallback((key: string) => {
    if (key.trim()) localStorage.setItem(CUSTOM_KEY_STORAGE, key.trim());
  }, []);

  return { messages, loading, send, clear, setCustomKey };
}
