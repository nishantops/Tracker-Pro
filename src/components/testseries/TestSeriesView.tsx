import { useState, memo, useEffect, useRef } from 'react';
import { useTracker } from '../../hooks/useTracker';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { TS_PRELIMS, TS_MAINS } from '../../data/ts-data';

type Stage = 'prelims' | 'mains';

export function TestSeriesView() {
  const { progress, toggleCheck, updateNote } = useTracker();
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>('prelims');
  const [activePaper, setActivePaper] = useState(0);
  const [customTests, setCustomTests] = useState<Record<string, string[]>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTestName, setNewTestName] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const papers = stage === 'prelims' ? TS_PRELIMS : TS_MAINS;
  const paper = papers[activePaper] ?? papers[0];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('upsc_tracker_progress')
        .select('id')
        .eq('user_id', user.id)
        .like('id', 'uid-ts-custom-%');
      if (!data) return;
      const map: Record<string, string[]> = {};
      const allPapers = [...TS_PRELIMS, ...TS_MAINS];
      data.forEach((row) => {
        const pk = allPapers.find((p) => row.id.startsWith(`uid-ts-custom-${p.key}-`))?.key;
        if (!pk) return;
        const encoded = row.id.replace(`uid-ts-custom-${pk}-`, '');
        let name = encoded;
        try { name = decodeURIComponent(escape(atob(encoded))); } catch { /* ignore */ }
        if (!map[pk]) map[pk] = [];
        map[pk].push(name);
      });
      setCustomTests(map);
    };
    load();
  }, [user]);

  const handleAddTest = async (paperKey: string) => {
    const name = newTestName.trim();
    if (!name || !user) { setAddingFor(null); setNewTestName(''); return; }
    const encoded = btoa(unescape(encodeURIComponent(name)));
    const id = `uid-ts-custom-${paperKey}-${encoded}`;
    await supabase.from('upsc_tracker_progress').upsert(
      { id, user_id: user.id, is_checked: false, topic_note: '', updated_at: new Date().toISOString() },
      { onConflict: 'id,user_id' },
    );
    setCustomTests((prev) => ({ ...prev, [paperKey]: [...(prev[paperKey] ?? []), name] }));
    setAddingFor(null);
    setNewTestName('');
  };

  const customItems = customTests[paper.key] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-row gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
        {(['prelims', 'mains'] as Stage[]).map((s) => (
          <button key={s}
            className={`cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all heading-font ${
              stage === s ? 'bg-indigo-600 text-white shadow-md' : 'stage-btn-inactive'
            }`}
            onClick={() => { setStage(s); setActivePaper(0); setAddingFor(null); }}>
            {s === 'prelims' ? 'Stage I: Prelims' : 'Stage II: Mains & Optional'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap scrollbar-none p-1.5 rounded-xl border border-violet-500/20"
          style={{ background: 'rgba(30,12,74,0.45)' }}>
          {papers.map((p, i) => (
            <button key={p.key}
              className={`inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all ${
                activePaper === i
                  ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500'
                  : 'border border-transparent hover:bg-white/10'
              }`}
              style={activePaper !== i ? { color: 'var(--t2)' } : undefined}
              onClick={() => { setActivePaper(i); setAddingFor(null); }}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="neo-card rounded-3xl p-6">
          <div className="flex justify-between items-center border-b border-violet-500/20 pb-3 mb-4">
            <h2 className="heading-font text-xl font-black">Test Series: {paper.label}</h2>
            <button
              onClick={() => { setAddingFor(paper.key); setNewTestName(''); setTimeout(() => addInputRef.current?.focus(), 50); }}
              className="cursor-pointer bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm font-mono">
              + ADD TEST
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {paper.items.map((name, idx) => (
              <TSRow key={`${paper.prefix}-${idx}`} name={name}
                dataKey={`uid-${paper.prefix}-${idx}`}
                checked={!!progress.get(`uid-${paper.prefix}-${idx}`)?.is_checked}
                note={progress.get(`uid-${paper.prefix}-${idx}`)?.topic_note ?? ''}
                onToggle={toggleCheck} onNote={updateNote} />
            ))}

            {customItems.map((name) => {
              const encoded = btoa(unescape(encodeURIComponent(name)));
              const id = `uid-ts-custom-${paper.key}-${encoded}`;
              return (
                <TSRow key={id} name={`★ ${name}`} dataKey={id}
                  checked={!!progress.get(id)?.is_checked}
                  note={progress.get(id)?.topic_note ?? ''}
                  onToggle={toggleCheck} onNote={updateNote} />
              );
            })}

            {addingFor === paper.key && (
              <div className="flex items-center gap-2 p-3 rounded-2xl border border-indigo-500/30"
                style={{ background: 'rgba(99,102,241,0.06)' }}>
                <input ref={addInputRef} type="text" value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTest(paper.key); if (e.key === 'Escape') { setAddingFor(null); setNewTestName(''); } }}
                  placeholder="Test name (e.g. Mock Test 03)…"
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none"
                  style={{ background: 'var(--inp)', border: '1px solid var(--bdr)', color: 'var(--t1)' }} />
                <button onClick={() => handleAddTest(paper.key)}
                  className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg font-mono">
                  Add
                </button>
                <button onClick={() => { setAddingFor(null); setNewTestName(''); }}
                  className="cursor-pointer text-[10px] font-bold font-mono px-2 py-2 rounded-lg"
                  style={{ color: 'var(--t3)', background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
                  Cancel
                </button>
              </div>
            )}

            {paper.items.length === 0 && customItems.length === 0 && addingFor !== paper.key && (
              <p className="text-xs font-mono italic" style={{ color: 'var(--t3)' }}>
                No tests yet. Click &ldquo;+ ADD TEST&rdquo; to add your first test.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TSRow = memo(function TSRow({
  name,
  dataKey,
  checked,
  note,
  onToggle,
  onNote,
}: {
  name: string;
  dataKey: string;
  checked: boolean;
  note: string;
  onToggle: (key: string) => void;
  onNote: (key: string, note: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);

  return (
    <div className="task-row flex flex-col p-3.5 rounded-2xl transition duration-200 group relative">
      <div className="flex items-center justify-between w-full">
        <label className="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold tracking-tight select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(dataKey)}
            className="mt-0.5 mr-3.5 h-5 w-5 rounded-md border-violet-400/50 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
          />
          <span className={`font-medium ml-2 break-words ${checked ? 'line-through opacity-60' : ''}`}
            style={{ color: 'var(--t1)' }}>
            {name}
          </span>
        </label>
        <button
          onClick={() => setShowNote((o) => !o)}
          className="text-xs opacity-40 group-hover:opacity-100 transition cursor-pointer"
          style={{ background: 'none', border: 'none', padding: '0.2rem' }}>
          {note ? '📝' : '✏️'}
        </button>
      </div>
      {showNote && (
        <textarea
          className="w-full rounded-lg p-2 text-[11px] font-mono focus:outline-none transition-all placeholder-slate-500 mt-2"
          style={{ background: 'var(--inp)', border: '1px solid var(--bdr)', color: 'var(--t2)' }}
          placeholder="Score, remarks, date attempted…"
          value={note}
          onChange={(e) => onNote(dataKey, e.target.value)}
          rows={2}
        />
      )}
    </div>
  );
});
