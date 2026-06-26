import { useState, useEffect, type FormEvent } from 'react';
import {
  useProfile,
  validateProfile,
  type ProfileFormData,
  type ProfileErrors,
} from '../hooks/useProfile';
import { useAuth } from '../context/AuthContext';
import { useToast } from './common/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { profile, saveProfile, initials } = useProfile();
  const { showToast } = useToast();
  const [form, setForm] = useState<ProfileFormData>({
    display_name: '',
    age: 0,
    attempt: 0,
    phone: '',
    optional_subject: 'none',
    optional_subject_custom: '',
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setForm({
        display_name: profile.display_name || '',
        age: profile.age || ('' as unknown as number),
        attempt: profile.attempt || ('' as unknown as number),
        phone: profile.phone || '',
        optional_subject: profile.optional_subject || 'none',
        optional_subject_custom: profile.optional_subject_custom || '',
      });
      setErrors({});
    }
  }, [open, profile]);

  if (!open) return null;

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field === 'display_name' ? 'name' : field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateProfile(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await saveProfile(form);
      showToast('Profile updated', 'success');
      onClose();
    } catch {
      setErrors({ name: 'Failed to save. Try again.' });
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

  const labelStyle: React.CSSProperties = {
    fontSize: '0.58rem',
    fontWeight: 700,
    color: 'var(--t3)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,4,20,0.72)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--card)', backdropFilter: 'blur(40px) saturate(200%)',
        border: '1px solid var(--bdr-h)', borderRadius: '1.5rem', padding: '2rem 1.75rem',
        maxWidth: 440, width: '100%', margin: '1rem', boxShadow: 'var(--shd)',
        animation: 'dropIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-orange-400 flex items-center justify-center font-black text-white text-xl tracking-tighter shadow-xl shadow-violet-500/30">
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '1rem', fontWeight: 900, color: 'var(--t1)' }}>Edit Profile</h2>
            <p style={{ fontSize: '0.62rem', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>{user?.email}</p>
            {profile?.created_at && (
              <p style={{ fontSize: '0.58rem', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>
                Member since {new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--t3)', fontSize: '1.2rem', cursor: 'pointer',
          }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Full Name</label>
            <input style={{ ...fieldStyle, borderColor: errors.name ? '#ef4444' : undefined }} value={form.display_name} onChange={(e) => handleChange('display_name', e.target.value)} />
            {errors.name && <p style={{ fontSize: '0.6rem', color: '#ef4444', fontFamily: 'var(--mono)' }}>{errors.name}</p>}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={labelStyle}>Age</label>
              <input type="number" style={{ ...fieldStyle, borderColor: errors.age ? '#ef4444' : undefined }} value={form.age || ''} onChange={(e) => handleChange('age', e.target.value)} min={16} max={45} />
              {errors.age && <p style={{ fontSize: '0.6rem', color: '#ef4444', fontFamily: 'var(--mono)' }}>{errors.age}</p>}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={labelStyle}>Attempt</label>
              <input type="number" style={{ ...fieldStyle, borderColor: errors.attempt ? '#ef4444' : undefined }} value={form.attempt || ''} onChange={(e) => handleChange('attempt', e.target.value)} min={1} max={10} />
              {errors.attempt && <p style={{ fontSize: '0.6rem', color: '#ef4444', fontFamily: 'var(--mono)' }}>{errors.attempt}</p>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Phone (optional)</label>
            <input type="tel" style={{ ...fieldStyle, borderColor: errors.phone ? '#ef4444' : undefined }} value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
            {errors.phone && <p style={{ fontSize: '0.6rem', color: '#ef4444', fontFamily: 'var(--mono)' }}>{errors.phone}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Optional Subject</label>
            <select style={fieldStyle} value={form.optional_subject} onChange={(e) => handleChange('optional_subject', e.target.value)}>
              <option value="none">No optional selected</option>
              <option value="Anthropology">Anthropology</option>
              <option value="Geography">Geography</option>
              <option value="Public Administration">Public Administration</option>
              <option value="Sociology">Sociology</option>
              <option value="History">History</option>
              <option value="Political Science & IR">Political Science &amp; IR</option>
              <option value="Philosophy">Philosophy</option>
              <option value="Law">Law</option>
              <option value="custom">Other / Custom...</option>
            </select>
          </div>

          {form.optional_subject === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label style={labelStyle}>Your Optional Subject</label>
              <input style={fieldStyle} placeholder="Type your optional subject" value={form.optional_subject_custom} onChange={(e) => handleChange('optional_subject_custom', e.target.value)} />
            </div>
          )}

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
            }}>{saving ? '✨ Saving…' : '💾 Save Profile'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
