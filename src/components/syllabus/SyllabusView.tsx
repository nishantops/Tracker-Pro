import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { STAGES } from '../../data/syllabus';
import { useTracker } from '../../hooks/useTracker';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { RTE } from '../common/RTE';
import { TopicList } from './TopicList';
import { TrendTable } from './TrendTable';
import { trendPrelimsGS1, trendMainsGS1, trendMainsGS2, trendMainsGS3, trendMainsGS4 } from '../../data/trends';
import type { StageTab } from '../../lib/navigation';

// Sub-tab config per stage (matches old app exactly)
const SUB_TAB_CONFIG: Record<string, { key: string; label: string; amber?: boolean }[]> = {
  prelims: [
    { key: 'p1', label: 'GS Paper I' },
    { key: 'p2', label: 'CSAT Paper II' },
    { key: 'trend-prelims', label: '\u{1F4CA} Trend' },
  ],
  mains: [
    { key: 'gs1', label: 'GS-I' },
    { key: 'gs2', label: 'GS-II' },
    { key: 'gs3', label: 'GS-III' },
    { key: 'gs4', label: 'GS-IV' },
    { key: 'es', label: 'Essay' },
    { key: 'la', label: 'Lang A' },
    { key: 'lb', label: 'Lang B' },
  ],
  anthro: [
    { key: 'a1', label: 'Paper I Focus' },
    { key: 'a2', label: 'Paper II Focus' },
    { key: 'assignments', label: 'Assignments', amber: true },
  ],
};

// Mains papers that have inner Syllabus/Trend toggle
const MAINS_TREND_PAPERS = ['gs1', 'gs2', 'gs3', 'gs4'];
const MAINS_TREND_MAP: Record<string, typeof trendMainsGS1> = {
  gs1: trendMainsGS1,
  gs2: trendMainsGS2,
  gs3: trendMainsGS3,
  gs4: trendMainsGS4,
};

interface Props {
  stage: StageTab;
}

export function SyllabusView({ stage }: Props) {
  const { progress, loading, toggleCheck, updateNote } = useTracker();
  const [activeSubTab, setActiveSubTab] = useState<string>(() => {
    const tabs = SUB_TAB_CONFIG[stage];
    return tabs?.[0]?.key ?? '';
  });
  // Inner tab for mains GS1-4 (syllabus vs trend)
  const [innerMode, setInnerMode] = useState<'syllabus' | 'trend'>('syllabus');

  const stageData = STAGES.find((s) => s.id === stage);
  if (!stageData) return null;

  const tabs = SUB_TAB_CONFIG[stage] ?? [];
  const activeSection = stageData.sections.find((s) => s.key === activeSubTab);

  // Reset to first tab when stage changes
  const firstTabKey = tabs[0]?.key ?? '';
  if (activeSubTab && !tabs.find((t) => t.key === activeSubTab)) {
    setTimeout(() => setActiveSubTab(firstTabKey), 0);
  }

  const isTrendTab = activeSubTab === 'trend-prelims';
  const isMainsWithTrend = stage === 'mains' && MAINS_TREND_PAPERS.includes(activeSubTab);
  const isAssignmentsTab = activeSubTab === 'assignments';

  return (
    <div className="space-y-4">
      {/* Paper sub-tabs */}
      <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-800/50 p-1.5 rounded-xl border border-violet-500/20">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveSubTab(tab.key); setInnerMode('syllabus'); }}
            className={`inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all ${
              activeSubTab === tab.key
                ? tab.amber
                  ? 'bg-amber-500/20 text-amber-200 shadow-sm border border-amber-500/40'
                  : 'bg-indigo-600 text-white shadow-sm border border-indigo-500'
                : tab.amber
                  ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/30 bg-amber-500/10'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="neo-card rounded-3xl p-6">
          <p className="text-xs text-slate-400 font-mono">Loading progress...</p>
        </div>
      ) : isTrendTab ? (
        <div className="neo-card rounded-3xl p-6">
          <TrendTable data={trendPrelimsGS1} title="Prelims GS1" />
        </div>
      ) : isAssignmentsTab ? (
        <AssignmentsPanel />
      ) : isMainsWithTrend ? (
        <div className="neo-card rounded-3xl p-6">
          {/* Inner Syllabus / Trend toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInnerMode('syllabus')}
              className={`text-[11px] py-1.5 px-4 rounded-lg font-bold uppercase transition-all ${
                innerMode === 'syllabus'
                  ? 'bg-violet-600 text-white border border-violet-500'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              Syllabus
            </button>
            <button
              onClick={() => setInnerMode('trend')}
              className={`text-[11px] py-1.5 px-4 rounded-lg font-bold uppercase transition-all ${
                innerMode === 'trend'
                  ? 'bg-violet-600 text-white border border-violet-500'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              📊 Trend
            </button>
          </div>
          {innerMode === 'syllabus' && activeSection ? (
            <TopicList
              key={activeSection.key}
              section={activeSection}
              progress={progress}
              onToggle={toggleCheck}
              onNote={updateNote}
              stageLabel="Mains"
            />
          ) : (
            <TrendTable data={MAINS_TREND_MAP[activeSubTab]} title={`Mains ${activeSubTab.toUpperCase()}`} />
          )}
        </div>
      ) : (
        activeSection && (
          <TopicList
            key={activeSection.key}
            section={activeSection}
            progress={progress}
            onToggle={toggleCheck}
            onNote={updateNote}
            stageLabel={stage === 'prelims' ? 'Prelims' : stage === 'anthro' ? 'Anthropology' : 'Mains'}
          />
        )
      )}
    </div>
  );
}

// ── Assignments Panel (matches old app's anthro assignments feature) ──────
function AssignmentsPanel() {
  const { user } = useAuth();
  const [fullscreen, setFullscreen] = useState(false);
  const [assignments, setAssignments] = useState<Array<{
    id: string;
    title: string;
    total: number;
    attempted: number;
    userNote: string;
    feedback: string;
    completed: boolean;
  }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // Load assignments from upsc_tracker_progress (IDs starting with custom_box-anthro-asn_)
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('upsc_tracker_progress')
        .select('id, is_checked, topic_note')
        .eq('user_id', user.id)
        .like('id', 'custom_box-anthro-asn_%');
      if (data && data.length > 0) {
        const loaded = data.map((row) => {
          let parsed: any = {};
          try { parsed = JSON.parse(row.topic_note || '{}'); } catch { /* ignore */ }
          // Decode title from the ID
          const encoded = row.id.replace('custom_box-anthro-asn_', '');
          let title = encoded;
          try { title = decodeURIComponent(escape(atob(encoded))); } catch { /* ignore */ }
          return {
            id: row.id,
            title,
            total: parsed.total || 0,
            attempted: parsed.attempted || 0,
            userNote: parsed.userNote || '',
            feedback: parsed.feedback || '',
            completed: row.is_checked,
          };
        });
        setAssignments(loaded);
      }
    };
    load();
  }, [user]);

  // Save assignment to DB
  const saveAssignment = useCallback(async (asn: { id: string; title: string; total: number; attempted: number; userNote: string; feedback: string; completed?: boolean }) => {
    if (!user) return;
    const noteData = JSON.stringify({ total: asn.total, attempted: asn.attempted, userNote: asn.userNote, feedback: asn.feedback });
    await supabase.from('upsc_tracker_progress').upsert({
      id: asn.id, user_id: user.id, is_checked: asn.completed ?? (asn.attempted >= asn.total && asn.total > 0),
      topic_note: noteData, updated_at: new Date().toISOString(),
    }, { onConflict: 'id,user_id' });
  }, [user]);

  // Debounced save for rapid edits
  const debounceSave = useCallback((asn: typeof assignments[0]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveAssignment(asn), 800);
  }, [saveAssignment]);

  const addAssignment = () => {
    if (!formTitle.trim() || !formTotal.trim()) return;
    const total = Math.max(1, parseInt(formTotal) || 1);
    const encoded = btoa(unescape(encodeURIComponent(formTitle.trim())));
    const newAsn = {
      id: `custom_box-anthro-asn_${encoded}`,
      title: formTitle.trim(),
      total,
      attempted: 0,
      userNote: '',
      feedback: '',
      completed: false,
    };
    setAssignments((prev) => [...prev, newAsn]);
    saveAssignment(newAsn);
    setFormTitle('');
    setFormTotal('');
    setShowForm(false);
  };

  const deleteAssignment = async (id: string) => {
    if (!user) return;
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    await supabase.from('upsc_tracker_progress').delete().eq('id', id).eq('user_id', user.id);
  };

  const toggleComplete = (id: string) => {
    setAssignments((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a));
      const asn = updated.find((a) => a.id === id);
      if (asn) {
        // Update is_checked in DB
        supabase.from('upsc_tracker_progress').update({
          is_checked: asn.completed,
          updated_at: new Date().toISOString(),
        }).eq('id', id).eq('user_id', user!.id).then();
      }
      return updated;
    });
  };

  const updateAttempted = (id: string, val: number) => {
    setAssignments((prev) => {
      const asn = prev.find((a) => a.id === id);
      const bounded = Math.min(Math.max(0, val), asn?.total ?? val);
      const updated = prev.map((a) => (a.id === id ? { ...a, attempted: bounded } : a));
      const found = updated.find((a) => a.id === id);
      if (found) debounceSave(found);
      return updated;
    });
  };

  const updateUserNote = (id: string, val: string) => {
    setAssignments((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, userNote: val } : a));
      const asn = updated.find((a) => a.id === id);
      if (asn) debounceSave(asn);
      return updated;
    });
  };

  const updateFeedback = (id: string, val: string) => {
    setAssignments((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, feedback: val } : a));
      const asn = updated.find((a) => a.id === id);
      if (asn) debounceSave(asn);
      return updated;
    });
  };

  const panel = (
    <div className={fullscreen ? 'asn-panel-fs' : 'neo-card rounded-3xl p-6 border-l-4 border-amber-500'}>
      <div className="flex justify-between items-center border-b border-violet-500/20 pb-3 mb-4">
        <h2 className="heading-font text-xl font-black" style={{ color: 'var(--amber-l, #f59e0b)' }}>Custom Assignments</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm font-mono btn-vibrant"
          >+ ADD ASSIGNMENT</button>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="cursor-pointer text-[10px] font-bold font-mono px-2.5 py-1.5 rounded-lg border transition-colors"
            style={{ background: 'var(--surf)', color: 'var(--t2)', borderColor: 'var(--bdr)' }}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >{fullscreen ? '✕ CLOSE' : '⛶ FS'}</button>
        </div>
      </div>

      {showForm && (
        <div className="mb-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Title *</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Chapter 5 \u2014 Kinship"
              className="w-full bg-slate-900/40 border border-violet-500/20 rounded-xl p-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Total Questions *</label>
            <input
              type="number"
              value={formTotal}
              onChange={(e) => setFormTotal(e.target.value)}
              placeholder="e.g., 20"
              className="w-full bg-slate-900/40 border border-violet-500/20 rounded-xl p-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-400"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-2 rounded-lg">Cancel</button>
            <button onClick={addAssignment} className="cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg shadow-sm">Save</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {assignments.length === 0 ? (
          <p className="text-xs text-slate-500 italic font-mono">No assignments yet. Click "+ ADD ASSIGNMENT" to start tracking.</p>
        ) : (
          assignments.map((asn) => {
            const pct = asn.total > 0 ? Math.round((asn.attempted / asn.total) * 100) : 0;
            const pieColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
            return (
              <div key={asn.id} className={`p-4 rounded-2xl border group relative transition-all ${asn.completed ? 'border-emerald-500/30 bg-emerald-500/5 opacity-80' : 'border-amber-500/20 bg-amber-500/5'}`}>
                <div className="flex items-center gap-4 mb-2">
                  {/* Pie chart */}
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: asn.total > 0 ? `conic-gradient(${pieColor} ${pct}%, rgba(100,116,139,0.3) 0%)` : 'rgba(100,116,139,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-[10px] font-black text-white font-mono">{pct}%</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-amber-500/20 text-amber-300 text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider font-black border border-amber-500/30">Assignment</span>
                      <input type="checkbox" checked={asn.completed} onChange={() => toggleComplete(asn.id)} className="h-4 w-4 rounded border-slate-500 text-emerald-500 cursor-pointer" />
                    </div>
                    <h3 className={`text-sm font-bold leading-tight break-words ${asn.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>{asn.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-mono text-slate-400">Total: <strong className="text-violet-300">{asn.total}</strong></span>
                      <span className="text-[10px] font-mono text-slate-400">Done: <strong className="text-emerald-300">{asn.attempted}</strong></span>
                      <span className="text-[10px] font-mono text-slate-400">Left: <strong className="text-rose-300">{asn.total - asn.attempted}</strong></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => deleteAssignment(asn.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition cursor-pointer" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                {!asn.completed && (
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-[10px] text-slate-400 font-mono">Attempted:</label>
                    <input
                      type="number"
                      value={asn.attempted}
                      onChange={(e) => updateAttempted(asn.id, parseInt(e.target.value) || 0)}
                      className="w-16 bg-slate-900/40 border border-violet-500/20 rounded px-2 py-1 text-xs text-slate-200"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">/ {asn.total}</span>
                  </div>
                )}
                <RTE
                  value={asn.userNote}
                  onChange={(html) => updateUserNote(asn.id, html)}
                  placeholder="Add a note..."
                  className="mb-2"
                  maxHeight="140px"
                  readOnly={asn.completed}
                />
                <RTE
                  full
                  value={asn.feedback}
                  onChange={(html) => updateFeedback(asn.id, html)}
                  placeholder="Feedback / self-review for this assignment..."
                  minHeight="90px"
                  maxHeight="200px"
                  readOnly={asn.completed}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return fullscreen ? createPortal(panel, document.body) : panel;
}
