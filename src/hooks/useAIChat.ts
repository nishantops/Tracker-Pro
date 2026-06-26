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
1. MARATHON TRACKER (main view):
   - Syllabus tab: Full UPSC syllabus broken into checkable units across Prelims (GS Paper I, CSAT), Mains (GS-I to GS-IV, Essay, Languages), and Anthropology Optional (Paper I, II, Assignments). Check off topics as you complete them.
   - CA Tracker tab: Monthly Current Affairs tracking with links to key newspapers and magazines. Includes a "My CA Links" section where you can add and manage your own custom resources.
   - PYQ tab: Previous Year Questions (2013–2025) for Prelims GS & CSAT, Mains GS-I to GS-IV, and Anthropology — searchable and filterable by year and topic.
   - Test Series tab: Log and track your mock test performance across all papers.

2. STRATEGY PLANNER (second root view):
   - My Plans: Create custom study plans (Daily, Weekly, Monthly) with isolated progress tracking. Each plan has tasks, a spreadsheet table, date alerts, and a strategy note.
   - Sources & Links: A dedicated section to manage your study materials, booklists, and important links.
   - Assignments: Track assignment submissions and pending tasks.

3. KEY METRICS (always visible):
   - Global Syllabus Absorption %: Your overall progress across all sections in real time.
   - Section-wise pie charts: Completion percentages for Prelims (P1, P2), Mains GS (GS1-4), Anthropology (A1, A2), and Current Affairs (CA).
   - Prelims & Mains countdown timers: Live days remaining to each exam.
   - Custom topic addition: Add any topic not in the default syllabus for personalised tracking.

4. FOCUS MODE:
   - Built-in focus timer to log study sessions. Tracks daily and total focus hours.
   - Session history and streak tracking.

5. NOTIFICATIONS & REMINDERS:
   - Plan start/end/overdue alerts with configurable advance notice.
   - Exam countdown alerts (trigger when Prelims/Mains is within X days).
   - Low absorption alerts (notify if overall progress falls below a threshold).
   - Study streak reminder (nudge if no study session for X days).
   - Daily morning and evening review reminders at set times.
   - Custom one-line reminders with a configurable time.
   - Snooze any alert for 1h, 4h, 1 day, 3 days, or 1 week.
   - Browser push notifications (requires permission).

6. ADDITIONAL FEATURES:
   - Secure sign-in with email or Google account.
   - All progress saves automatically — no manual saving needed.
   - Dark and Light theme toggle.
   - AI Study Buddy (this chat!) for UPSC advice and app guidance.
   - Profile setup with your name and optional alias.

BEHAVIOR RULES:
- You have access to the student's LIVE progress data (provided below). Reference it when giving advice.
- Be specific: mention their actual percentages, days left, weak sections.
- Give actionable UPSC-specific advice: booklist suggestions, answer writing tips, revision strategies, current affairs sources.
- If asked about app features, explain them from the list above.
- Keep answers concise (2-4 paragraphs max) unless a detailed explanation is requested.
- NEVER mention internal technical details: no database names, API names, library names, developer-facing implementation specifics, timeouts, or code-level terms. Describe everything purely from a user perspective.`;

function getApiKey(): string {
  return localStorage.getItem(CUSTOM_KEY_STORAGE) || ENV.GEMINI_API_KEY || '';
}

export function useAIChat(getLiveContext?: () => string) {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-ENV.AI_HISTORY_LIMIT)));
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

      const liveCtx = getLiveContext ? `\n\nLIVE DATA:\n${getLiveContext()}` : '';
      const systemPrompt = APP_KNOWLEDGE + liveCtx;

      const recentHistory = [...messages.slice(-ENV.AI_CONTEXT_WINDOW), userMsg].map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const model = ENV.GEMINI_MODEL;
      const res = await fetch(
        `${ENV.GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: recentHistory,
            generationConfig: { maxOutputTokens: ENV.AI_MAX_OUTPUT_TOKENS, temperature: ENV.AI_TEMPERATURE },
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
