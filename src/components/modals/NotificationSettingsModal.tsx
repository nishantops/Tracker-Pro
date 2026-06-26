import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useScrollLock } from '../../hooks/useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface NotifSettings {
  enabled: boolean;
  planStart: boolean;
  planStartDays: number;
  planEnd: boolean;
  planEndDays: number;
  overdue: boolean;
  prelimsCountdown: boolean;
  prelimsDays: number;
  mainsCountdown: boolean;
  mainsDays: number;
  lowAbsorption: boolean;
  absorptionPct: number;
  streak: boolean;
  streakDays: number;
  daily: boolean;
  dailyTime: string;
  evening: boolean;
  eveningTime: string;
  customReminder: boolean;
  customText: string;
  customTime: string;
  browserPush: boolean;
  snoozeDuration: number;
}

const DEFAULT_SETTINGS: NotifSettings = {
  enabled: true,
  planStart: true,
  planStartDays: 1,
  planEnd: true,
  planEndDays: 2,
  overdue: true,
  prelimsCountdown: true,
  prelimsDays: 30,
  mainsCountdown: true,
  mainsDays: 30,
  lowAbsorption: false,
  absorptionPct: 15,
  streak: true,
  streakDays: 1,
  daily: false,
  dailyTime: '09:00',
  evening: false,
  eveningTime: '21:00',
  customReminder: false,
  customText: '',
  customTime: '14:00',
  browserPush: false,
  snoozeDuration: 24,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ns-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ns-slider" />
    </label>
  );
}

export function NotificationSettingsModal({ open, onClose }: Props) {
  useScrollLock(open);
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!user || !open) return;
    const load = async () => {
      const { data } = await supabase
        .from('upsc_user_profiles')
        .select('notif_settings')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.notif_settings && typeof data.notif_settings === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.notif_settings as Partial<NotifSettings>) });
      }
    };
    load();
  }, [user, open]);

  const save = async () => {
    if (!user) return;
    await supabase
      .from('upsc_user_profiles')
      .update({ notif_settings: settings })
      .eq('user_id', user.id);
    onClose();
  };

  const set = <K extends keyof NotifSettings>(key: K, value: NotifSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9600] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="ns-card" style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: 480 }}>
        <div className="ns-title">⚙ Notification Settings</div>

        {/* Master */}
        <div className="ns-row">
          <div className="ns-label">Enable Notifications<div className="ns-sub">Master switch for all alerts</div></div>
          <Toggle checked={settings.enabled} onChange={(v) => set('enabled', v)} />
        </div>

        {settings.enabled && (
          <>
            {/* Plan Alerts */}
            <div className="ns-section-head">📋 Plan Alerts</div>
            <div className="ns-row">
              <div className="ns-label">Plan Start Alert<div className="ns-sub">Days before start date</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.planStart} onChange={(v) => set('planStart', v)} />
                <input type="number" min={0} max={14} value={settings.planStartDays} onChange={(e) => set('planStartDays', +e.target.value)} className="ns-input" style={{ width: '3.5rem' }} />
              </div>
            </div>
            <div className="ns-row">
              <div className="ns-label">Plan End Alert<div className="ns-sub">Days before end date</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.planEnd} onChange={(v) => set('planEnd', v)} />
                <input type="number" min={0} max={14} value={settings.planEndDays} onChange={(e) => set('planEndDays', +e.target.value)} className="ns-input" style={{ width: '3.5rem' }} />
              </div>
            </div>
            <div className="ns-row">
              <div className="ns-label">Overdue Alert<div className="ns-sub">Flag plans past end date</div></div>
              <Toggle checked={settings.overdue} onChange={(v) => set('overdue', v)} />
            </div>

            {/* Exam Alerts */}
            <div className="ns-section-head">🎯 Exam Countdown Alerts</div>
            <div className="ns-row">
              <div className="ns-label">Prelims Countdown Alert<div className="ns-sub">Alert when this many days remain</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.prelimsCountdown} onChange={(v) => set('prelimsCountdown', v)} />
                <input type="number" min={1} max={90} value={settings.prelimsDays} onChange={(e) => set('prelimsDays', +e.target.value)} className="ns-input" style={{ width: '3.5rem' }} />
              </div>
            </div>
            <div className="ns-row">
              <div className="ns-label">Mains Countdown Alert<div className="ns-sub">Alert when this many days remain</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.mainsCountdown} onChange={(v) => set('mainsCountdown', v)} />
                <input type="number" min={1} max={90} value={settings.mainsDays} onChange={(e) => set('mainsDays', +e.target.value)} className="ns-input" style={{ width: '3.5rem' }} />
              </div>
            </div>

            {/* Progress Alerts */}
            <div className="ns-section-head">📊 Progress Alerts</div>
            <div className="ns-row">
              <div className="ns-label">Low Absorption Alert<div className="ns-sub">Alert when overall % is below threshold</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.lowAbsorption} onChange={(v) => set('lowAbsorption', v)} />
                <input type="number" min={1} max={80} value={settings.absorptionPct} onChange={(e) => set('absorptionPct', +e.target.value)} className="ns-input" style={{ width: '3.5rem' }} />
                <span style={{ fontSize: '0.62rem', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>%</span>
              </div>
            </div>
            <div className="ns-row">
              <div className="ns-label">Study Streak Reminder<div className="ns-sub">Nudge if no focus session for X days</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.streak} onChange={(v) => set('streak', v)} />
                <input type="number" min={1} max={7} value={settings.streakDays} onChange={(e) => set('streakDays', +e.target.value)} className="ns-input" style={{ width: '3.5rem' }} />
              </div>
            </div>

            {/* Reminders */}
            <div className="ns-section-head">⏰ Reminders</div>
            <div className="ns-row">
              <div className="ns-label">Daily Reminder<div className="ns-sub">Morning study nudge</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.daily} onChange={(v) => set('daily', v)} />
                <input type="time" value={settings.dailyTime} onChange={(e) => set('dailyTime', e.target.value)} className="ns-input" />
              </div>
            </div>
            <div className="ns-row">
              <div className="ns-label">Evening Review Reminder<div className="ns-sub">End-of-day check-in</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={settings.evening} onChange={(v) => set('evening', v)} />
                <input type="time" value={settings.eveningTime} onChange={(e) => set('eveningTime', e.target.value)} className="ns-input" />
              </div>
            </div>
            <div className="ns-row">
              <div className="ns-label">Custom Reminder<div className="ns-sub">Set a one-line reminder with time</div></div>
              <Toggle checked={settings.customReminder} onChange={(v) => set('customReminder', v)} />
            </div>
            {settings.customReminder && (
              <div style={{ padding: '0.5rem 0 0.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input type="text" value={settings.customText} onChange={(e) => set('customText', e.target.value)} placeholder="e.g. Revise Polity notes" className="ns-input" style={{ width: '100%', fontSize: '0.72rem' }} />
                <input type="time" value={settings.customTime} onChange={(e) => set('customTime', e.target.value)} className="ns-input" style={{ width: '7rem' }} />
              </div>
            )}

            {/* Push */}
            <div className="ns-section-head">🔔 Push</div>
            <div className="ns-row">
              <div className="ns-label">Browser Push Notifications<div className="ns-sub">OS-level alerts (requires permission)</div></div>
              <Toggle checked={settings.browserPush} onChange={(v) => set('browserPush', v)} />
            </div>

            {/* Snooze */}
            <div className="ns-row">
              <div className="ns-label">Default Snooze Duration<div className="ns-sub">How long to snooze an alert</div></div>
              <select value={settings.snoozeDuration} onChange={(e) => set('snoozeDuration', +e.target.value)} className="ns-input">
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={24}>1 day</option>
                <option value={72}>3 days</option>
                <option value={168}>1 week</option>
              </select>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button onClick={onClose} style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.25)', color: 'var(--t2)', borderRadius: '0.65rem', padding: '0.55rem 1.1rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>Cancel</button>
          <button onClick={save} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: 'white', borderRadius: '0.65rem', padding: '0.55rem 1.3rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
