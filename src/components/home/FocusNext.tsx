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
const MAX_CUSTOM = 8;
const MAX_CUSTOM_LEN = 160;
const prefsKey = (uid: string) => `upsc_focus_pins_${uid}`;

interface Topic { id: string; text: string; section: string }
interface Custom { id: string; text: string }
interface Prefs { ids: string[]; custom: Custom[]; hidden: string[] }
const EMPTY: Prefs = { ids: [], custom: [], hidden: [] };

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

const strings = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string');

// Accepts the first version's plain array of syllabus ids as well as {ids, custom, hidden}
function parsePrefs(v: unknown): Prefs {
  if (Array.isArray(v)) return { ...EMPTY, ids: strings(v).filter((x) => TOPIC_BY_ID.has(x)).slice(0, MAX_PINS) };
  if (!v || typeof v !== 'object') return EMPTY;
  const o = v as { ids?: unknown; custom?: unknown; hidden?: unknown };
  const custom = (Array.isArray(o.custom) ? o.custom : [])
    .filter((c): c is Custom => !!c && typeof (c as Custom).id === 'string' && typeof (c as Custom).text === 'string' && (c as Custom).text.trim() !== '')
    .map((c) => ({ id: c.id, text: c.text.trim().slice(0, MAX_CUSTOM_LEN) }))
    .slice(0, MAX_CUSTOM);
  return {
    ids: strings(o.ids).filter((x) => TOPIC_BY_ID.has(x)).slice(0, MAX_PINS),
    custom,
    hidden: strings(o.hidden).slice(0, 200),
  };
}

function readPrefs(uid: string | undefined): Prefs {
  if (!uid) return EMPTY;
  try { return parsePrefs(JSON.parse(localStorage.getItem(prefsKey(uid)) ?? 'null')); } catch { return EMPTY; }
}

// "Work on this next": your own picks (syllabus or free text) first, then topics matching your weaknesses, else your least-covered section.
export function FocusNext({ progress, onOpenSyllabus }: Props) {
  const { user } = useAuth();
  const [weak, setWeak] = useState<string[]>(() => readWeaknesses(user?.id));
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(user?.id));
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setWeak(readWeaknesses(user?.id));
    const on = () => setWeak(readWeaknesses(user?.id));
    window.addEventListener('upsc-sw-changed', on);
    return () => window.removeEventListener('upsc-sw-changed', on);
  }, [user]);

  // Picks follow the account
  useEffect(() => {
    if (!user) return;
    setPrefs(readPrefs(user.id));
    let cancelled = false;
    loadCloudPref<unknown>(user.id, 'focus_pins').then((r) => {
      if (cancelled || !r.ok) return;
      if (r.found) {
        const next = parsePrefs(r.value);
        setPrefs(next);
        try { localStorage.setItem(prefsKey(user.id), JSON.stringify(next)); } catch { /* ignore */ }
      } else {
        const local = readPrefs(user.id);
        if (local.ids.length + local.custom.length + local.hidden.length > 0) saveCloudPref(user.id, 'focus_pins', local);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  const save = (next: Prefs) => {
    setPrefs(next);
    if (!user) return;
    try { localStorage.setItem(prefsKey(user.id), JSON.stringify(next)); } catch { /* ignore */ }
    saveCloudPref(user.id, 'focus_pins', next);
  };

  const emptyProgress = useMemo(() => ({ get: () => undefined }), []);

  // A ticked syllabus topic drops off the list by itself
  const pinned = prefs.ids.map((id) => TOPIC_BY_ID.get(id)).filter((t): t is Topic => !!t && !progress?.get(t.id)?.is_checked);
  const plan = useMemo(
    () => suggestTopics(weak, progress ?? emptyProgress, STAGES, 5 + prefs.ids.length + prefs.hidden.length),
    [weak, progress, emptyProgress, prefs.ids.length, prefs.hidden.length],
  );
  const suggestions = plan.suggestions.filter((s) => !prefs.ids.includes(s.id) && !prefs.hidden.includes(s.id)).slice(0, 5);

  const q = query.trim();
  const matches = useMemo(() => {
    const low = q.toLowerCase();
    if (low.length < 2) return [];
    return ALL_TOPICS
      .filter((t) => !prefs.ids.includes(t.id) && !progress?.get(t.id)?.is_checked && (t.text.toLowerCase().includes(low) || t.section.toLowerCase().includes(low)))
      .slice(0, 12);
  }, [q, prefs.ids, progress]);

  const pin = (id: string) => { if (prefs.ids.length < MAX_PINS && !prefs.ids.includes(id)) save({ ...prefs, ids: [...prefs.ids, id] }); };
  const unpin = (id: string) => save({ ...prefs, ids: prefs.ids.filter((p) => p !== id) });
  const addCustom = () => {
    if (!q || prefs.custom.length >= MAX_CUSTOM) return;
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    save({ ...prefs, custom: [...prefs.custom, { id, text: q.slice(0, MAX_CUSTOM_LEN) }] });
    setQuery('');
  };
  const removeCustom = (id: string) => save({ ...prefs, custom: prefs.custom.filter((c) => c.id !== id) });
  const hide = (id: string) => save({ ...prefs, hidden: [...prefs.hidden, id] });

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
            onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
            maxLength={MAX_CUSTOM_LEN}
            placeholder="Search the syllabus, or type your own topic and press Enter" aria-label="Search syllabus topics"
          />
          {prefs.ids.length >= MAX_PINS && <p className="focus-next-note">You can pin up to {MAX_PINS} syllabus topics. Remove one to add another.</p>}
          <ul className="focus-next-list">
            {q.length > 0 && (
              <li>
                <button type="button" onClick={addCustom} disabled={prefs.custom.length >= MAX_CUSTOM} title="Add this as a topic of your own">
                  <span className="focus-next-text">＋ Add “{clip(q, 60)}” as my own topic</span>
                  <span className="focus-next-meta">{prefs.custom.length >= MAX_CUSTOM ? `Limit of ${MAX_CUSTOM} own topics reached` : '✍ Not from the syllabus'}</span>
                </button>
              </li>
            )}
            {matches.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pin(t.id)} disabled={prefs.ids.length >= MAX_PINS} title="Pin to this list">
                  <span className="focus-next-text">{clip(t.text)}</span>
                  <span className="focus-next-meta">📌 Pin · {t.section}</span>
                </button>
              </li>
            ))}
          </ul>
          {q.length >= 2 && matches.length === 0 && <p className="focus-next-note">No unticked syllabus topic matches.</p>}
        </div>
      )}

      {(pinned.length > 0 || prefs.custom.length > 0) && (
        <>
          <p className="focus-next-note">Your picks (syllabus ones clear when you tick them there):</p>
          <ul className="focus-next-list">
            {pinned.map((t) => (
              <li key={t.id} className="focus-next-pinned">
                <button type="button" onClick={onOpenSyllabus} title="Open the syllabus">
                  <span className="focus-next-text">{clip(t.text)}</span>
                  <span className="focus-next-meta">📌 {t.section}</span>
                </button>
                <button type="button" className="focus-next-unpin" aria-label={`Unpin ${t.section} topic`} onClick={() => unpin(t.id)}>✕</button>
              </li>
            ))}
            {prefs.custom.map((c) => (
              <li key={c.id} className="focus-next-pinned focus-next-custom">
                <div className="focus-next-item">
                  <span className="focus-next-text">{c.text}</span>
                  <span className="focus-next-meta">✍ My topic</span>
                </div>
                <button type="button" className="focus-next-unpin" aria-label={`Mark done: ${c.text}`} title="Mark done" onClick={() => removeCustom(c.id)}>✓</button>
                <button type="button" className="focus-next-unpin" aria-label={`Remove: ${c.text}`} title="Remove" onClick={() => removeCustom(c.id)}>✕</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {plan.reason === 'done' && pinned.length === 0 && prefs.custom.length === 0 && <p className="focus-next-note">Every syllabus topic is ticked. Time to revise and practise.</p>}
      {plan.reason === 'weakness' && suggestions.length > 0 && <p className="focus-next-note">Topics that match your listed weaknesses:</p>}
      {plan.reason === 'least-covered' && suggestions.length > 0 && (
        <p className="focus-next-note">
          {weak.length > 0 ? 'Your weaknesses are habit-related, so here is' : 'Here is'} your least-covered area: <b>{plan.area}</b>
        </p>
      )}
      <ul className="focus-next-list">
        {suggestions.map((s) => (
          <li key={s.id} className="focus-next-pinned focus-next-suggested">
            <button type="button" onClick={onOpenSyllabus} title="Open the syllabus">
              <span className="focus-next-text">{s.text}</span>
              <span className="focus-next-meta">{s.section}{s.match ? ` · ${s.match}` : ''}</span>
            </button>
            <button type="button" className="focus-next-unpin" aria-label={`Hide suggestion: ${s.section}`} title="Hide this suggestion" onClick={() => hide(s.id)}>✕</button>
          </li>
        ))}
      </ul>
      {prefs.hidden.length > 0 && (
        <button type="button" className="focus-next-restore" onClick={() => save({ ...prefs, hidden: [] })}>Show {prefs.hidden.length} hidden suggestion{prefs.hidden.length > 1 ? 's' : ''}</button>
      )}
      <p className="focus-next-how">
        Suggestions come from topics matching the words in your Weaknesses (Strengths &amp; Weaknesses panel). If none match, the section you have ticked least is shown. Use “+ Pick topics” to choose syllabus topics or add your own.
      </p>
    </div>
  );
}
