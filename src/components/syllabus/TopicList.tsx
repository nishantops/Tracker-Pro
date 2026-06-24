import { useState, memo } from 'react';
import type { SyllabusSection } from '../../data/syllabus';
import type { ProgressRow } from '../../hooks/useTracker';
import { SECTION_COLORS } from '../../data/syllabus';

interface Props {
  section: SyllabusSection;
  progress: Map<string, ProgressRow>;
  onToggle: (id: string) => void;
  onNote: (id: string, note: string) => void;
}

export const TopicList = memo(function TopicList({ section, progress, onToggle, onNote }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const color = SECTION_COLORS[section.key];

  const checked = section.topics.filter(
    (_, i) => progress.get(`uid-${section.key}-${i}`)?.is_checked,
  ).length;
  const pct = section.topics.length > 0 ? Math.round((checked / section.topics.length) * 100) : 0;

  return (
    <div className="topic-section">
      <button className="section-header" onClick={() => setCollapsed((c) => !c)}>
        <span className="section-chevron">{collapsed ? '▸' : '▾'}</span>
        <span
          className="section-pie"
          style={{
            background: `conic-gradient(${color?.hex ?? 'var(--accent)'} ${pct}%, var(--surf) 0%)`,
          }}
        />
        <span className="section-label">{section.label}</span>
        <span className="section-count" style={{ color: color?.hex }}>
          {checked}/{section.topics.length} ({pct}%)
        </span>
      </button>

      {!collapsed && (
        <div className="topic-rows">
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
        </div>
      )}
    </div>
  );
});

// ── Single topic row ─────────────────────────────────────────────────────────
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
    <div className={`topic-row ${isChecked ? 'topic-done' : ''}`}>
      <label className="topic-label">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(id)}
          className="topic-check"
        />
        <span className="topic-text">{text}</span>
      </label>
      <input
        type="text"
        className="topic-note"
        value={note}
        onChange={(e) => onNote(id, e.target.value)}
        placeholder="Add a note or reminder..."
        readOnly={isChecked}
      />
    </div>
  );
});
