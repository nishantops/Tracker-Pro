import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useProfile } from '../../hooks/useProfile';
import { useScrollLock } from '../../hooks/useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
  onMarkRead?: () => void;
}

type AboutTab = 'features' | 'shortcuts' | 'contact' | 'feedback';

interface Message {
  id: string;
  content: string;
  sender_type: 'user' | 'admin';
  display_name?: string;
  created_at: string;
  thread_id?: string | null;
  _replies?: Message[];
}

const DAILY_MSG_LIMIT = 3;

export function AboutModal({ open, onClose, onMarkRead }: Props) {
  useScrollLock(open);
  const { user } = useAuth();
  const { profile } = useProfile();
  const [tab, setTab] = useState<AboutTab>('features');
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [msgStatus, setMsgStatus] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState('');
  const [feedbackLocked, setFeedbackLocked] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load chat + realtime when contact tab opens
  const loadMessages = useCallback(async () => {
    if (!user) return;
    const { data: topLevel } = await supabase
      .from('upsc_messages')
      .select('*')
      .eq('user_id', user.id)
      .is('thread_id', null)
      .order('created_at', { ascending: true });
    const roots: Message[] = (topLevel || []).map((m) => ({ ...m, _replies: [] }));
    if (roots.length) {
      const ids = roots.map((m) => m.id);
      const { data: replies } = await supabase
        .from('upsc_messages')
        .select('*')
        .in('thread_id', ids)
        .order('created_at', { ascending: true });
      (replies || []).forEach((r) => {
        const parent = roots.find((m) => m.id === r.thread_id);
        if (parent) parent._replies!.push(r as Message);
      });
    }
    setMessages(roots);

    // Mark unread admin messages as read
    if (onMarkRead) {
      await supabase
        .from('upsc_messages')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('sender_type', 'admin')
        .eq('is_read', false);
      onMarkRead();
    }

    // Today's count for rate-limiting
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('upsc_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('sender_type', 'user')
      .gte('created_at', `${today}T00:00:00Z`);
    setTodayCount(count ?? 0);
  }, [user]);

  const subscribeChat = useCallback(() => {
    if (channelRef.current || !user) return;
    channelRef.current = supabase
      .channel(`chat_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'upsc_messages', filter: `user_id=eq.${user.id}` }, () => {
        loadMessages();
      })
      .subscribe();
  }, [user, loadMessages]);

  useEffect(() => {
    if (!open || !user || tab !== 'contact') return;
    loadMessages();
    subscribeChat();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [open, user, tab, loadMessages, subscribeChat]);

  // Pre-load feedback status when feedback tab opens
  useEffect(() => {
    if (!open || !user || tab !== 'feedback') return;
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    supabase
      .from('upsc_feedback')
      .select('*')
      .eq('user_id', user.id)
      .eq('month_key', monthKey)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRating(data.rating ?? 0);
          setFeedbackText(data.content ?? '');
          setFeedbackLocked(true);
          setFeedbackBanner(`✓ Feedback submitted for ${monthName}. Cannot edit until next month.`);
        } else {
          setFeedbackLocked(false);
          setFeedbackBanner(`Share your ${monthName} experience — locks for 1 month after submission.`);
        }
      });
  }, [open, user, tab]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !msgInput.trim()) return;
    if (todayCount >= DAILY_MSG_LIMIT) {
      setMsgStatus(`Daily message limit reached (${DAILY_MSG_LIMIT}/day). Try tomorrow.`);
      return;
    }
    setMsgStatus('Sending...');
    const displayName = profile?.display_name || user.email || 'User';
    const { error } = await supabase.from('upsc_messages').insert({
      user_id: user.id,
      content: msgInput.trim(),
      sender_type: 'user',
      display_name: displayName,
      thread_id: null,
    });
    if (error) {
      setMsgStatus('Failed to send');
    } else {
      setMsgInput('');
      setMsgStatus('Sent ✓');
      setTodayCount((c) => c + 1);
      setTimeout(() => setMsgStatus(''), 2000);
      await loadMessages();
    }
  };

  const submitFeedback = async () => {
    if (!user || rating === 0) { setFeedbackStatus('Please select a rating'); return; }
    if (feedbackLocked) return;
    const month_key = new Date().toISOString().slice(0, 7);
    const displayName = profile?.display_name || user.email || 'User';
    await supabase.auth.getSession(); // refresh JWT
    const { error } = await supabase.from('upsc_feedback').upsert(
      {
        user_id: user.id,
        month_key,
        rating,
        content: feedbackText.trim() || '(no message)',
        display_name: displayName,
      },
      { onConflict: 'user_id,month_key' },
    );
    if (error) {
      let msg = error.message || 'Error';
      if (msg.includes('unique') || msg.includes('duplicate')) msg = 'Feedback already submitted for this month.';
      setFeedbackStatus(msg);
    } else {
      setFeedbackStatus('Thank you! Feedback submitted ⭐');
      setFeedbackLocked(true);
    }
  };

  if (!open) return null;

  const starLabels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '1.2rem', width: 'min(680px, 95vw)', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.2rem 1.5rem 0.9rem', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--t1)', fontFamily: 'var(--heading)' }}>ℹ️ About UPSC Command Centre</h2>
            <p style={{ fontSize: '0.65rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: '0.2rem' }}>v1.0 · Built by <strong style={{ color: 'var(--accent-l)' }}>SAN Labs</strong> · UPSC CSE 2027</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bdr)' }}>
          {([
            ['features', '📋 Features'],
            ['shortcuts', '⌨️ Shortcuts'],
            ['contact', '💬 Contact Admin'],
            ['feedback', '⭐ Monthly Feedback'],
          ] as [AboutTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`about-tab ${tab === key ? 'active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '1.2rem 1.5rem', flex: 1 }}>
          {/* Features */}
          {tab === 'features' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="about-feature-card"><h4>📊 Marathon Tracker</h4><p>Track all UPSC syllabus topics (Prelims GS1/CSAT, Mains GS1-GS4, Anthropology, Ethics) with checkboxes, notes, and completion percentages per section.</p></div>
              <div className="about-feature-card"><h4>🗺️ Strategy Planner</h4><p>Create custom study plans with dates, categories (GS1-4, Optional, Essay), Gantt timeline, master spreadsheet aggregation, and per-plan spreadsheet tables.</p></div>
              <div className="about-feature-card"><h4>📅 Mission Timeline (Gantt)</h4><p>Visual Gantt chart showing all plans on a monthly/weekly axis. Hover calendar dates to see active plans. Click plans to open them.</p></div>
              <div className="about-feature-card"><h4>⊞ Plan Spreadsheets</h4><p>Each plan has a rich spreadsheet with sort, filter, merge/split cells, text/fill color, zoom, fullscreen, multiple sheets, auto-save to cloud.</p></div>
              <div className="about-feature-card"><h4>📰 Current Affairs</h4><p>Monthly CA tracker with rich text notes, word-style editor, and monthly navigation.</p></div>
              <div className="about-feature-card"><h4>📝 PYQ Tracker</h4><p>Previous Year Questions for Prelims and Mains — searchable by topic, year, and keyword.</p></div>
              <div className="about-feature-card"><h4>⏱️ Focus Timer</h4><p>Study session timer with live sync. Tracks daily and session totals.</p></div>
              <div className="about-feature-card"><h4>💡 Strengths &amp; Weaknesses</h4><p>Track your strong areas and improvement zones on the homepage dashboard.</p></div>
            </div>
          )}

          {/* Shortcuts */}
          {tab === 'shortcuts' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--t1)', fontFamily: 'var(--mono)' }}>
              <div className="about-shortcut-section">
                <h4>📋 Spreadsheet Keyboard Shortcuts</h4>
                <table className="about-shortcut-table">
                  <tbody>
                    <tr><td>Arrow keys</td><td>Navigate between cells</td></tr>
                    <tr><td>Enter</td><td>Start editing selected cell / confirm &amp; move down</td></tr>
                    <tr><td>Tab / Shift+Tab</td><td>Move right / left between columns</td></tr>
                    <tr><td>Escape</td><td>Stop editing / clear selection / close panel</td></tr>
                    <tr><td>Delete / Backspace</td><td>Clear selected cell values</td></tr>
                    <tr><td>Ctrl+A</td><td>Select all cells in current sheet</td></tr>
                    <tr><td>Ctrl+C</td><td>Copy selected cells (tab-separated)</td></tr>
                    <tr><td>Ctrl+X</td><td>Cut selected cells (copy + clear values)</td></tr>
                    <tr><td>Ctrl+V</td><td>Paste from clipboard (Excel-compatible TSV format)</td></tr>
                    <tr><td>Click #</td><td>Select entire row</td></tr>
                    <tr><td>Click column header</td><td>Select entire column</td></tr>
                    <tr><td>Sort ⇅ button</td><td>Toggle ascending/descending sort</td></tr>
                    <tr><td>Filter button</td><td>Show/hide per-column text filter inputs</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="about-shortcut-section" style={{ marginTop: '1rem' }}>
                <h4>🎨 Formatting</h4>
                <table className="about-shortcut-table">
                  <tbody>
                    <tr><td>B / I / U / S</td><td>Bold, Italic, Underline, Strikethrough</td></tr>
                    <tr><td>A (text color)</td><td>Change cell text color</td></tr>
                    <tr><td>■ (fill color)</td><td>Change cell background color</td></tr>
                    <tr><td>Merge / Split</td><td>Merge or unmerge selected cells</td></tr>
                    <tr><td>- / + (zoom)</td><td>Zoom in/out the spreadsheet</td></tr>
                    <tr><td>⊞ (fullscreen)</td><td>Open in fullscreen mode</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Contact Admin */}
          {tab === 'contact' && (
            <div>
              <div
                ref={chatRef}
                style={{ height: 280, overflowY: 'auto', border: '1px solid var(--bdr)', borderRadius: '0.65rem', padding: '0.6rem', marginBottom: '0.6rem', background: 'var(--inp)', scrollbarWidth: 'thin' }}
              >
                {messages.length === 0 ? (
                  <p style={{ color: 'var(--t3)', fontSize: '0.65rem', textAlign: 'center', padding: '1rem 0' }}>No messages yet. Send one below!</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id}>
                      <div style={{ marginBottom: '0.35rem', display: 'flex', justifyContent: m.sender_type === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '82%', padding: '0.4rem 0.7rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontFamily: 'var(--mono)', background: m.sender_type === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)', color: 'var(--t1)', border: `1px solid ${m.sender_type === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.25)'}` }}>
                          <div style={{ fontSize: '0.55rem', fontWeight: 700, color: m.sender_type === 'admin' ? '#818cf8' : 'var(--t3)', marginBottom: '0.15rem' }}>
                            {m.sender_type === 'admin' ? '🛡 Admin' : `👤 ${m.display_name || 'You'}`} · {new Date(m.created_at).toLocaleString()}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.content}</div>
                        </div>
                      </div>
                      {(m._replies || []).map((r) => (
                        <div key={r.id} style={{ paddingLeft: '1rem', marginBottom: '0.35rem', display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{ maxWidth: '78%', padding: '0.35rem 0.65rem', borderRadius: '0.45rem', fontSize: '0.68rem', fontFamily: 'var(--mono)', background: 'rgba(99,102,241,0.12)', color: 'var(--t1)', border: '1px solid rgba(99,102,241,0.22)' }}>
                            <div style={{ fontSize: '0.52rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.12rem' }}>↳ 🛡 Admin · {new Date(r.created_at).toLocaleString()}</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{r.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <textarea
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  rows={2}
                  disabled={todayCount >= DAILY_MSG_LIMIT}
                  placeholder={todayCount >= DAILY_MSG_LIMIT ? `Daily limit reached (${DAILY_MSG_LIMIT}/day). Try tomorrow.` : 'Type message… (Enter to send)'}
                  style={{ flex: 1, background: 'var(--inp)', border: '1px solid var(--bdr)', borderRadius: '0.5rem', padding: '0.5rem 0.65rem', fontSize: '0.72rem', color: 'var(--t1)', fontFamily: 'var(--mono)', resize: 'none', outline: 'none', opacity: todayCount >= DAILY_MSG_LIMIT ? 0.5 : 1 }}
                />
                <button onClick={sendMessage} disabled={todayCount >= DAILY_MSG_LIMIT} style={{ background: 'var(--accent1)', border: 'none', color: '#fff', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--mono)', cursor: 'pointer', flexShrink: 0, opacity: todayCount >= DAILY_MSG_LIMIT ? 0.5 : 1 }}>Send ↑</button>
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: '0.3rem' }}>
                {todayCount}/{DAILY_MSG_LIMIT} messages sent today
                {msgStatus && <span style={{ marginLeft: '0.5rem', color: msgStatus.includes('Sent') ? '#10b981' : '#f87171' }}>{msgStatus}</span>}
              </div>
            </div>
          )}

          {/* Monthly Feedback */}
          {tab === 'feedback' && (
            <div>
              {feedbackBanner && (
                <p style={{ fontSize: '0.72rem', color: feedbackLocked ? '#10b981' : 'var(--t3)', fontFamily: 'var(--mono)', marginBottom: '0.85rem', padding: '0.5rem 0.7rem', background: feedbackLocked ? 'rgba(16,185,129,0.08)' : 'var(--inp)', border: `1px solid ${feedbackLocked ? 'rgba(16,185,129,0.3)' : 'var(--bdr)'}`, borderRadius: '0.5rem' }}>{feedbackBanner}</p>
              )}
              <p style={{ fontSize: '0.72rem', color: 'var(--t2)', marginBottom: '0.85rem' }}>Rate your experience this month — helps SAN Labs make the app better for you! 🚀</p>
              {/* Star rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>Rating:</span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <span
                      key={v}
                      onClick={() => !feedbackLocked && setRating(v)}
                      style={{ fontSize: '1.6rem', cursor: feedbackLocked ? 'default' : 'pointer', transition: 'transform 0.1s', transform: v <= rating ? 'scale(1.15)' : 'scale(1)', color: v <= rating ? '#f59e0b' : 'var(--t3)' }}
                    >
                      {v <= rating ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginLeft: '0.25rem' }}>{starLabels[rating]}</span>
              </div>
              <input
                type="text"
                maxLength={200}
                value={feedbackText}
                onChange={(e) => !feedbackLocked && setFeedbackText(e.target.value)}
                readOnly={feedbackLocked}
                placeholder="Any quick thought? (optional, max 200 chars)"
                style={{ width: '100%', background: 'var(--inp)', border: '1px solid var(--bdr)', borderRadius: '0.55rem', padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: 'var(--t1)', fontFamily: 'var(--mono)', outline: 'none', boxSizing: 'border-box', opacity: feedbackLocked ? 0.7 : 1 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.7rem' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{new Date().toLocaleString('en', { month: 'long', year: 'numeric' })}</span>
                <button onClick={submitFeedback} disabled={feedbackLocked} style={{ background: 'var(--accent1)', border: 'none', color: '#fff', borderRadius: '0.5rem', padding: '0.42rem 1.1rem', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--mono)', cursor: feedbackLocked ? 'default' : 'pointer', opacity: feedbackLocked ? 0.5 : 1 }}>
                  {feedbackLocked ? 'Submitted' : 'Submit ⭐'}
                </button>
              </div>
              {feedbackStatus && <div style={{ fontSize: '0.65rem', color: feedbackStatus.includes('Thank') ? '#10b981' : '#f87171', fontFamily: 'var(--mono)', minHeight: '1rem', marginTop: '0.4rem' }}>{feedbackStatus}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
