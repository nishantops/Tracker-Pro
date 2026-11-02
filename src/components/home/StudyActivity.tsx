import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { loadCloudPref, saveCloudPref } from '../../lib/cloudPrefs';
import {
  buildHeatmap, currentStreak, DAY_LABELS, fmtHM, istToday, lastNDaysTotal,
} from '../../lib/studyStats';

const DEFAULT_GOAL_H = 4;
const WEEKS = 12;
const R = 40;
const CIRC = 2 * Math.PI * R;
const goalKey = (uid: string) => `upsc_daily_goal_${uid}`;

function readGoal(uid: string | undefined): number {
  if (!uid) return DEFAULT_GOAL_H;
  const n = parseFloat(localStorage.getItem(goalKey(uid)) ?? '');
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL_H;
}

// Daily goal ring + 12-week study heatmap, built from the focus timer's daily totals.
export function StudyActivity() {
  const { user } = useAuth();
  const [secsByDate, setSecsByDate] = useState<Map<string, number>>(new Map());
  const [goalH, setGoalH] = useState(() => readGoal(user?.id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const today = istToday();

  // Focus totals (re-read when a session is saved and every few minutes)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const since = new Date(Date.now() - (WEEKS * 7 + 2) * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('upsc_focus_daily')
        .select('focus_date, total_seconds')
        .eq('user_id', user.id)
        .gte('focus_date', since);
      if (cancelled || !data) return;
      setSecsByDate(new Map(data.map((d) => [d.focus_date as string, (d.total_seconds as number) ?? 0])));
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    window.addEventListener('upsc-focus-saved', load);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('upsc-focus-saved', load); };
  }, [user]);

  // Goal follows the account
  useEffect(() => {
    if (!user) return;
    setGoalH(readGoal(user.id));
    let cancelled = false;
    loadCloudPref<{ hours: number }>(user.id, 'daily_goal').then((r) => {
      if (cancelled || !r.ok) return;
      if (r.found && r.value && Number.isFinite(r.value.hours) && r.value.hours > 0) {
        setGoalH(r.value.hours);
        try { localStorage.setItem(goalKey(user.id), String(r.value.hours)); } catch { /* ignore */ }
      } else if (!r.found && localStorage.getItem(goalKey(user.id))) {
        saveCloudPref(user.id, 'daily_goal', { hours: readGoal(user.id) });
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const saveGoal = () => {
    const n = Math.min(16, Math.max(0.5, parseFloat(draft)));
    setEditing(false);
    if (!Number.isFinite(n) || !user) return;
    setGoalH(n);
    try { localStorage.setItem(goalKey(user.id), String(n)); } catch { /* ignore */ }
    saveCloudPref(user.id, 'daily_goal', { hours: n });
  };

  const goalSecs = goalH * 3600;
  const todaySecs = secsByDate.get(today) ?? 0;
  const pct = Math.min(1, goalSecs > 0 ? todaySecs / goalSecs : 0);
  const heat = useMemo(() => buildHeatmap(secsByDate, goalSecs, today, WEEKS), [secsByDate, goalSecs, today]);
  const streak = currentStreak(secsByDate, today);
  const week = lastNDaysTotal(secsByDate, today, 7);
  const activeDays = Array.from(secsByDate.entries()).filter(([d, s]) => s > 0 && d <= today).length;

  return (
    <div className="neo-card rounded-3xl p-5 study-activity">
      <div className="study-head">
        <h3 className="study-title">Daily Goal &amp; Study Activity</h3>
        {editing ? (
          <span className="study-goal-edit">
            <input
              type="number" min={0.5} max={16} step={0.5} autoFocus value={draft} aria-label="Daily goal in hours"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditing(false); }}
            />
            <button type="button" onClick={saveGoal}>Save</button>
          </span>
        ) : (
          <button type="button" className="study-goal-btn" onClick={() => { setDraft(String(goalH)); setEditing(true); }} title="Change daily goal">
            Goal: {goalH}h/day ✎
          </button>
        )}
      </div>

      <div className="study-body">
        <div className="study-ring" role="img" aria-label={`Today ${fmtHM(todaySecs)} of ${goalH} hours`}>
          <svg viewBox="0 0 100 100" width="104" height="104">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surf)" strokeWidth="9" />
            <circle
              cx="50" cy="50" r={R} fill="none" stroke="url(#studyRingGrad)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)} transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <defs>
              <linearGradient id="studyRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff9933" /><stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="study-ring-text">
            <strong>{fmtHM(todaySecs)}</strong>
            <span>{pct >= 1 ? 'Goal met ✓' : `of ${goalH}h`}</span>
          </div>
        </div>

        <div className="study-stats">
          <div><b>{streak > 0 ? `🔥 ${streak}` : '—'}</b><span>day streak</span></div>
          <div><b>{fmtHM(week)}</b><span>last 7 days</span></div>
          <div><b>{activeDays}</b><span>active days</span></div>
        </div>
      </div>

      <div className="study-heat-wrap">
        <div className="study-heat-days" aria-hidden="true">{DAY_LABELS.map((d, i) => <span key={d}>{i % 2 === 0 ? d : ''}</span>)}</div>
        <div className="study-heat" role="img" aria-label="Study activity, last 12 weeks">
          {heat.map((col, ci) => (
            <div key={ci} className="study-heat-col">
              {col.map((c, ri) => c ? (
                <span key={ri} className={`study-cell lv${c.level}`} title={`${c.date} — ${c.secs > 0 ? fmtHM(c.secs) : 'no study'}`} />
              ) : <span key={ri} className="study-cell empty" />)}
            </div>
          ))}
        </div>
      </div>
      <div className="study-legend" aria-hidden="true">
        Less <span className="study-cell lv0" /><span className="study-cell lv1" /><span className="study-cell lv2" /><span className="study-cell lv3" /><span className="study-cell lv4" /> More
      </div>
    </div>
  );
}
