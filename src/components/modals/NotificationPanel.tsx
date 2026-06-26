import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ENV } from '../../lib/env';
import { useTracker } from '../../hooks/useTracker';

interface Alert {
  id: string;
  type: string;
  message: string;
  subtext?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

// ── Snooze helpers ─────────────────────────────────────────────────────────
function isSnoozed(key: string): boolean {
  try {
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}') as Record<string, number>;
    if (snoozed[key] && snoozed[key] > Date.now()) return true;
    if (snoozed[key]) { delete snoozed[key]; localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed)); }
  } catch { /* ignore */ }
  return false;
}

function snooze(key: string, hours = 24) {
  try {
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}') as Record<string, number>;
    snoozed[key] = Date.now() + hours * 3_600_000;
    localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed));
  } catch { /* ignore */ }
}

const SNOOZE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
];

export function NotificationPanel({ open, onClose, onOpenSettings }: Props) {
  const { user } = useAuth();
  const { progress } = useTracker();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const compute = useCallback(async () => {
    if (!user) return;

      const computed: Alert[] = [];

      // Load notification settings + plan data in parallel
      const [{ data: profileRow }, { data: plans }] = await Promise.all([
        supabase.from('upsc_user_profiles').select('notif_settings').eq('user_id', user.id).maybeSingle(),
        supabase.from('upsc_custom_plans').select('plan_id,plan_title,start_date,end_date,notif_enabled').eq('user_id', user.id),
      ]);

      const prefs = {
        enabled: true,
        planStart: true, planStartDays: 1,
        planEnd: true, planEndDays: 2,
        overdue: true,
        prelimsCountdown: true, prelimsDays: 30,
        mainsCountdown: true, mainsDays: 30,
        lowAbsorption: false, absorptionPct: 15,
        streak: false, streakDays: 1,
        daily: false, dailyTime: '09:00',
        evening: false, eveningTime: '21:00',
        customReminder: false, customText: '', customTime: '14:00',
        snoozeDuration: 24,
        ...(profileRow?.notif_settings as Record<string, unknown> ?? {}),
      } as Record<string, unknown>;

      if (!prefs.enabled) { setAlerts([]); return; }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ── Plan-based alerts ───────────────────────────────────────────
      for (const plan of (plans ?? [])) {
        if (!plan.notif_enabled) continue;

        if (prefs.planStart && plan.start_date) {
          const start = new Date(plan.start_date + 'T00:00:00');
          const diff = Math.round((start.getTime() - today.getTime()) / 86_400_000);
          const key = `plan_start_${plan.plan_id}`;
          if (diff >= 0 && diff <= (prefs.planStartDays as number) && !isSnoozed(key)) {
            computed.push({
              id: key, type: 'plan',
              message: `📋 "${plan.plan_title}" starts ${diff === 0 ? 'today' : `in ${diff} day${diff > 1 ? 's' : ''}`}`,
              subtext: plan.start_date,
            });
          }
        }

        if (prefs.planEnd && plan.end_date) {
          const end = new Date(plan.end_date + 'T00:00:00');
          const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
          const key = `plan_end_${plan.plan_id}`;
          if (diff >= 0 && diff <= (prefs.planEndDays as number) && !isSnoozed(key)) {
            computed.push({
              id: key, type: 'plan',
              message: `⏰ "${plan.plan_title}" ends ${diff === 0 ? 'today' : `in ${diff} day${diff > 1 ? 's' : ''}`}`,
              subtext: plan.end_date,
            });
          }
        }

        if (prefs.overdue && plan.end_date) {
          const end = new Date(plan.end_date + 'T00:00:00');
          const diff = Math.round((today.getTime() - end.getTime()) / 86_400_000);
          const key = `plan_overdue_${plan.plan_id}`;
          if (diff > 0 && !isSnoozed(key)) {
            computed.push({
              id: key, type: 'overdue',
              message: `🔴 "${plan.plan_title}" is ${diff} day${diff > 1 ? 's' : ''} overdue`,
              subtext: plan.end_date,
            });
          }
        }
      }

      // ── Exam countdown alerts ───────────────────────────────────────
      if (prefs.prelimsCountdown) {
        const prelims = new Date(ENV.PRELIMS_DATE);
        const diff = Math.round((prelims.getTime() - today.getTime()) / 86_400_000);
        const key = `prelims_cd_${prefs.prelimsDays}`;
        if (diff <= (prefs.prelimsDays as number) && diff >= 0 && !isSnoozed(key)) {
          computed.push({ id: key, type: 'exam', message: `🎯 Prelims in ${diff} days — ${ENV.PRELIMS_DATE.split(' ').slice(0, 3).join(' ')}` });
        }
      }
      if (prefs.mainsCountdown) {
        const mains = new Date(ENV.MAINS_DATE);
        const diff = Math.round((mains.getTime() - today.getTime()) / 86_400_000);
        const key = `mains_cd_${prefs.mainsDays}`;
        if (diff <= (prefs.mainsDays as number) && diff >= 0 && !isSnoozed(key)) {
          computed.push({ id: key, type: 'exam', message: `📝 Mains in ${diff} days — ${ENV.MAINS_DATE.split(' ').slice(0, 3).join(' ')}` });
        }
      }

      // ── Low absorption alert ────────────────────────────────────────
      if (prefs.lowAbsorption && progress && progress.size > 0) {
        let total = 0, checked = 0;
        progress.forEach((row) => {
          if (row.id.startsWith('uid-') || row.id.startsWith('custom_')) { total++; if (row.is_checked) checked++; }
        });
        if (total > 0) {
          const pct = (checked / total) * 100;
          const key = 'low_abs';
          if (pct < (prefs.absorptionPct as number) && !isSnoozed(key)) {
            computed.push({ id: key, type: 'warning', message: `⚠️ Absorption at ${pct.toFixed(1)}% — below your ${prefs.absorptionPct as number}% target!` });
          }
        }
      }

      // ── Study streak reminder ───────────────────────────────────────
      if (prefs.streak) {
        const lastFocus = localStorage.getItem('upsc_last_focus_ts');
        if (lastFocus) {
          const hoursSince = (Date.now() - parseInt(lastFocus)) / 3_600_000;
          const threshold = (prefs.streakDays as number) * 24;
          const key = 'streak';
          if (hoursSince >= threshold && !isSnoozed(key)) {
            const dStr = hoursSince >= 48 ? `${Math.floor(hoursSince / 24)} days` : `${Math.round(hoursSince)}h`;
            computed.push({ id: key, type: 'streak', message: `🔥 No focus session for ${dStr}. Keep the momentum going!` });
          }
        }
      }

      // ── Time-based reminders (custom, daily, evening) ───────────────
      const now = new Date();
      const checkTimeReminder = (enabled: unknown, time: unknown, key: string, msg: string) => {
        if (!enabled) return;
        const parts = (time as string || '09:00').split(':');
        const rH = parseInt(parts[0] ?? '9'), rM = parseInt(parts[1] ?? '0');
        const minsDiff = (now.getHours() - rH) * 60 + (now.getMinutes() - rM);
        if (minsDiff >= 0 && minsDiff < 60 && !isSnoozed(key)) {
          computed.push({ id: key, type: 'info', message: msg });
        }
      };
      checkTimeReminder(prefs.customReminder, prefs.customTime, 'custom_reminder', `💬 ${prefs.customText as string}`);
      checkTimeReminder(prefs.daily, prefs.dailyTime, 'daily_reminder', '🌅 Good morning! Time to study. Consistency beats intensity every day.');
      checkTimeReminder(prefs.evening, prefs.eveningTime, 'evening_reminder', '🌙 Evening check-in: review today\'s notes and plan tomorrow\'s targets!');

      setAlerts(computed);
  }, [user, progress]);

  // ── Compute on open + refresh every 20 min ───────────────────────────
  useEffect(() => {
    if (!open || !user) return;
    compute();
    timerRef.current = setInterval(compute, 20 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, user, compute]);

  const snoozeDuration = (prefs: Record<string, unknown> | null) =>
    typeof prefs?.snoozeDuration === 'number' ? (prefs.snoozeDuration as number) : 24;

  const dismiss = (id: string, hours?: number) => {
    const h = hours ?? snoozeDuration(
      (() => { try { return JSON.parse(localStorage.getItem('upsc_notif_prefs') || 'null'); } catch { return null; } })()
    );
    snooze(id, h);
    setAlerts((a) => a.filter((x) => x.id !== id));
    setSnoozeMenuId(null);
  };

  const dismissAll = () => {
    let h = 24;
    try { const p = JSON.parse(localStorage.getItem('upsc_notif_prefs') || 'null'); if (p?.snoozeDuration) h = p.snoozeDuration; } catch { /* */ }
    alerts.forEach((a) => snooze(a.id, h));
    setAlerts([]);
  };

  if (!open) return null;

  return createPortal(
    <div id="notif-panel" style={{ position: 'fixed', top: 56, right: '0.75rem', width: 320, zIndex: 9500 }}>
      <div className="notif-header">
        <span className="notif-title">🔔 Alerts</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {alerts.length > 0 && (
            <button className="notif-dismiss-all-btn" onClick={dismissAll} title="Dismiss all">✕ All</button>
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
                <button onClick={() => dismiss(n.id, 24)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.15rem 0.2rem' }} title="Dismiss for 24h">✕</button>
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
