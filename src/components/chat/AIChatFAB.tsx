import { useState, useRef, useEffect, useCallback } from 'react';
import { useAIChat } from '../../hooks/useAIChat';
import { useTracker } from '../../hooks/useTracker';
import { useProfile } from '../../hooks/useProfile';
import { ENV } from '../../lib/env';

export function AIChatFAB() {
  const { progress, getGlobalMetrics, getMetrics } = useTracker();
  const { profile } = useProfile();

  const getLiveContext = useCallback(() => {
    const name = profile?.display_name || 'User';
    const global = getGlobalMetrics();
    const pct = global.total > 0 ? Math.round((global.checked / global.total) * 100) : 0;

    // Section-wise completion
    const sectionKeys = ['p1', 'p2', 'gs1', 'gs2', 'gs3', 'gs4', 'a1', 'a2', 'ca'];
    const sections = sectionKeys.map((k) => {
      const m = getMetrics(k);
      const p = m.total > 0 ? Math.round((m.checked / m.total) * 100) : 0;
      return `${k.toUpperCase()}: ${p}%`;
    }).join(', ');

    // Countdown
    const now = new Date().getTime();
    const prelims = Math.ceil((new Date(ENV.PRELIMS_DATE).getTime() - now) / 86400000);
    const mains = Math.ceil((new Date(ENV.MAINS_DATE).getTime() - now) / 86400000);

    return `Student: ${name}
Overall Progress: ${pct}% (${global.checked}/${global.total} units checked)
Countdown: Prelims ${prelims} days, Mains ${mains} days
Section Completion: ${sections}`;
  }, [progress, profile, getGlobalMetrics, getMetrics]);

  const { messages, loading, send, clear, setCustomKey } = useAIChat(getLiveContext);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    send(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const saveKey = () => {
    setCustomKey(keyInput);
    setShowSettings(false);
    setKeyInput('');
  };

  return (
    <>
      {/* FAB */}
      <button
        className={`ai-fab ${open ? 'ai-fab-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="AI Study Buddy"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <span className="ai-panel-title">🤖 Study Buddy</span>
            <div className="ai-panel-actions">
              <button onClick={() => setShowSettings((o) => !o)} title="Settings">⚙️</button>
              <button onClick={clear} title="Clear chat">🗑️</button>
            </div>
          </div>

          {showSettings ? (
            <div className="ai-settings">
              <label className="ai-settings-label">Custom Gemini API Key</label>
              <input
                className="ai-settings-input"
                type="password"
                placeholder="AIzaSy..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <div className="ai-settings-btns">
                <button onClick={saveKey} className="ai-settings-save">Save</button>
                <button onClick={() => setShowSettings(false)} className="ai-settings-cancel">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="ai-messages">
                {messages.length === 0 && (
                  <div className="ai-empty">
                    Ask me anything about UPSC prep, answer writing, booklists, or how to use this app!
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ai-msg-${m.role}`}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: m.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/`(.*?)`/g, '<code>$1</code>')
                          .replace(/\n/g, '<br>'),
                      }}
                    />
                  </div>
                ))}
                {loading && <div className="ai-msg ai-msg-assistant ai-typing">● ● ●</div>}
                <div ref={bottomRef} />
              </div>

              <div className="ai-input-row">
                <textarea
                  className="ai-input"
                  placeholder="Ask anything about UPSC…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button className="ai-send" onClick={handleSend} disabled={loading || !input.trim()}>
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
