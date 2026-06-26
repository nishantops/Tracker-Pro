import { useState, useEffect, type FormEvent } from 'react';
import type { PlanFormData } from '../../hooks/usePlans';
import { useToast } from '../common/Toast';
import { useScrollLock } from '../../hooks/useScrollLock';

interface Props {
  open: boolean;
  initial: PlanFormData;
  editId?: string;
  onSave: (form: PlanFormData, editId?: string) => Promise<void>;
  onClose: () => void;
}

export function PlanModal({ open, initial, editId, onSave, onClose }: Props) {
  useScrollLock(open);
  const [form, setForm] = useState<PlanFormData>(initial);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // ESC closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleChange = (field: keyof PlanFormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(form, editId);
      showToast(editId ? 'Plan updated' : 'Plan created', 'success');
      onClose();
    } catch {
      showToast('Failed to save plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surf)',
    border: '1px solid var(--bdr)',
    borderRadius: '0.4rem',
    padding: '0.3rem 0.55rem',
    fontSize: '0.72rem',
    color: 'var(--t1)',
    fontFamily: 'var(--mono)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(6,4,20,0.72)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div className="modal-card" style={{
        position: 'relative', zIndex: 1, background: 'var(--card)', backdropFilter: 'blur(40px) saturate(200%)',
        border: '1px solid var(--bdr-h)', borderRadius: '1.5rem', padding: '2rem 1.75rem',
        maxWidth: 440, width: '100%', margin: '1rem', boxShadow: 'var(--shd)',
        animation: 'dropIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '1rem', fontWeight: 900, color: 'var(--t1)', marginBottom: '1rem' }}>
          {editId ? '✏️ Edit Plan' : '📋 Create New Plan'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Plan Title *</label>
            <input style={fieldStyle} value={form.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="e.g. Weekly GS Revision Sprint" required />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Type</label>
              <select style={fieldStyle} value={form.type} onChange={(e) => handleChange('type', e.target.value)}>
                <option value="weekly">Weekly Sprint</option>
                <option value="monthly">Monthly</option>
                <option value="custom_block">Custom Block</option>
                <option value="daily">Daily Target</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Category</label>
              <select style={fieldStyle} value={form.category} onChange={(e) => handleChange('category', e.target.value)}>
                <option value="common">Common</option>
                <option value="gs1">GS 1</option>
                <option value="gs2">GS 2</option>
                <option value="gs3">GS 3</option>
                <option value="gs4">GS 4</option>
                <option value="essay">Essay</option>
                <option value="optional">Optional</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Division</label>
              <select style={fieldStyle} value={form.division} onChange={(e) => handleChange('division', e.target.value)}>
                <option value="both">Prelims + Mains</option>
                <option value="prelims">Prelims Only</option>
                <option value="mains">Mains Only</option>
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Mode</label>
              <select style={fieldStyle} value={form.contentType} onChange={(e) => handleChange('contentType', e.target.value)}>
                <option value="both">✓ Tasks + ⊞ Tables</option>
                <option value="tasks">✓ Tasks Only</option>
                <option value="tables">⊞ Tables Only</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Start Date</label>
              <input type="date" style={fieldStyle} value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>End Date</label>
              <input type="date" style={fieldStyle} value={form.endDate} onChange={(e) => handleChange('endDate', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>Subject Label <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
            <input style={fieldStyle} value={form.subject || ''} onChange={(e) => handleChange('subject', e.target.value)} placeholder="e.g. GS 1 — Polity, History" />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--t2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.notifEnabled !== false} onChange={(e) => handleChange('notifEnabled', e.target.checked)} style={{ width: 14, height: 14, accentColor: '#6366f1' }} />
            Enable deadline notifications for this plan
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '0.7rem', border: '1px solid var(--bdr)', background: 'var(--surf)',
              color: 'var(--t2)', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '0.7rem', border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)',
              color: 'white', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem',
              boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            }}>{saving ? 'Saving...' : editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
