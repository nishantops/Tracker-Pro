import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useScrollLock } from '../../hooks/useScrollLock';

interface SWItem {
  id: string;
  text: string;
  ts: number;
}

interface SWData {
  strengths: SWItem[];
  weaknesses: SWItem[];
  show_sw: boolean;
}

export function SWWidget({ externalOpen, onExternalClose }: { externalOpen?: boolean; onExternalClose?: () => void } = {}) {
  const { user } = useAuth();
  const [data, setData] = useState<SWData>({ strengths: [], weaknesses: [], show_sw: true });
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerDefaultType, setManagerDefaultType] = useState<'strength' | 'weakness'>('strength');

  // Open manager when externally triggered (from settings menu)
  useEffect(() => {
    if (externalOpen) {
      setManagerOpen(true);
      onExternalClose?.();
    }
  }, [externalOpen, onExternalClose]);

  // Load from Supabase profile_data JSONB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: row } = await supabase
        .from('upsc_user_profiles')
        .select('profile_data')
        .eq('user_id', user.id)
        .maybeSingle();
      if (row?.profile_data) {
        const pd = row.profile_data as Record<string, unknown>;
        setData({
          strengths: (pd.strengths as SWItem[]) ?? [],
          weaknesses: (pd.weaknesses as SWItem[]) ?? [],
          show_sw: pd.show_sw !== false,
        });
      }
    };
    load();
  }, [user]);

  const save = useCallback(async (updated: SWData) => {
    setData(updated);
    if (!user) return;
    // Read existing profile_data, merge
    const { data: row } = await supabase
      .from('upsc_user_profiles')
      .select('profile_data')
      .eq('user_id', user.id)
      .maybeSingle();
    const existing = (row?.profile_data as Record<string, unknown>) ?? {};
    const merged = { ...existing, strengths: updated.strengths, weaknesses: updated.weaknesses, show_sw: updated.show_sw };
    await supabase.from('upsc_user_profiles').update({ profile_data: merged }).eq('user_id', user.id);
  }, [user]);

  const toggleVisibility = (checked: boolean) => {
    const updated = { ...data, show_sw: checked };
    save(updated);
  };

  const deleteItem = (id: string, type: 'strength' | 'weakness') => {
    const updated = { ...data };
    if (type === 'strength') updated.strengths = updated.strengths.filter(i => i.id !== id);
    else updated.weaknesses = updated.weaknesses.filter(i => i.id !== id);
    save(updated);
  };

  const editItem = (id: string, type: 'strength' | 'weakness') => {
    const list = type === 'strength' ? data.strengths : data.weaknesses;
    const item = list.find(i => i.id === id);
    if (!item) return;
    const newText = prompt('Edit item:', item.text);
    if (!newText || !newText.trim()) return;
    const updated = { ...data };
    if (type === 'strength') {
      updated.strengths = updated.strengths.map(i => i.id === id ? { ...i, text: newText.trim() } : i);
    } else {
      updated.weaknesses = updated.weaknesses.map(i => i.id === id ? { ...i, text: newText.trim() } : i);
    }
    save(updated);
  };

  const openManager = (type?: 'strength' | 'weakness') => {
    if (type) setManagerDefaultType(type);
    setManagerOpen(true);
  };

  if (!data.show_sw && !managerOpen) return null;

  return (
    <>
    <div id="sw-widget" className="sw-widget">
      <div className="sw-inner">
        <div className="sw-widget-header">
          <span className="sw-pulse-dot" />
          <span className="sw-widget-title">MY UPSC PROFILE</span>
          <label className="sw-visibility-toggle" title="Show/hide on homepage" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={data.show_sw} onChange={(e) => toggleVisibility(e.target.checked)} />
            <span className="sw-vis-slider" />
            <span style={{ fontSize: '0.6rem', color: 'var(--t3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>visible on homepage</span>
          </label>
          <button className="sw-manage-btn" onClick={() => openManager()} style={{ marginLeft: 'auto' }}>
            ✎ Manage
          </button>
        </div>
        <div className="sw-rails">
          <div className="sw-rail">
            <div className="sw-rail-head sw-rail-head-strength">💪 STRENGTHS</div>
            <div className="sw-chips-row">
              {data.strengths.map((item) => (
                <div key={item.id} className="sw-chip sw-chip-strength">
                  <span className="sw-chip-text">{item.text}</span>
                  <button className="sw-chip-edit" onClick={() => editItem(item.id, 'strength')} title="Edit">✎</button>
                  <button className="sw-chip-del" onClick={() => deleteItem(item.id, 'strength')} title="Remove">✕</button>
                </div>
              ))}
              <button className="sw-chip-add" onClick={() => openManager('strength')}>+ Add</button>
            </div>
          </div>
          <div className="sw-rail-divider" />
          <div className="sw-rail">
            <div className="sw-rail-head sw-rail-head-weakness">⚠️ WEAKNESSES</div>
            <div className="sw-chips-row">
              {data.weaknesses.map((item) => (
                <div key={item.id} className="sw-chip sw-chip-weakness">
                  <span className="sw-chip-text">{item.text}</span>
                  <button className="sw-chip-edit" onClick={() => editItem(item.id, 'weakness')} title="Edit">✎</button>
                  <button className="sw-chip-del" onClick={() => deleteItem(item.id, 'weakness')} title="Remove">✕</button>
                </div>
              ))}
              <button className="sw-chip-add" onClick={() => openManager('weakness')}>+ Add</button>
            </div>
          </div>
        </div>
      </div>

    </div>
    {managerOpen && createPortal(
      <SWManager
        data={data}
        defaultType={managerDefaultType}
        onSave={(updated) => { save(updated); setManagerOpen(false); }}
        onClose={() => setManagerOpen(false)}
      />,
      document.body
    )}
    </>
  );
}

function SWManager({
  data,
  defaultType,
  onSave,
  onClose,
}: {
  data: SWData;
  defaultType: 'strength' | 'weakness';
  onSave: (d: SWData) => void;
  onClose: () => void;
}) {
  useScrollLock(true); // always active — SWManager only mounts when open
  const [strengths, setStrengths] = useState<SWItem[]>([...data.strengths]);
  const [weaknesses, setWeaknesses] = useState<SWItem[]>([...data.weaknesses]);
  const [showSw, setShowSw] = useState(data.show_sw);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'strength' | 'weakness'>(defaultType);
  const [error, setError] = useState('');

  const addItem = () => {
    setError('');
    const text = newText.trim();
    if (!text) { setError('Please enter a description.'); return; }
    if (text.length > 120) { setError('Max 120 characters allowed.'); return; }
    if (text.length < 2) { setError('Min 2 characters required.'); return; }
    const item: SWItem = { id: newType[0] + '_' + Date.now(), text, ts: Date.now() };
    if (newType === 'strength') setStrengths(prev => [...prev, item]);
    else setWeaknesses(prev => [...prev, item]);
    setNewText('');
  };

  const deleteItem = (id: string, type: 'strength' | 'weakness') => {
    if (type === 'strength') setStrengths(prev => prev.filter(i => i.id !== id));
    else setWeaknesses(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = () => {
    onSave({ strengths, weaknesses, show_sw: showSw });
  };

  const allItems = [
    ...strengths.map(i => ({ ...i, type: 'strength' as const })),
    ...weaknesses.map(i => ({ ...i, type: 'weakness' as const })),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,4,20,0.72)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--card)', border: '1px solid var(--bdr-h)',
        borderRadius: '1.5rem', padding: '2rem 1.75rem', maxWidth: 480, width: '100%', margin: '1rem',
        boxShadow: 'var(--shd)', animation: 'dropIn 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '80vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 900, fontFamily: "var(--heading)", color: 'var(--t1)' }}>Strengths & Weaknesses</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t4)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Add form */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <select value={newType} onChange={(e) => setNewType(e.target.value as 'strength' | 'weakness')} style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: '0.4rem', padding: '0.4rem 0.5rem', fontSize: '0.7rem', color: 'var(--t1)', fontFamily: 'var(--mono)' }}>
            <option value="strength">💪 Strength</option>
            <option value="weakness">⚠️ Weakness</option>
          </select>
          <input
            type="text"
            maxLength={120}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
            placeholder="Describe your strength or weakness…"
            style={{ flex: 1, background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: '0.4rem', padding: '0.4rem 0.55rem', fontSize: '0.72rem', color: 'var(--t1)', fontFamily: 'var(--mono)' }}
          />
          <button onClick={addItem} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', borderRadius: '0.4rem', padding: '0.4rem 0.7rem', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)' }}>+ Add</button>
        </div>
        {error && <div style={{ fontSize: '0.62rem', color: '#f43f5e', fontFamily: 'var(--mono)', marginBottom: '0.5rem' }}>{error}</div>}

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
          {allItems.length === 0 && <div style={{ fontSize: '0.7rem', color: 'var(--t4)', fontFamily: 'var(--mono)' }}>No items yet. Add your first strength or weakness above.</div>}
          {allItems.map(item => (
            <div key={item.id} className="sw-manager-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surf)', borderRadius: '0.5rem', padding: '0.4rem 0.6rem' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, fontFamily: 'var(--mono)', color: item.type === 'strength' ? '#10b981' : '#f59e0b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {item.type === 'strength' ? '💪' : '⚠️'}
              </span>
              <span style={{ flex: 1, fontSize: '0.72rem', color: 'var(--t1)' }}>{item.text}</span>
              <button onClick={() => deleteItem(item.id, item.type)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '0.8rem' }} title="Delete">🗑</button>
            </div>
          ))}
        </div>

        {/* Visibility toggle + save */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--t2)', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={showSw} onChange={(e) => setShowSw(e.target.checked)} />
          Show on homepage
        </label>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.7rem', border: '1px solid var(--bdr)', background: 'var(--surf)', color: 'var(--t2)', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>Cancel</button>
          <button type="button" onClick={handleSave} style={{ flex: 1, padding: '0.7rem', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)', color: 'white', borderRadius: '0.875rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
