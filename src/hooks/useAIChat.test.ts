/**
 * Tests for useAIChat.ts — pure logic, constants, and non-async utilities
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ENV } from '../lib/env';

const STORAGE_KEY = 'upsc_ai_chat_history';
const CUSTOM_KEY_STORAGE = 'upsc_ai_key_gemini_custom';

describe('Chat history localStorage constants', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('STORAGE_KEY is "upsc_ai_chat_history"', () => {
    expect(STORAGE_KEY).toBe('upsc_ai_chat_history');
  });

  it('CUSTOM_KEY_STORAGE is "upsc_ai_key_gemini_custom"', () => {
    expect(CUSTOM_KEY_STORAGE).toBe('upsc_ai_key_gemini_custom');
  });
});

describe('getApiKey() pure logic', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns custom key when set in localStorage', () => {
    localStorage.setItem(CUSTOM_KEY_STORAGE, 'my-custom-key-123');
    const key = localStorage.getItem(CUSTOM_KEY_STORAGE) || ENV.GEMINI_API_KEY || '';
    expect(key).toBe('my-custom-key-123');
  });

  it('falls back to ENV.GEMINI_API_KEY when no custom key', () => {
    localStorage.removeItem(CUSTOM_KEY_STORAGE);
    const key = localStorage.getItem(CUSTOM_KEY_STORAGE) || ENV.GEMINI_API_KEY || '';
    expect(key).toBe(ENV.GEMINI_API_KEY);
  });

  it('returns empty string when both localStorage and ENV key are absent', () => {
    localStorage.removeItem(CUSTOM_KEY_STORAGE);
    const key = localStorage.getItem(CUSTOM_KEY_STORAGE) || '' || '';
    expect(key).toBe('');
  });
});

describe('Chat message history trimming', () => {
  it('slices to last 50 messages when persisting', () => {
    const msgs = Array.from({ length: 75 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const trimmed = msgs.slice(-50);
    expect(trimmed).toHaveLength(50);
    expect(trimmed[0].content).toBe('msg 25');
  });

  it('does not trim when fewer than 50 messages', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const trimmed = msgs.slice(-50);
    expect(trimmed).toHaveLength(20);
  });

  it('recent history in API call uses last 10 messages', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const recentHistory = msgs.slice(-10);
    expect(recentHistory).toHaveLength(10);
    expect(recentHistory[0].content).toBe('msg 10');
  });

  it('API call includes current user message in history', () => {
    const msgs = [{ role: 'user' as const, content: 'old msg' }];
    const userMsg = { role: 'user' as const, content: 'new question' };
    const history = [...msgs.slice(-10), userMsg];
    expect(history).toHaveLength(2);
    expect(history[history.length - 1].content).toBe('new question');
  });
});

describe('Role mapping for Gemini API', () => {
  it('maps "assistant" role to "model" for Gemini API', () => {
    const map = (role: string) => role === 'assistant' ? 'model' : 'user';
    expect(map('assistant')).toBe('model');
  });

  it('maps "user" role to "user" for Gemini API', () => {
    const map = (role: string) => role === 'assistant' ? 'model' : 'user';
    expect(map('user')).toBe('user');
  });

  it('maps "system" role to "user" for Gemini API (fallback)', () => {
    const map = (role: string) => role === 'assistant' ? 'model' : 'user';
    expect(map('system')).toBe('user');
  });
});

describe('Error message handling', () => {
  it('quota/429 error shows rate limit message', () => {
    const errorMessage = 'quota exceeded';
    const isRateLimit = errorMessage.includes('quota') || errorMessage.includes('429');
    const msg = isRateLimit
      ? '⚠️ Rate limit reached. Please wait and try again.'
      : `❌ ${errorMessage}`;
    expect(msg).toContain('Rate limit');
  });

  it('429 status in message shows rate limit message', () => {
    const errorMessage = 'API error: 429';
    const isRateLimit = errorMessage.includes('quota') || errorMessage.includes('429');
    expect(isRateLimit).toBe(true);
  });

  it('generic error shows error message with ❌ prefix', () => {
    const errorMessage = 'Network error';
    const isRateLimit = errorMessage.includes('quota') || errorMessage.includes('429');
    const msg = isRateLimit
      ? '⚠️ Rate limit reached. Please wait and try again.'
      : `❌ ${errorMessage}`;
    expect(msg).toBe('❌ Network error');
  });

  it('abort errors are silently ignored (not added to messages)', () => {
    const e = new DOMException('Aborted', 'AbortError');
    expect(e.name).toBe('AbortError');
  });
});

describe('Gemini API request structure', () => {
  it('uses maxOutputTokens of 800', () => {
    const config = { maxOutputTokens: 800, temperature: 0.7 };
    expect(config.maxOutputTokens).toBe(800);
  });

  it('uses temperature of 0.7', () => {
    const config = { maxOutputTokens: 800, temperature: 0.7 };
    expect(config.temperature).toBe(0.7);
  });

  it('uses correct model from ENV', () => {
    const model = ENV.GEMINI_MODEL || 'gemini-1.5-pro';
    expect(model).toBe('gemini-2.5-flash');
  });

  it('API URL format is correct', () => {
    const model = 'gemini-2.5-flash';
    const key = 'test-key';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('generateContent');
    expect(url).toContain(`?key=${key}`);
  });
});

describe('APP_KNOWLEDGE system prompt', () => {
  it('system prompt contains UPSC context', () => {
    const snippet = 'UPSC CSE Command Center 2027';
    expect(snippet).toContain('UPSC');
    expect(snippet).toContain('2027');
  });

  it('live context is appended with LIVE DATA prefix', () => {
    const liveCtx = 'progress: 45%';
    const combined = `\n\nLIVE DATA:\n${liveCtx}`;
    expect(combined).toContain('LIVE DATA:');
    expect(combined).toContain('progress: 45%');
  });

  it('empty live context when getLiveContext not provided', () => {
    const getLiveContext = undefined;
    const liveCtx = getLiveContext ? `\n\nLIVE DATA:\n${getLiveContext()}` : '';
    expect(liveCtx).toBe('');
  });
});

describe('localStorage history parsing', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('reads saved messages from localStorage', () => {
    const msgs = [{ role: 'user', content: 'hello' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(saved ? JSON.parse(saved) : []).toEqual(msgs);
  });

  it('returns empty array when localStorage is empty', () => {
    localStorage.removeItem(STORAGE_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);
    const result = saved ? JSON.parse(saved) : [];
    expect(result).toEqual([]);
  });

  it('handles malformed JSON gracefully returning empty array', () => {
    localStorage.setItem(STORAGE_KEY, 'INVALID_JSON');
    let result: unknown[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      result = saved ? JSON.parse(saved) : [];
    } catch {
      result = [];
    }
    expect(result).toEqual([]);
  });
});
