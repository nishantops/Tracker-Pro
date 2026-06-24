import { useState, useEffect } from 'react';
import type { PlanFormData } from '../../hooks/usePlans';

interface Props {
  open: boolean;
  initial: PlanFormData;
  editId?: string;
  onSave: (form: PlanFormData, existingId?: string) => void;
  onClose: () => void;
}

const CAT_OPTIONS = [
  ['common', 'Common'], ['gs1', 'GS 1'], ['gs2', 'GS 2'], ['gs3', 'GS 3'], ['gs4', 'GS 4'],
  ['essay', 'Essay'], ['optional', 'Optional'], ['custom', 'Custom'],
];

const DIV_OPTIONS = [
  ['both', 'Prelims + Mains'], ['prelims', 'Prelims Only'], ['mains', 'Mains Only'],
];

const TYPE_OPTIONS = [
  ['weekly', 'Weekly Sprint'], ['monthly', 'Monthly'],
  ['custom_block', 'Custom Block'], ['daily', 'Daily Target'],
];

const CONTENT_OPTIONS = [
  ['both', '✓ Tasks + ⊞ Tables'], ['tasks', '✓ Tasks Only'], ['tables', '⊞ Tables Only'],
];

export function PlanModal({ open, initial, editId, onSave, onClose }: Props) {
  const [form, setForm] = useState<PlanFormData>(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof PlanFormData>(key: K, val: PlanFormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave(form, editId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">{editId ? 'Edit Plan' : 'Create New Plan'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-stack">
          <label className="field-label">Plan Title *</label>
          <input
            className="auth-input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Polity Revision Sprint"
            autoFocus
          />

          <div className="form-row">
            <div>
              <label className="field-label">Type</label>
              <select className="auth-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Category</label>
              <select className="auth-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CAT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div>
              <label className="field-label">Start Date</label>
              <input className="auth-input" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input className="auth-input" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div>
              <label className="field-label">Division</label>
              <select className="auth-input" value={form.division} onChange={(e) => set('division', e.target.value)}>
                {DIV_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Content Mode</label>
              <select className="auth-input" value={form.contentType} onChange={(e) => set('contentType', e.target.value)}>
                {CONTENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <label className="field-label">Subject / Focus Area (optional)</label>
          <input
            className="auth-input"
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="e.g. Ancient History, Ethics Case Studies"
          />

          <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.notifEnabled}
              onChange={(e) => set('notifEnabled', e.target.checked)}
              style={{ width: 'auto' }}
            />
            Enable notifications
          </label>

          <button className="auth-btn" onClick={handleSubmit} style={{ marginTop: '0.5rem' }}>
            {editId ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
