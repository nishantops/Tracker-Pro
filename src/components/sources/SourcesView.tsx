import { useState } from 'react';
import {
  useSources,
  type SourceFormData,
  EMPTY_SOURCE_FORM,
  SOURCE_TOPICS,
  TOPIC_COLORS,
} from '../../hooks/useSources';

export function SourcesView() {
  const { sources, loading, saveSource, deleteSource } = useSources();
  const [modalOpen, setModalOpen] = useState(false);
  const [editState, setEditState] = useState<{ form: SourceFormData; id?: string } | null>(null);

  const openCreate = () => {
    setEditState({ form: { ...EMPTY_SOURCE_FORM } });
    setModalOpen(true);
  };

  const openEdit = (sourceId: string) => {
    const s = sources.find((x) => x.source_id === sourceId);
    if (!s) return;
    setEditState({
      id: sourceId,
      form: { title: s.title, link: s.link ?? '', topic: s.topic, notes: s.notes ?? '' },
    });
    setModalOpen(true);
  };

  const handleSave = (form: SourceFormData, id?: string) => {
    saveSource(form, id);
    setModalOpen(false);
    setEditState(null);
  };

  if (loading) {
    return <div className="welcome-card"><p>Loading sources...</p></div>;
  }

  return (
    <div className="sources-view">
      <button className="create-plan-btn" onClick={openCreate}>
        + Add Source
      </button>

      {sources.length === 0 ? (
        <div className="welcome-card">
          <h2>No Sources Yet</h2>
          <p>Add books, YouTube channels, newspapers, and online resources you use for UPSC prep.</p>
        </div>
      ) : (
        <div className="sources-grid">
          {sources.map((s) => (
            <SourceCard key={s.source_id} source={s} onEdit={openEdit} onDelete={deleteSource} />
          ))}
        </div>
      )}

      {modalOpen && editState && (
        <SourceModal
          form={editState.form}
          editId={editState.id}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditState(null); }}
        />
      )}
    </div>
  );
}

// ── Source Card ───────────────────────────────────────────────────────────────
function SourceCard({
  source,
  onEdit,
  onDelete,
}: {
  source: { source_id: string; title: string; link: string | null; topic: string; notes: string | null };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const color = TOPIC_COLORS[source.topic] ?? '#64748b';

  return (
    <div className="source-card" style={{ borderLeftColor: color }}>
      <div className="source-card-top">
        <span className="source-title">{source.title}</span>
        <div className="source-actions">
          <button onClick={() => onEdit(source.source_id)} title="Edit">✏️</button>
          <button
            onClick={() => { if (confirm(`Delete "${source.title}"?`)) onDelete(source.source_id); }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
      <span className="source-topic-badge" style={{ background: `${color}22`, color }}>{source.topic}</span>
      {source.link && (
        <a href={source.link} target="_blank" rel="noopener noreferrer" className="source-link">
          🔗 {source.link}
        </a>
      )}
      {source.notes && <p className="source-notes">{source.notes}</p>}
    </div>
  );
}

// ── Source Modal ──────────────────────────────────────────────────────────────
function SourceModal({
  form: initial,
  editId,
  onSave,
  onClose,
}: {
  form: SourceFormData;
  editId?: string;
  onSave: (form: SourceFormData, id?: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);

  const set = <K extends keyof SourceFormData>(k: K, v: SourceFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave(form, editId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3 className="modal-title">{editId ? 'Edit Source' : 'Add Source'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-stack">
          <label className="field-label">Title *</label>
          <input className="auth-input" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />

          <label className="field-label">Link (URL)</label>
          <input className="auth-input" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://..." />

          <label className="field-label">Topic</label>
          <select className="auth-input" value={form.topic} onChange={(e) => set('topic', e.target.value)}>
            {SOURCE_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <label className="field-label">Notes</label>
          <textarea
            className="auth-input"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Quick notes about this source..."
            style={{ resize: 'vertical' }}
          />

          <button className="auth-btn" onClick={handleSubmit} style={{ marginTop: '0.5rem' }}>
            {editId ? 'Save Changes' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}
