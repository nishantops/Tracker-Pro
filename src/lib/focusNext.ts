import type { SyllabusStage } from '../data/syllabus';

export interface Suggestion {
  id: string;            // uid-{section}-{idx}
  text: string;
  section: string;       // section label
  match?: string;        // weakness it matched
}

export interface FocusPlan {
  suggestions: Suggestion[];
  reason: 'weakness' | 'least-covered' | 'done';
  area?: string;         // section label for the fallback
}

const STOP = new Set(['with', 'from', 'that', 'this', 'have', 'been', 'your', 'about', 'into', 'over', 'under', 'more', 'less', 'very', 'too', 'much', 'many']);

export const keywordsOf = (text: string): string[] =>
  Array.from(new Set(
    text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)),
  ));

type Progress = { get(id: string): { is_checked: boolean } | undefined };

const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Weakness lines are matched against syllabus topic text; with no subject-style matches, falls back to the least-covered section.
export function suggestTopics(weaknesses: string[], progress: Progress, stages: SyllabusStage[], limit = 5): FocusPlan {
  const sections = stages.flatMap((st) => st.sections);
  const unchecked = (key: string, i: number) => !progress.get(`uid-${key}-${i}`)?.is_checked;

  const scored: (Suggestion & { score: number })[] = [];
  for (const w of weaknesses) {
    const kws = keywordsOf(w);
    if (kws.length === 0) continue;
    for (const sec of sections) {
      sec.topics.forEach((t, i) => {
        if (!unchecked(sec.key, i)) return;
        const low = t.toLowerCase();
        const hits = kws.filter((k) => low.includes(k)).length;
        if (hits > 0) scored.push({ id: `uid-${sec.key}-${i}`, text: clip(t), section: sec.label, match: w, score: hits });
      });
    }
  }
  if (scored.length > 0) {
    const seen = new Set<string>();
    const top = scored
      .sort((a, b) => b.score - a.score)
      .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
      .slice(0, limit)
      .map(({ score: _s, ...rest }) => rest);
    return { suggestions: top, reason: 'weakness' };
  }

  let worst: { sec: (typeof sections)[number]; pct: number } | null = null;
  for (const sec of sections) {
    if (sec.topics.length === 0) continue;
    const done = sec.topics.filter((_, i) => !unchecked(sec.key, i)).length;
    const pct = done / sec.topics.length;
    if (pct < 1 && (!worst || pct < worst.pct)) worst = { sec, pct };
  }
  if (!worst) return { suggestions: [], reason: 'done' };
  const out: Suggestion[] = [];
  worst.sec.topics.forEach((t, i) => {
    if (out.length < limit && unchecked(worst!.sec.key, i)) out.push({ id: `uid-${worst!.sec.key}-${i}`, text: clip(t), section: worst!.sec.label });
  });
  return { suggestions: out, reason: 'least-covered', area: worst.sec.label };
}
