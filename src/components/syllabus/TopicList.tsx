import { useState, memo } from 'react';
import type { SyllabusSection } from '../../data/syllabus';
import type { ProgressRow } from '../../hooks/useTracker';
import { useTracker } from '../../hooks/useTracker';
import { RTE } from '../common/RTE';

interface Props {
  section: SyllabusSection;
  progress: Map<string, ProgressRow>;
  onToggle: (id: string) => void;
  onNote: (id: string, note: string) => void;
  stageLabel?: string;
}

export const TopicList = memo(function TopicList({ section, progress, onToggle, onNote, stageLabel }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { getCustomTopics, deleteCustomTopic } = useTracker();

  const customTopics = getCustomTopics(section.key);

  const checked = section.topics.filter(
    (_, i) => progress.get(`uid-${section.key}-${i}`)?.is_checked,
  ).length + customTopics.filter((ct) => ct.is_checked).length;
  const totalCount = section.topics.length + customTopics.length;
  const pct = totalCount > 0 ? Math.round((checked / totalCount) * 100) : 0;

  // Build heading like old app: "Prelims: GS Paper I Matrix"
  const heading = stageLabel ? `${stageLabel}: ${section.label} Matrix` : section.label;

  return (
    <div className="neo-card rounded-3xl p-6">
      <div
        className="flex justify-between items-center border-b border-violet-500/20 pb-3 mb-4 cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <h2 className="heading-font text-xl font-black">
          {collapsed ? '▸' : '▾'} {heading}
        </h2>
        <span className="bg-violet-500/20 text-violet-300 text-[10px] font-black px-2.5 py-0.5 rounded-md font-mono border border-violet-500/30">
          {checked}/{totalCount} ({pct}%)
        </span>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {section.topics.map((text, idx) => {
            const id = `uid-${section.key}-${idx}`;
            const row = progress.get(id);
            const isChecked = row?.is_checked ?? false;
            const note = row?.topic_note ?? '';

            return (
              <TopicRow
                key={id}
                id={id}
                text={text}
                isChecked={isChecked}
                note={note}
                onToggle={onToggle}
                onNote={onNote}
              />
            );
          })}
          {/* Custom topics added by user */}
          {customTopics.map((ct) => (
            <CustomTopicRow
              key={ct.id}
              id={ct.id}
              text={ct.text}
              isChecked={ct.is_checked}
              note={ct.topic_note}
              onToggle={onToggle}
              onNote={onNote}
              onDelete={deleteCustomTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Single topic row matching old HTML exactly ───────────────────────────────
const TopicRow = memo(function TopicRow({
  id,
  text,
  isChecked,
  note,
  onToggle,
  onNote,
}: {
  id: string;
  text: string;
  isChecked: boolean;
  note: string;
  onToggle: (id: string) => void;
  onNote: (id: string, note: string) => void;
}) {
  return (
    <div className={`task-row flex flex-col p-3.5 rounded-2xl transition duration-200 group relative${isChecked ? ' just-checked' : ''}`}>
      <label
        htmlFor={id}
        className="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold tracking-tight select-none"
      >
        <input
          type="checkbox"
          id={id}
          checked={isChecked}
          onChange={() => onToggle(id)}
          className="mt-0.5 mr-3.5 h-5 w-5 rounded-md border-violet-400/50 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
        />
        <span
          className={`text-slate-200 font-medium ml-2 break-words transition-all${
            isChecked ? ' text-slate-500 line-through' : ''
          }`}
        >
          {text}
        </span>
      </label>
      <div className="mt-2 ml-10 w-[calc(100%-2.5rem)]">
        <RTE
          value={note}
          onChange={(html) => onNote(id, html)}
          placeholder="Add a note or reminder here (e.g., 'Half done', 'Revise NCERT')..."
          readOnly={isChecked}
          className={isChecked ? 'locked-note' : ''}
        />
      </div>
    </div>
  );
});

// ── Custom topic row (user-added, with delete button) ────────────────────────
const CustomTopicRow = memo(function CustomTopicRow({
  id,
  text,
  isChecked,
  note,
  onToggle,
  onNote,
  onDelete,
}: {
  id: string;
  text: string;
  isChecked: boolean;
  note: string;
  onToggle: (id: string) => void;
  onNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`task-row flex flex-col p-3.5 rounded-2xl transition duration-200 group relative${isChecked ? ' just-checked' : ''}`}>
      <div className="flex items-start w-full">
        <label
          htmlFor={id}
          className="flex items-start cursor-pointer flex-1 text-xs sm:text-sm font-bold tracking-tight select-none"
        >
          <input
            type="checkbox"
            id={id}
            checked={isChecked}
            onChange={() => onToggle(id)}
            className="mt-0.5 mr-3.5 h-5 w-5 rounded-md border-violet-400/50 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
          />
          <span
            className={`text-slate-200 font-medium ml-2 break-words transition-all${
              isChecked ? ' text-slate-500 line-through' : ''
            }`}
          >
            {text}
          </span>
        </label>
        <span className="text-[9px] font-bold bg-fuchsia-500/20 text-fuchsia-300 px-1.5 py-0.5 rounded font-mono mr-2 shrink-0">CUSTOM</span>
        <button
          onClick={() => onDelete(id)}
          className="text-rose-400 hover:text-rose-300 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
          title="Delete custom topic"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 ml-10 w-[calc(100%-2.5rem)]">
        <RTE
          value={note}
          onChange={(html) => onNote(id, html)}
          placeholder="Add a note or reminder here..."
          readOnly={isChecked}
          className={isChecked ? 'locked-note' : ''}
        />
      </div>
    </div>
  );
});
