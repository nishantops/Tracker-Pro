import type { SyllabusStage } from '../data/syllabus';

// Spaced revision: a studied topic is due again ~1, ~7 and ~30 days after it was checked.
// Each stage has a window so that old topics don't pile up as a backlog when the feature is switched on.
export const REVISION_WINDOWS: ReadonlyArray<readonly [number, number]> = [[1, 3], [7, 14], [30, 60]];

export interface CheckedRow { id: string; updated_at: string | null }
export interface DueRevision { id: string; text: string; stage: number; ageDays: number }

const STORE_KEY = 'upsc_revision_done';

export function loadRevisionDone(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return v && typeof v === 'object' ? (v as Record<string, number>) : {};
  } catch { return {}; }
}

export function markRevised(items: { id: string; stage: number }[]) {
  const done = loadRevisionDone();
  for (const { id, stage } of items) done[id] = Math.max(done[id] ?? 0, stage + 1);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(done)); } catch { /* ignore */ }
}

const dayNumber = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);

export function dueRevisions(
  checked: CheckedRow[],
  stages: SyllabusStage[],
  done: Record<string, number>,
  now = new Date(),
): DueRevision[] {
  const text = new Map<string, string>();
  for (const st of stages) for (const sec of st.sections) sec.topics.forEach((t, i) => text.set(`uid-${sec.key}-${i}`, t));

  const today = dayNumber(now);
  const out: DueRevision[] = [];
  for (const row of checked) {
    const topic = text.get(row.id);
    if (!topic || !row.updated_at) continue;
    const when = new Date(row.updated_at);
    if (Number.isNaN(when.getTime())) continue;
    const ageDays = today - dayNumber(when);
    for (let s = done[row.id] ?? 0; s < REVISION_WINDOWS.length; s++) {
      const [from, to] = REVISION_WINDOWS[s]!;
      if (ageDays < from) break;           // not yet due
      if (ageDays <= to) { out.push({ id: row.id, text: topic, stage: s, ageDays }); break; }
      // window already missed: try the next stage
    }
  }
  return out.sort((a, b) => b.ageDays - a.ageDays);
}

const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function revisionAlertParts(due: DueRevision[]) {
  const names = due.slice(0, 3).map((d) => clip(d.text)).join(' · ');
  return {
    message: `🔁 ${due.length} topic${due.length > 1 ? 's' : ''} due for revision`,
    subtext: due.length > 3 ? `${names} · +${due.length - 3} more` : names,
  };
}
