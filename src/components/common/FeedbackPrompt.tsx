import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function FeedbackPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  // Show prompt once a week if not already submitted this month
  useEffect(() => {
    if (!user) return;
    const lastDismissed = localStorage.getItem('feedback_prompt_dismissed');
    if (lastDismissed) {
      const diff = Date.now() - parseInt(lastDismissed, 10);
      if (diff < 7 * 86400000) return; // less than a week
    }
    // Check if already submitted this month
    const month = new Date().toISOString().slice(0, 7);
    supabase
      .from('upsc_feedback')
      .select('id')
      .eq('user_id', user.id)
      .eq('month_key', month)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setVisible(true);
      });
  }, [user]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('feedback_prompt_dismissed', String(Date.now()));
  };

  const submit = async () => {
    if (!user || rating === 0) { setStatus('Please select a rating'); return; }
    const month_key = new Date().toISOString().slice(0, 7);
    const { error } = await supabase.from('upsc_feedback').upsert(
      {
        user_id: user.id,
        month_key,
        rating,
        content: text.trim() || '',
        display_name: user.email ?? '',
      },
      { onConflict: 'user_id,month_key' },
    );
    if (error) { setStatus('Submit failed. Try again.'); return; }
    setStatus('Thank you! ⭐');
    setTimeout(dismiss, 1500);
  };

  if (!visible) return null;

  return (
    <div id="feedback-prompt" style={{ position: 'fixed', bottom: '1.2rem', right: '1.2rem', zIndex: 8000, width: 'min(320px, calc(100vw - 2rem))', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '1rem', padding: '1rem 1.15rem 0.9rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <button onClick={dismiss} style={{ position: 'absolute', top: '0.5rem', right: '0.6rem', background: 'none', border: 'none', color: 'var(--t4)', fontSize: '1rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--t1)', marginBottom: '0.25rem' }}>⭐ How are we doing?</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginBottom: '0.65rem' }}>Your feedback helps SAN Labs build a better app for you. 30 seconds, promise! 🙏</div>
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.55rem' }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <span key={v} onClick={() => setRating(v)} style={{ fontSize: '1.5rem', cursor: 'pointer' }}>
            {v <= rating ? '★' : '☆'}
          </span>
        ))}
      </div>
      <input
        type="text"
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Quick thought? (optional)"
        style={{ width: '100%', background: 'var(--inp)', border: '1px solid var(--bdr)', borderRadius: '0.45rem', padding: '0.38rem 0.6rem', fontSize: '0.68rem', color: 'var(--t1)', fontFamily: 'var(--mono)', outline: 'none', boxSizing: 'border-box', marginBottom: '0.55rem' }}
      />
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={submit} style={{ flex: 1, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '0.45rem', padding: '0.38rem 0', fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--mono)', cursor: 'pointer' }}>Submit ⭐</button>
        <button onClick={dismiss} style={{ background: 'none', border: '1px solid var(--bdr)', color: 'var(--t3)', borderRadius: '0.45rem', padding: '0.38rem 0.7rem', fontSize: '0.65rem', fontFamily: 'var(--mono)', cursor: 'pointer' }}>Later</button>
      </div>
      {status && <div style={{ fontSize: '0.62rem', color: 'var(--t3)', fontFamily: 'var(--mono)', minHeight: '0.8rem', marginTop: '0.3rem' }}>{status}</div>}
    </div>
  );
}
