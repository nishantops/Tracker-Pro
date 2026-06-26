import { useState, useRef, useCallback, useEffect } from 'react';
import { CA_SECTION } from '../../data/syllabus';
import { useTracker } from '../../hooks/useTracker';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { TopicList } from '../syllabus/TopicList';
import { PlanTable } from '../plans/PlanTable';
import { MultiPageNotes, parseNotePages } from '../common/MultiPageNotes';
import type { NotesPage } from '../common/MultiPageNotes';

type CATab = 'tracker' | 'links' | 'notes';
type NotesMode = 'word' | 'table';

interface CALink {
  id: string;
  title: string;
  url: string;
}

// Helper: get next suggested month name
function getNextMonthSuggestion(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) + ' Monthly Compilation';
}

export function CATrackerView() {
  const { progress, loading, toggleCheck, updateNote, addCustomTopic } = useTracker();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CATab>('tracker');

  // ── Add Month state ─────────────────────────────────────────
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [newMonthName, setNewMonthName] = useState('');

  // ── CA Links state ─────────────────────────────────────────
  const [caLinks, setCaLinks] = useState<CALink[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // ── CA Notes state ─────────────────────────────────────────
  const [notesMode, setNotesMode] = useState<NotesMode>('word');
  const [notePages, setNotePages] = useState<NotesPage[]>([{ id: 'p_default', title: 'Page 1', html: '' }]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordNoteLoaded = useRef(false);

  // Load CA links from localStorage (matches old app), seed defaults on first run
  useEffect(() => {
    const stored = localStorage.getItem('upsc_ca_links');
    if (stored) {
      try { setCaLinks(JSON.parse(stored)); } catch { /* ignore */ }
    } else {
      const defaults = [
        { id: '1', title: 'Newspaper', url: 'https://tracker.atishmathur.com/Welcome-to-your-Tracker-Pro-1365f7f7d62180b6ad13e8ee5d16ac78' },
        { id: '2', title: 'Monthly Magazine', url: 'https://visionias.in/current-affairs/monthly-magazine/archive' },
      ];
      localStorage.setItem('upsc_ca_links', JSON.stringify(defaults));
      setCaLinks(defaults);
    }
  }, []);

  // Load CA word notes from upsc_tracker_progress (id = 'ca_note_word_doc')
  useEffect(() => {
    if (!user || wordNoteLoaded.current) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('upsc_tracker_progress')
          .select('topic_note')
          .eq('id', 'ca_note_word_doc')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.topic_note) setNotePages(parseNotePages(data.topic_note));
        wordNoteLoaded.current = true;
      } catch { /* ignore */ }
    };
    if (activeTab === 'notes' && notesMode === 'word') load();
  }, [user, activeTab, notesMode]);

  // Save CA links to localStorage
  const saveLinks = useCallback((links: CALink[]) => {
    localStorage.setItem('upsc_ca_links', JSON.stringify(links));
  }, []);

  // Save CA word notes (debounced) to upsc_tracker_progress
  const saveNotes = useCallback((pages: NotesPage[]) => {
    setNotePages(pages);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!user) return;
      try {
        await supabase.from('upsc_tracker_progress').upsert(
          { id: 'ca_note_word_doc', user_id: user.id, is_checked: false, topic_note: JSON.stringify(pages), updated_at: new Date().toISOString() },
          { onConflict: 'id,user_id' }
        );
      } catch { /* ignore */ }
    }, 1200);
  }, [user]);

  // Add custom month to CA tracker
  const handleAddMonth = async () => {
    const name = newMonthName.trim() || getNextMonthSuggestion();
    if (!user) return;
    const encoded = btoa(unescape(encodeURIComponent(name)));
    const customId = `custom_box-ca_${encoded}`;
    await supabase.from('upsc_tracker_progress').upsert({
      id: customId, user_id: user.id, is_checked: false,
      topic_note: '', updated_at: new Date().toISOString(),
    }, { onConflict: 'id,user_id' });
    addCustomTopic(customId);
    setNewMonthName('');
    setShowAddMonth(false);
  };

  // CA Links handlers
  const addLink = () => {    if (!linkTitle.trim() || !linkUrl.trim()) return;
    const newLink: CALink = { id: `cal_${Date.now()}`, title: linkTitle.trim(), url: linkUrl.trim() };
    const updated = [...caLinks, newLink];
    setCaLinks(updated);
    saveLinks(updated);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkForm(false);
  };

  const removeLink = (id: string) => {
    const updated = caLinks.filter((l) => l.id !== id);
    setCaLinks(updated);
    saveLinks(updated);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap scrollbar-none bg-slate-800/50 p-1.5 rounded-xl border border-violet-500/20">
        {(['tracker', 'links', 'notes'] as CATab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500'
                : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            {tab === 'tracker' ? 'Monthly Tracker' : tab === 'links' ? 'My CA Links' : '📝 My Notes'}
          </button>
        ))}
      </div>

      {/* Monthly Tracker Panel */}
      {activeTab === 'tracker' && (
        <div className="neo-card rounded-3xl p-6">
          <div className="flex flex-wrap justify-between items-center border-b border-violet-500/20 pb-3 mb-4 gap-2">
            <h2 className="heading-font text-2xl font-black">Current Affairs (CA) Matrix</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick-link chips */}
              {caLinks.length > 0 && caLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ca-quick-link"
                >
                  {link.title}
                </a>
              ))}
              {/* Add Month button */}
              <button
                onClick={() => { setShowAddMonth((v) => !v); setNewMonthName(getNextMonthSuggestion()); }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all font-mono cursor-pointer"
              >
                + Add Month
              </button>
            </div>
          </div>
          {/* Add Month inline form */}
          {showAddMonth && (
            <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={newMonthName}
                onChange={(e) => setNewMonthName(e.target.value)}
                placeholder="e.g., July 2026 Monthly Compilation"
                className="flex-1 min-w-[200px] bg-[var(--inp)] border border-[var(--bdr)] rounded-lg px-3 py-1.5 text-xs text-[var(--t1)] focus:outline-none focus:border-emerald-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMonth(); if (e.key === 'Escape') setShowAddMonth(false); }}
              />
              <button onClick={handleAddMonth} className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg font-mono">Add</button>
              <button onClick={() => setShowAddMonth(false)} className="cursor-pointer text-[10px] font-bold text-[var(--t3)] px-2 py-1.5 hover:text-[var(--t1)] font-mono">Cancel</button>
            </div>
          )}
          {loading ? (
            <p className="text-xs text-slate-400 font-mono">Loading progress...</p>
          ) : (
            <TopicList
              section={CA_SECTION}
              progress={progress}
              onToggle={toggleCheck}
              onNote={updateNote}
            />
          )}
        </div>
      )}

      {/* CA Links Panel */}
      {activeTab === 'links' && (
        <div className="neo-card rounded-3xl p-6">
          <div className="flex justify-between items-center border-b border-violet-500/20 pb-3 mb-4">
            <h2 className="heading-font text-xl font-black">Manage CA Links</h2>
            <button
              onClick={() => setShowLinkForm(true)}
              className="cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm font-mono"
            >
              + ADD LINK
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Links added here will appear as quick-access buttons on the CA Tracker section.
          </p>

          {/* Add Link Form */}
          {showLinkForm && (
            <div className="mb-5 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">Link Title *</label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="e.g., Monthly Magazine, Newspaper"
                  className="w-full bg-slate-900/40 border border-violet-500/20 rounded-xl p-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">URL *</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-900/40 border border-violet-500/20 rounded-xl p-2.5 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowLinkForm(false)} className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-2 rounded-lg">Cancel</button>
                <button onClick={addLink} className="cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg shadow-sm">Save Link</button>
              </div>
            </div>
          )}

          {/* Links List */}
          <div className="space-y-2">
            {caLinks.length === 0 ? (
              <div className="text-xs text-slate-500 font-mono">No links added yet.</div>
            ) : (
              caLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 rounded-xl border border-violet-500/20 bg-slate-900/30">
                  <div>
                    <div className="text-sm font-bold text-slate-200">{link.title}</div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:text-indigo-300 truncate block max-w-[300px]">{link.url}</a>
                  </div>
                  <button onClick={() => removeLink(link.id)} className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2">✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CA Notes Panel */}
      {activeTab === 'notes' && (
        <div className="neo-card rounded-3xl p-6">
          {/* Header with mode toggle */}
          <div className="flex flex-wrap justify-between items-center border-b border-violet-500/20 pb-3 mb-4 gap-3">
            <h2 className="heading-font text-xl font-black">{"\u{1F4DD}"} My Notes</h2>
            <div className="flex gap-1 p-1 rounded-xl border border-violet-500/20" style={{ background: 'var(--bg2)' }}>
              <button
                onClick={() => setNotesMode('word')}
                className={`notes-mode-btn ${notesMode === 'word' ? 'notes-mode-active' : ''}`}
              >
                📄 Word Style
              </button>
              <button
                onClick={() => setNotesMode('table')}
                className={`notes-mode-btn ${notesMode === 'table' ? 'notes-mode-active' : ''}`}
              >
                ⊞ Table Style
              </button>
            </div>
          </div>

          {notesMode === 'word' ? (
            <MultiPageNotes
              pages={notePages}
              onChange={saveNotes}
              placeholder="Start writing your CA notes here… Use the toolbar or shortcuts (Ctrl+B/I/U, Tab to indent)."
              className="ca-word-editor-rte"
            />
          ) : (
            <PlanTable planId="ca_notes" />
          )}
        </div>
      )}
    </div>
  );
}
