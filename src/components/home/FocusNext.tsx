import { useEffect, useMemo, useState } from 'react';
import { STAGES } from '../../data/syllabus';
import { useAuth } from '../../context/AuthContext';
import { suggestTopics } from '../../lib/focusNext';

interface Props {
  progress: { get(id: string): { is_checked: boolean } | undefined } | undefined;
  onOpenSyllabus: () => void;
}

function readWeaknesses(uid: string | undefined): string[] {
  if (!uid) return [];
  try {
    const d = JSON.parse(localStorage.getItem(`upsc_sw_${uid}`) ?? 'null') as { weaknesses?: { text: string }[] } | null;
    return (d?.weaknesses ?? []).map((w) => w.text).filter(Boolean);
  } catch { return []; }
}

// "Work on this next": syllabus topics that match your listed weaknesses, else your least-covered section.
export function FocusNext({ progress, onOpenSyllabus }: Props) {
  const { user } = useAuth();
  const [weak, setWeak] = useState<string[]>(() => readWeaknesses(user?.id));

  useEffect(() => {
    setWeak(readWeaknesses(user?.id));
    const on = () => setWeak(readWeaknesses(user?.id));
    window.addEventListener('upsc-sw-changed', on);
    return () => window.removeEventListener('upsc-sw-changed', on);
  }, [user]);

  const emptyProgress = useMemo(() => ({ get: () => undefined }), []);
  const plan = useMemo(() => suggestTopics(weak, progress ?? emptyProgress, STAGES), [weak, progress, emptyProgress]);

  return (
    <div className="neo-card rounded-3xl p-5 focus-next">
      <h3 className="study-title">🎯 Work on this next</h3>
      {plan.reason === 'done' && <p className="focus-next-note">Every syllabus topic is ticked. Time to revise and practise.</p>}
      {plan.reason === 'weakness' && <p className="focus-next-note">Topics that match your listed weaknesses:</p>}
      {plan.reason === 'least-covered' && (
        <p className="focus-next-note">
          {weak.length > 0 ? 'Your weaknesses are habit-related, so here is' : 'Here is'} your least-covered area: <b>{plan.area}</b>
        </p>
      )}
      <ul className="focus-next-list">
        {plan.suggestions.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={onOpenSyllabus} title="Open the syllabus">
              <span className="focus-next-text">{s.text}</span>
              <span className="focus-next-meta">{s.section}{s.match ? ` · ${s.match}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
