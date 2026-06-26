import { useState } from 'react';
import { useTracker } from '../../hooks/useTracker';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useScrollLock } from '../../hooks/useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-select a target section (from "+ Add Custom Topic" inside a section) */
  defaultTarget?: string;
}

// Maps section key → old app box ID for data compatibility
const SECTION_TO_BOX: Record<string, string> = {
  p1: 'box-prelims-gs',
  p2: 'box-prelims-csat',
  gs1: 'box-mains-gs1',
  gs2: 'box-mains-gs2',
  gs3: 'box-mains-gs3',
  gs4: 'box-mains-gs4',
  es: 'box-mains-essay',
  la: 'box-mains-lang-a',
  lb: 'box-mains-lang-b',
  a1: 'box-anthro-p1',
  a2: 'box-anthro-p2',
  ca: 'box-ca',
};

const TARGET_OPTIONS = [
  { group: 'Syllabus Tracker', items: [
    { value: 'box-prelims-gs', label: 'Prelims GS I' },
    { value: 'box-prelims-csat', label: 'Prelims CSAT' },
    { value: 'box-mains-gs1', label: 'Mains GS-I' },
    { value: 'box-mains-gs2', label: 'Mains GS-II' },
    { value: 'box-mains-gs3', label: 'Mains GS-III' },
    { value: 'box-mains-gs4', label: 'Mains GS-IV' },
    { value: 'box-anthro-p1', label: 'Anthro Paper I' },
    { value: 'box-anthro-p2', label: 'Anthro Paper II' },
  ]},
  { group: 'Current Affairs', items: [
    { value: 'box-ca', label: 'CA Monthly Tracker' },
  ]},
];

export function CustomTopicModal({ open, onClose, defaultTarget }: Props) {
  useScrollLock(open);
  const { addCustomTopic } = useTracker();
  const { user } = useAuth();
  const [target, setTarget] = useState(defaultTarget ? (SECTION_TO_BOX[defaultTarget] || defaultTarget) : 'box-prelims-gs');
  const [description, setDescription] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!description.trim() || !user) return;
    setSaving(true);
    try {
      const lines = bulkMode
        ? description.split('\n').map(l => l.trim()).filter(Boolean)
        : [description.trim()];

      for (const line of lines) {
        const encoded = btoa(unescape(encodeURIComponent(line)));
        const customId = `custom_${target}_${encoded}`;
        await supabase.from('upsc_tracker_progress').upsert({
          id: customId,
          user_id: user.id,
          is_checked: false,
          topic_note: '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id,user_id' });
        addCustomTopic(customId);
      }
      setDescription('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--bdr)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black heading-font" style={{ color: 'var(--t1)' }}>📂 Add Custom Entry</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold font-mono uppercase" style={{ color: 'var(--t3)' }}>Bulk</span>
            <button
              type="button"
              onClick={() => setBulkMode(b => !b)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${bulkMode ? 'bg-indigo-500' : 'bg-[var(--surf)]'}`}
              style={{ border: '1px solid var(--bdr)' }}
              title="Toggle bulk entry mode"
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${bulkMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 font-mono" style={{ color: 'var(--t3)' }}>Target Subject Scope</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none custom-scrollbar"
              style={{ background: 'var(--inp)', border: '1px solid var(--bdr)', color: 'var(--t1)' }}
            >
              {TARGET_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 font-mono" style={{ color: 'var(--t3)' }}>
              {bulkMode ? 'Topics (one per line)' : 'Entry Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={bulkMode ? 6 : 3}
              className="w-full rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none custom-scrollbar resize-y"
              style={{ background: 'var(--inp)', border: '1px solid var(--bdr)', color: 'var(--t1)' }}
              placeholder={bulkMode ? 'Topic 1\nTopic 2\nTopic 3...' : 'Enter the topic or task description...'}
            />
            {bulkMode && description.trim() && (
              <p className="mt-1 text-[10px] font-mono" style={{ color: 'var(--t3)' }}>
                {description.split('\n').filter(l => l.trim()).length} entr{description.split('\n').filter(l => l.trim()).length === 1 ? 'y' : 'ies'} will be added
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2 text-xs font-bold font-mono">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-3 rounded-xl transition-colors"
            style={{ background: 'var(--surf)', color: 'var(--t2)', border: '1px solid var(--bdr)' }}
          >Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !description.trim()}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl transition-colors"
          >{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

