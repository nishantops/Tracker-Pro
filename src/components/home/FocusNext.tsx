import { useEffect, useMemo, useState } from 'react';
import { STAGES } from '../../data/syllabus';
import { useAuth } from '../../context/AuthContext';
import { loadCloudPref, saveCloudPref } from '../../lib/cloudPrefs';
import { suggestTopics } from '../../lib/focusNext';

interface Props {
  progress: { get(id: string): { is_checked: boolean } | undefined } | undefined;
  onOpenSyllabus: () => void;
}

const MAX_PINS = 8;
const pinKey = (uid: string) => `upsc_focus_pins_${uid}`;

interface Topic { id: string; text: string; section: string }
const ALL_TOPICS: Topic[] = STAGES.flatMap((st) =>
  st.sections.flatMap((sec) => sec.topics.map((text, i) => ({ id: `uid-${sec.key}-${i}`, text, section: sec.label }))));
const TOPIC_BY_ID = new Map(ALL_TOPICS.map((t) => [t.id, t]));

const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function readWeaknesses(uid: string | undefined): string[] {
  if (!uid) return [];
  try {
    const d = JSON.parse(localStorage.getItem(`upsc_sw_${uid}`) ?? 'null') as { weaknesses?: { text: string }[] } | null;
    return (d?.weaknesses ?? []).map((w) => w.text).filter(Boolean);
  } catch { return []; }
}

const cleanPins = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && TOPIC_BY_ID.has(x)).slice(0, MAX_PINS);

function readPins(uid: string | undefined): string[] {
  if (!uid) return [];
  try { return cleanPins(JSON.parse(localStorage.getItem(pinKey(uid)) ?? '[]')); } catch { return []; }
}

// "Work on this next": your own pinned topics first, then topics matching your weaknesses, else your least-covered section.
export function FocusNext({ progress, onOpenSyllabus }: Props) {
  const { user } = useAuth();
  const [weak, setWeak] = useState<string[]>(() => readWeaknesses(user?.id));
  const [pins, setPins] = useState<string[]>(() => readPins(user?.id));
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setWeak(readWeaknesses(user?.id));
    const on = () => setWeak(readWeaknesses(user?.id));
    window.addEventListener('upsc-sw-changed', on);
    return () => window.removeEventListener('upsc-sw-changed', on);
  }, [user]);

  // Pins follow the account
  useEffect(() => {
    if (!user) return;
    setPins(readPins(user.id));
    let cancelled = false;
    loadCloudPref<{ ids?: unknown }>(user.id, 'focus_pins').then((r) => {
      if (cancelled || !r.ok) return;
      if (r.found) {
        const ids = cleanPins(r.value?.ids);
        setPins(ids);
        try { localStorage.setItem(pinKey(user.id), JSON.stringify(ids)); } catch { /* ignore */ }
      } else if (readPins(user.id).length > 0) {
        saveCloudPref(user.id, 'focus_pins', { ids: readPins(user.id) });
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const savePins = (next: string[]) => {
    setPins(next);
    if (!user) return;
    try { localStorage.setItem(pinKey(user.id), JSON.stringify(next)); } catch { /* ignore */ }
    saveCloudPref(user.id, 'focus_pins', { ids: next });
  };

  const emptyProgress = useMemo(() => ({ get: () => undefined }), []);

  // A ticked topic drops off the list by itself
  const pinned = pins.map((id) => TOPIC_BY_ID.get(id)).filter((t): t is Topic => !!t && !progress?.get(t.id)?.is_checked);
  const plan = useMemo(() => suggestTopics(weak, progress ?? emptyProgress, STAGES, 5 + pins.length), [weak, progress, emptyProgress, pins.length]);
  const suggestions = plan.suggestions.filter((s) => !pins.includes(s.id)).slice(0, 5);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL_TOPICS
      .filter((t) => !pins.includes(t.id) && !progress?.get(t.id)?.is_checked && (t.text.toLowerCase().includes(q) || t.section.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [query, pins, progress]);

  const pin = (id: string) => { if (pins.length < MAX_PINS && !pins.includes(id)) savePins([...pins, id]); };

  return (
    <div className="neo-card rounded-3xl p-5 focus-next">
      <div className="focus-next-head">
        <h3 className="study-title">🎯 Work on this next</h3>
        <button type="button" className="study-goal-btn" onClick={() => { setPicking((p) => !p); setQuery(''); }}>
          {picking ? 'Close' : '+ Pick topics'}
        </button>
      </div>

      {picking && (
        <div className="focus-next-picker">
          <input
            type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the syllabus, e.g. polity, geography, ethics…" aria-label="Search syllabus topics"
          />
          {pins.length >= MAX_PINS && <p className="focus-next-note">You can pin up to {MAX_PINS} topics. Remove one to add another.</p>}
          {query.trim().length >= 2 && matches.length === 0 && <p className="focus-next-note">No unticked topic matches.</p>}
          <ul className="focus-next-list">
            {matches.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pin(t.id)} disabled={pins.length >= MAX_PINS} title="Pin to this list">
                  <span className="focus-next-text">{clip(t.text)}</span>
                  <span className="focus-next-meta">📌 Pin · {t.section}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pinned.length > 0 && (
        <>
          <p className="focus-next-note">Your picks (they clear when you tick them in the syllabus):</p>
          <ul className="focus-next-list">
            {pinned.map((t) => (
              <li key={t.id} className="focus-next-pinned">
                <button type="button" onClick={onOpenSyllabus} title="Open the syllabus">
                  <span className="focus-next-text">{clip(t.text)}</span>
                  <span className="focus-next-meta">📌 {t.section}</span>
                </button>
                <button type="button" className="focus-next-unpin" aria-label={`Unpin ${t.section} topic`} onClick={() => savePins(pins.filter((p) => p !== t.id))}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {plan.reason === 'done' && pinned.length === 0 && <p className="focus-next-note">Every syllabus topic is ticked. Time to revise and practise.</p>}
      {plan.reason === 'weakness' && suggestions.length > 0 && <p className="focus-next-note">Topics that match your listed weaknesses:</p>}
      {plan.reason === 'least-covered' && suggestions.length > 0 && (
        <p className="focus-next-note">
          {weak.length > 0 ? 'Your weaknesses are habit-related, so here is' : 'Here is'} your least-covered area: <b>{plan.area}</b>
        </p>
      )}
      <ul className="focus-next-list">
        {suggestions.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={onOpenSyllabus} title="Open the syllabus">
              <span className="focus-next-text">{s.text}</span>
              <span className="focus-next-meta">{s.section}{s.match ? ` · ${s.match}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="focus-next-how">
        Suggestions come from topics matching the words in your Weaknesses (Strengths &amp; Weaknesses panel). If none match, the section you have ticked least is shown. Use “+ Pick topics” to choose your own.
      </p>
    </div>
  );
}
