import { useState, type FormEvent } from 'react';
import {
  useProfile,
  validateProfile,
  type ProfileFormData,
  type ProfileErrors,
} from '../hooks/useProfile';

export function ProfileSetup() {
  const { saveProfile, profile } = useProfile();
  const [form, setForm] = useState<ProfileFormData>({
    display_name: profile?.display_name || '',
    age: profile?.age || ('' as unknown as number),
    attempt: profile?.attempt || ('' as unknown as number),
    phone: profile?.phone || '',
    optional_subject: profile?.optional_subject || 'none',
    optional_subject_custom: profile?.optional_subject_custom || '',
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

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
    } catch {
      setErrors({ name: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="profile-setup-screen" style={{ display: 'flex' }}>
      <div className="floating-particle" style={{ width: 8, height: 8, background: 'rgba(168,85,247,0.6)', top: '15%', left: '10%', animationDelay: '0s' }} />
      <div className="floating-particle" style={{ width: 12, height: 12, background: 'rgba(236,72,153,0.5)', top: '25%', right: '15%', animationDelay: '1s' }} />
      <div className="floating-particle" style={{ width: 6, height: 6, background: 'rgba(99,102,241,0.7)', bottom: '20%', left: '20%', animationDelay: '2s' }} />
      <div className="floating-particle" style={{ width: 10, height: 10, background: 'rgba(245,158,11,0.5)', top: '60%', right: '8%', animationDelay: '3s' }} />
      <div className="floating-particle" style={{ width: 14, height: 14, background: 'rgba(16,185,129,0.4)', bottom: '30%', right: '25%', animationDelay: '4s' }} />

      <div className="setup-card">
        <div className="text-center mb-8">
          <div style={{ width: 72, height: 72, margin: '0 auto 1rem', borderRadius: '1.25rem', background: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px -6px rgba(139,92,246,0.5)', animation: 'cardSlideUp 0.5s ease-out' }}>
            <svg width="32" height="32" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <h2 style={{ fontFamily: "'Cabinet Grotesk',sans-serif", fontSize: '1.6rem', fontWeight: 900, background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.25rem' }}>Complete Your Profile</h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Let's personalize your UPSC journey</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="setup-field-group">
            <label><span className="field-icon">👤</span> Full Name</label>
            <input type="text" placeholder="e.g. Nishant Kumar" maxLength={50} value={form.display_name} onChange={(e) => handleChange('display_name', e.target.value)} className={errors.name ? 'input-error' : ''} />
            {errors.name && <div className="field-error" style={{ display: 'block' }}>{errors.name}</div>}
          </div>

          <div className="setup-field-group">
            <label><span className="field-icon">🎂</span> Age</label>
            <input type="number" placeholder="e.g. 24" min={16} max={45} value={form.age || ''} onChange={(e) => handleChange('age', e.target.value)} className={errors.age ? 'input-error' : ''} />
            {errors.age && <div className="field-error" style={{ display: 'block' }}>{errors.age}</div>}
          </div>

          <div className="setup-field-group">
            <label><span className="field-icon">🎯</span> UPSC Attempt Number</label>
            <input type="number" placeholder="e.g. 1 (first attempt)" min={1} max={10} value={form.attempt || ''} onChange={(e) => handleChange('attempt', e.target.value)} className={errors.attempt ? 'input-error' : ''} />
            {errors.attempt && <div className="field-error" style={{ display: 'block' }}>{errors.attempt}</div>}
          </div>

          <div className="setup-field-group">
            <label><span className="field-icon">📱</span> Mobile Number</label>
            <input type="tel" placeholder="e.g. 9876543210" maxLength={10} inputMode="numeric" value={form.phone} onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className={errors.phone ? 'input-error' : ''} />
            {errors.phone && <div className="field-error" style={{ display: 'block' }}>{errors.phone}</div>}
          </div>

          <div className="setup-field-group">
            <label><span className="field-icon">📖</span> Optional Subject <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>(optional)</span></label>
            <select value={form.optional_subject} onChange={(e) => handleChange('optional_subject', e.target.value)}>
              <option value="none">-- Select Optional Subject --</option>
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
            {form.optional_subject === 'custom' && (
              <div style={{ marginTop: '0.5rem' }}>
                <input type="text" placeholder="Enter your optional subject name" style={{ width: '100%' }} value={form.optional_subject_custom} onChange={(e) => handleChange('optional_subject_custom', e.target.value)} />
              </div>
            )}
          </div>

          <button type="submit" className="btn-vibrant" disabled={saving} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)', color: 'white', border: 'none', borderRadius: '1rem', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', boxShadow: '0 8px 25px -5px rgba(139,92,246,0.5)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', marginTop: '0.5rem' }}>
            {saving ? '✨ Setting up…' : '🚀 Launch My Command Center'}
          </button>
          <p style={{ fontSize: '0.6rem', color: '#94a3b8', textAlign: 'center', marginTop: '1rem', fontWeight: 600 }}>All fields are required. You can update these later.</p>
        </form>
      </div>
    </div>
  );
}