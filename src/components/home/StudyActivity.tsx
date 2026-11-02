import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { loadCloudPref, saveCloudPref } from '../../lib/cloudPrefs';
import {
  addDays, buildHeatmap, buildTrend, currentStreak, DAY_LABELS, fmtHM, goalHoursFor, istToday, lastNDaysTotal,
  TREND_HISTORY_DAYS, trendDelta, type DailyGoal, type TrendMode,
} from '../../lib/studyStats';
import { TrendChart } from './TrendChart';

const MODES: { id: TrendMode; label: string; unit: string; now: string; before: string }[] = [
  { id: 'days', label: 'Days', unit: 'day', now: 'Today', before: 'yesterday' },
  { id: 'weeks', label: 'Weeks', unit: 'week', now: 'This week so far', before: 'last week' },
  { id: 'months', label: 'Months', unit: 'month', now: 'This month so far', before: 'last month' },
];

const DEFAULT_GOAL_H = 4;
const WEEKS = 12;
const R = 40;
const CIRC = 2 * Math.PI * R;
const goalKey = (uid: string) => `upsc_daily_goal_${uid}`;
const DEFAULT_GOAL: DailyGoal = { weekday: DEFAULT_GOAL_H, weekend: DEFAULT_GOAL_H };

const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const clampH = (n: number) => Math.min(24, Math.max(0.5, n));

// Accepts the old single-number form ({hours} / "6") as well as {weekday, weekend}
function parseGoal(v: unknown): DailyGoal | null {
  if (typeof v === 'number' && valid(v)) return { weekday: v, weekend: v };
  if (!v || typeof v !== 'object') return null;
  const o = v as { hours?: unknown; weekday?: unknown; weekend?: unknown };
  if (valid(o.weekday) && valid(o.weekend)) return { weekday: o.weekday, weekend: o.weekend };
  if (valid(o.hours)) return { weekday: o.hours, weekend: o.hours };
  return null;
}

// Equal goals keep the legacy single-number shape so older builds still read it
const serialize = (g: DailyGoal) => (g.weekday === g.weekend ? { hours: g.weekday } : { weekday: g.weekday, weekend: g.weekend });

function readGoal(uid: string | undefined): DailyGoal {
  if (!uid) return DEFAULT_GOAL;
  const raw = localStorage.getItem(goalKey(uid));
  if (!raw) return DEFAULT_GOAL;
  try { return parseGoal(JSON.parse(raw)) ?? DEFAULT_GOAL; } catch { return DEFAULT_GOAL; }
}

const writeGoal = (uid: string, g: DailyGoal) => {
  const s = serialize(g);
  try { localStorage.setItem(goalKey(uid), 'hours' in s ? String(s.hours) : JSON.stringify(s)); } catch { /* ignore */ }
};

// Daily goal ring + 12-week study heatmap, built from the focus timer's daily totals.
export function StudyActivity() {
  const { user } = useAuth();
  const [secsByDate, setSecsByDate] = useState<Map<string, number>>(new Map());
  const [goal, setGoal] = useState<DailyGoal>(() => readGoal(user?.id));
  const [editing, setEditing] = useState(false);
  const [draftWd, setDraftWd] = useState('');
  const [draftWe, setDraftWe] = useState('');
  const [adding, setAdding] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addH, setAddH] = useState('');
  const [addM, setAddM] = useState('');
  const [addErr, setAddErr] = useState('');
  const [mode, setMode] = useState<TrendMode>('weeks');
  const today = istToday();

  // Focus totals (re-read when a session is saved and every few minutes)
  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date(Date.now() - TREND_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('upsc_focus_daily')
      .select('focus_date, total_seconds')
      .eq('user_id', user.id)
      .gte('focus_date', since);
    if (!data) return;
    setSecsByDate(new Map(data.map((d) => [d.focus_date as string, (d.total_seconds as number) ?? 0])));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, 5 * 60_000);
    window.addEventListener('upsc-focus-saved', load);
    return () => { clearInterval(id); window.removeEventListener('upsc-focus-saved', load); };
  }, [user, load]);

  // Manual entry: adds to that day's total, the same table the focus timer writes to
  const addManual = async () => {
    if (!user) return;
    const secs = Math.round((Math.max(0, parseFloat(addH) || 0) * 60 + Math.max(0, parseFloat(addM) || 0)) * 60);
    if (secs <= 0 || secs > 24 * 3600) { setAddErr('Enter a time between 1 minute and 24 hours.'); return; }
    if (!addDate || addDate > today) { setAddErr('Pick today or an earlier date.'); return; }
    setAddErr('');
    const { data: existing, error: readErr } = await supabase
      .from('upsc_focus_daily').select('total_seconds').eq('user_id', user.id).eq('focus_date', addDate).maybeSingle();
    if (readErr) { setAddErr('Could not save. Try again.'); return; }
    const { error } = existing
      ? await supabase.from('upsc_focus_daily')
        .update({ total_seconds: (existing.total_seconds as number) + secs, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('focus_date', addDate)
      : await supabase.from('upsc_focus_daily').insert({ user_id: user.id, focus_date: addDate, total_seconds: secs });
    if (error) { setAddErr('Could not save. Try again.'); return; }
    setAdding(false); setAddH(''); setAddM('');
    window.dispatchEvent(new Event('upsc-focus-saved'));
  };

  // Goal follows the account
  useEffect(() => {
    if (!user) return;
    setGoal(readGoal(user.id));
    let cancelled = false;
    loadCloudPref<unknown>(user.id, 'daily_goal').then((r) => {
      if (cancelled || !r.ok) return;
      const remote = r.found ? parseGoal(r.value) : null;
      if (remote) {
        setGoal(remote);
        writeGoal(user.id, remote);
      } else if (!r.found && localStorage.getItem(goalKey(user.id))) {
        saveCloudPref(user.id, 'daily_goal', serialize(readGoal(user.id)));
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const saveGoal = () => {
    const wd = parseFloat(draftWd);
    const we = parseFloat(draftWe);
    setEditing(false);
    if (!Number.isFinite(wd) || !Number.isFinite(we) || !user) return;
    const next = { weekday: clampH(wd), weekend: clampH(we) };
    setGoal(next);
    writeGoal(user.id, next);
    saveCloudPref(user.id, 'daily_goal', serialize(next));
  };

  const goalH = goalHoursFor(goal, today);
  const goalSecs = goalH * 3600;
  const todaySecs = secsByDate.get(today) ?? 0;
  const pct = Math.min(1, goalSecs > 0 ? todaySecs / goalSecs : 0);
  const heat = useMemo(
    () => buildHeatmap(secsByDate, (d) => goalHoursFor(goal, d) * 3600, today, WEEKS),
    [secsByDate, goal, today],
  );
  const goalLabel = goal.weekday === goal.weekend ? `${goal.weekday}h/day` : `${goal.weekday}h weekdays · ${goal.weekend}h weekends`;
  const streak = currentStreak(secsByDate, today);
  const week = lastNDaysTotal(secsByDate, today, 7);
  const heatStart = addDays(today, -(WEEKS * 7 - 1));
  const activeDays = Array.from(secsByDate.entries()).filter(([d, s]) => s > 0 && d <= today && d >= heatStart).length;

  const trend = useMemo(
    () => buildTrend(secsByDate, mode, today, (d) => goalHoursFor(goal, d) * 3600),
    [secsByDate, mode, goal, today],
  );
  const delta = trendDelta(trend);
  const modeInfo = MODES.find((m) => m.id === mode)!;

  return (
    <div className="neo-card rounded-3xl p-5 study-activity">
      <div className="study-head">
        <h3 className="study-title">Daily Goal &amp; Study Activity</h3>
        {editing ? (
          <span className="study-goal-edit" onKeyDown={(e) => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditing(false); }}>
            <label>Weekdays
              <input type="number" min={0.5} max={24} step={0.5} autoFocus value={draftWd} aria-label="Weekday goal in hours" onChange={(e) => setDraftWd(e.target.value)} />
            </label>
            <label>Weekends
              <input type="number" min={0.5} max={24} step={0.5} value={draftWe} aria-label="Weekend goal in hours" onChange={(e) => setDraftWe(e.target.value)} />
            </label>
            <button type="button" onClick={saveGoal}>Save</button>
          </span>
        ) : (
          <button
            type="button" className="study-goal-btn" title="Change daily goal (separate weekday and weekend hours)"
            onClick={() => { setDraftWd(String(goal.weekday)); setDraftWe(String(goal.weekend)); setEditing(true); }}
          >
            Goal: {goalLabel} ✎
          </button>
        )}
      </div>

      <div className="study-body">
        <div className="study-ring" role="img" aria-label={`Today ${fmtHM(todaySecs)} of ${goalH} hours`}>
          <svg viewBox="0 0 100 100" width="104" height="104">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bdr-h)" strokeWidth="9" />
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

      <div className="study-add">
        {adding ? (
          <div className="study-add-form">
            <input type="date" aria-label="Date" value={addDate} max={today} onChange={(e) => setAddDate(e.target.value)} />
            <input type="number" min={0} max={24} placeholder="h" aria-label="Hours" value={addH} onChange={(e) => setAddH(e.target.value)} />
            <input type="number" min={0} max={59} placeholder="min" aria-label="Minutes" value={addM} onChange={(e) => setAddM(e.target.value)} />
            <button type="button" onClick={addManual}>Add</button>
            <button type="button" onClick={() => { setAdding(false); setAddErr(''); }}>Cancel</button>
            {addErr && <span className="study-add-err" role="alert">{addErr}</span>}
          </div>
        ) : (
          <button type="button" className="study-goal-btn" onClick={() => { setAddDate(today); setAdding(true); }}>+ Add study time</button>
        )}
      </div>

      <div className="study-viz">
      <div className="study-heat-block">
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

      <div className="study-trend">
        <div className="study-trend-head">
          <span className="study-trend-title">Trend</span>
          <div className="study-trend-modes" role="group" aria-label="Trend period">
            {MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
            ))}
          </div>
        </div>
        <TrendChart points={trend} unit={modeInfo.unit} />
        <div className="study-trend-sum">
          <span>{modeInfo.now}: <b>{fmtHM(delta.current)}</b></span>
          <span>
            {modeInfo.before}: <b>{fmtHM(delta.previous)}</b>
            {delta.pct !== null && <em className={delta.pct >= 0 ? 'up' : 'down'}> {delta.pct >= 0 ? '▲' : '▼'} {Math.abs(delta.pct)}%</em>}
          </span>
          <span className="study-trend-key"><i /> goal</span>
        </div>
      </div>
      </div>
    </div>
  );
}
