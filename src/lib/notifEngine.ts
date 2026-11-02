import { supabase } from './supabase';
import { ENV } from './env';
import { STAGES } from '../data/syllabus';
import { dueRevisions, loadRevisionDone, revisionAlertParts, type CheckedRow } from './revision';

export interface Alert {
  id: string;
  type: string;
  message: string;
  subtext?: string;
  revisions?: { id: string; stage: number }[];
}

export interface NotifPrefs {
  enabled: boolean;
  planStart: boolean; planStartDays: number;
  planEnd: boolean; planEndDays: number;
  overdue: boolean;
  prelimsCountdown: boolean; prelimsDays: number;
  mainsCountdown: boolean; mainsDays: number;
  lowAbsorption: boolean; absorptionPct: number;
  streak: boolean; streakDays: number;
  revision: boolean;
  daily: boolean; dailyTime: string;
  evening: boolean; eveningTime: string;
  customReminder: boolean; customText: string; customTime: string;
  snoozeDuration: number;
  repeatMinutes: number;
}

export const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  planStart: true, planStartDays: 1,
  planEnd: true, planEndDays: 2,
  overdue: true,
  prelimsCountdown: true, prelimsDays: 30,
  mainsCountdown: true, mainsDays: 30,
  lowAbsorption: false, absorptionPct: 15,
  streak: false, streakDays: 1,
  revision: false,
  daily: false, dailyTime: '09:00',
  evening: false, eveningTime: '21:00',
  customReminder: false, customText: '', customTime: '14:00',
  snoozeDuration: 24,
  repeatMinutes: 30,
};

export interface PlanRow {
  plan_id: string;
  plan_title: string;
  start_date: string | null;
  end_date: string | null;
  notif_enabled: boolean | null;
}

export interface NotifData { prefs: NotifPrefs; plans: PlanRow[]; checked?: CheckedRow[] }

// ── Snooze (24h default) and "attended today" for time-based reminders ───────
export function isSnoozed(key: string): boolean {
  try {
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}') as Record<string, number>;
    if (snoozed[key] && snoozed[key] > Date.now()) return true;
    if (snoozed[key]) { delete snoozed[key]; localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed)); }
  } catch { /* ignore */ }
  return false;
}

export function snooze(key: string, hours = 24) {
  try {
    const snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}') as Record<string, number>;
    snoozed[key] = Date.now() + hours * 3_600_000;
    localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed));
  } catch { /* ignore */ }
}

export const SNOOZE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
];

export const REMINDER_IDS = ['custom_reminder', 'daily_reminder', 'evening_reminder'];

const localDay = (d = new Date()) => d.toLocaleDateString('en-CA');

export function isAckedToday(key: string, now = new Date()): boolean {
  try {
    const ack = JSON.parse(localStorage.getItem('upsc_notif_ack') || '{}') as Record<string, string>;
    return ack[key] === localDay(now);
  } catch { return false; }
}

export function ackToday(key: string, now = new Date()) {
  try {
    const ack = JSON.parse(localStorage.getItem('upsc_notif_ack') || '{}') as Record<string, string>;
    ack[key] = localDay(now);
    localStorage.setItem('upsc_notif_ack', JSON.stringify(ack));
  } catch { /* ignore */ }
}

// ── Data loading (settings + plans) ─────────────────────────────────────────
export async function fetchNotifData(userId: string): Promise<NotifData> {
  const [{ data: profileRow }, { data: plans }] = await Promise.all([
    supabase.from('upsc_user_profiles').select('notif_settings').eq('user_id', userId).maybeSingle(),
    supabase.from('upsc_custom_plans').select('plan_id,plan_title,start_date,end_date,notif_enabled').eq('user_id', userId),
  ]);
  const prefs = { ...DEFAULT_PREFS, ...((profileRow?.notif_settings as Partial<NotifPrefs> | null) ?? {}) };
  let checked: CheckedRow[] | undefined;
  if (prefs.revision) {
    const { data } = await supabase.from('upsc_tracker_progress').select('id,updated_at').eq('user_id', userId).eq('is_checked', true).limit(5000);
    checked = ((data as CheckedRow[] | null) ?? []).filter((r) => r.id.startsWith('uid-'));
  }
  return { prefs, plans: (plans as PlanRow[] | null) ?? [], checked };
}

type ProgressLike = Map<string, { id: string; is_checked: boolean }> | undefined;

const plural = (n: number) => `${n} day${n > 1 ? 's' : ''}`;

// ── Pure: which alerts are due right now ────────────────────────────────────
export function buildAlerts(data: NotifData, progress: ProgressLike, now = new Date()): Alert[] {
  const { prefs, plans } = data;
  if (!prefs.enabled) return [];

  const out: Alert[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (const plan of plans) {
    if (!plan.notif_enabled) continue;

    if (prefs.planStart && plan.start_date) {
      const diff = Math.round((new Date(plan.start_date + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
      const key = `plan_start_${plan.plan_id}`;
      if (diff >= 0 && diff <= prefs.planStartDays && !isSnoozed(key)) {
        out.push({ id: key, type: 'plan', message: `📋 "${plan.plan_title}" starts ${diff === 0 ? 'today' : `in ${plural(diff)}`}`, subtext: plan.start_date });
      }
    }
    if (prefs.planEnd && plan.end_date) {
      const diff = Math.round((new Date(plan.end_date + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
      const key = `plan_end_${plan.plan_id}`;
      if (diff >= 0 && diff <= prefs.planEndDays && !isSnoozed(key)) {
        out.push({ id: key, type: 'plan', message: `⏰ "${plan.plan_title}" ends ${diff === 0 ? 'today' : `in ${plural(diff)}`}`, subtext: plan.end_date });
      }
    }
    if (prefs.overdue && plan.end_date) {
      const diff = Math.round((today.getTime() - new Date(plan.end_date + 'T00:00:00').getTime()) / 86_400_000);
      const key = `plan_overdue_${plan.plan_id}`;
      if (diff > 0 && !isSnoozed(key)) {
        out.push({ id: key, type: 'overdue', message: `🔴 "${plan.plan_title}" is ${plural(diff)} overdue`, subtext: plan.end_date });
      }
    }
  }

  if (prefs.prelimsCountdown) {
    const diff = Math.round((new Date(ENV.PRELIMS_DATE).getTime() - today.getTime()) / 86_400_000);
    const key = `prelims_cd_${prefs.prelimsDays}`;
    if (diff <= prefs.prelimsDays && diff >= 0 && !isSnoozed(key)) {
      out.push({ id: key, type: 'exam', message: `🎯 Prelims in ${diff} days — ${ENV.PRELIMS_DATE.split(' ').slice(0, 3).join(' ')}` });
    }
  }
  if (prefs.mainsCountdown) {
    const diff = Math.round((new Date(ENV.MAINS_DATE).getTime() - today.getTime()) / 86_400_000);
    const key = `mains_cd_${prefs.mainsDays}`;
    if (diff <= prefs.mainsDays && diff >= 0 && !isSnoozed(key)) {
      out.push({ id: key, type: 'exam', message: `📝 Mains in ${diff} days — ${ENV.MAINS_DATE.split(' ').slice(0, 3).join(' ')}` });
    }
  }

  if (prefs.lowAbsorption && progress && progress.size > 0) {
    let total = 0, checked = 0;
    progress.forEach((row) => {
      if (row.id.startsWith('uid-') || row.id.startsWith('custom_')) { total++; if (row.is_checked) checked++; }
    });
    if (total > 0) {
      const pct = (checked / total) * 100;
      if (pct < prefs.absorptionPct && !isSnoozed('low_abs')) {
        out.push({ id: 'low_abs', type: 'warning', message: `⚠️ Absorption at ${pct.toFixed(1)}% — below your ${prefs.absorptionPct}% target!` });
      }
    }
  }

  if (prefs.streak) {
    const lastFocus = localStorage.getItem('upsc_last_focus_ts');
    if (lastFocus) {
      const hoursSince = (now.getTime() - parseInt(lastFocus)) / 3_600_000;
      if (hoursSince >= prefs.streakDays * 24 && !isSnoozed('streak')) {
        const dStr = hoursSince >= 48 ? `${Math.floor(hoursSince / 24)} days` : `${Math.round(hoursSince)}h`;
        out.push({ id: 'streak', type: 'streak', message: `🔥 No focus session for ${dStr}. Keep the momentum going!` });
      }
    }
  }

  if (prefs.revision && data.checked && !isSnoozed('revision_due')) {
    const due = dueRevisions(data.checked, STAGES, loadRevisionDone(), now);
    if (due.length > 0) {
      out.push({ id: 'revision_due', type: 'revision', ...revisionAlertParts(due), revisions: due.map((d) => ({ id: d.id, stage: d.stage })) });
    }
  }

  // Time reminders: due from the set time onward, and they stay until attended that day
  const reminder = (enabled: boolean, time: string, key: string, msg: string) => {
    if (!enabled) return;
    const [h, m] = (time || '09:00').split(':').map((n) => parseInt(n, 10));
    const minsNow = now.getHours() * 60 + now.getMinutes();
    if (minsNow >= (h || 0) * 60 + (m || 0) && !isSnoozed(key) && !isAckedToday(key, now)) {
      out.push({ id: key, type: 'info', message: msg });
    }
  };
  if (prefs.customText.trim()) reminder(prefs.customReminder, prefs.customTime, 'custom_reminder', `💬 ${prefs.customText}`);
  reminder(prefs.daily, prefs.dailyTime, 'daily_reminder', '🌅 Good morning! Time to study. Consistency beats intensity every day.');
  reminder(prefs.evening, prefs.eveningTime, 'evening_reminder', '🌙 Evening check-in: review today\'s notes and plan tomorrow\'s targets!');

  return out;
}

// Reminders first (they are time-critical), then overdue/plan/exam/others.
const PRIORITY: Record<string, number> = { info: 0, overdue: 1, plan: 2, exam: 3, warning: 4, streak: 5 };
export const sortAlerts = (alerts: Alert[]) => [...alerts].sort((a, b) => (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9));
