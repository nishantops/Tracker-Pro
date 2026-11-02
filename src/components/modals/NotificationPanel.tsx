import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SNOOZE_OPTIONS, type Alert } from '../../lib/notifEngine';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  alerts: Alert[];
  onDismiss: (id: string, hours?: number) => void;
  onDismissAll: () => void;
  onRefresh?: () => void;
}

export function NotificationPanel({ open, onClose, onOpenSettings, alerts, onDismiss, onDismissAll, onRefresh }: Props) {
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);

  // Fresh data whenever the panel is opened
  useEffect(() => { if (open) onRefresh?.(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = (id: string, hours?: number) => { onDismiss(id, hours); setSnoozeMenuId(null); };

  if (!open) return null;

  return createPortal(
    <div id="notif-panel" style={{ position: 'fixed', top: 56, right: '0.75rem', width: 320, zIndex: 9500 }}>
      <div className="notif-header">
        <span className="notif-title">🔔 Alerts</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {alerts.length > 0 && (
            <button className="notif-dismiss-all-btn" onClick={onDismissAll} title="Dismiss all">✕ All</button>
          )}
          <button className="notif-settings-link" onClick={() => { onClose(); onOpenSettings(); }}>
            ⚙ Settings
          </button>
        </div>
      </div>
      <div id="notif-list">
        {alerts.length === 0 ? (
          <div className="notif-empty">No alerts right now ✓</div>
        ) : (
          alerts.map((n) => (
            <div key={n.id} className="notif-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--bdr)', position: 'relative' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--t1)', fontWeight: 600 }}>{n.message}</div>
                {n.subtext && <div style={{ fontSize: '0.58rem', color: 'var(--t4)', fontFamily: 'var(--mono)', marginTop: '0.15rem' }}>{n.subtext}</div>}
              </div>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => setSnoozeMenuId(snoozeMenuId === n.id ? null : n.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.15rem 0.3rem' }}
                  title="Snooze options"
                >⏸</button>
                <button onClick={() => dismiss(n.id)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.15rem 0.2rem' }} title="Dismiss for 24h">✕</button>
                {snoozeMenuId === n.id && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '0.5rem', zIndex: 100, minWidth: 110, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                    {SNOOZE_OPTIONS.map((opt) => (
                      <button
                        key={opt.hours}
                        onClick={() => dismiss(n.id, opt.hours)}
                        style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: 'var(--t2)', padding: '0.4rem 0.75rem', fontSize: '0.68rem', fontFamily: 'var(--mono)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}
