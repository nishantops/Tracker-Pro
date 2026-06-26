import { useMemo, useRef, useEffect, useState } from 'react';
import { GridLayout, verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useTracker } from '../../hooks/useTracker';
import { useProfile } from '../../hooks/useProfile';
import { STAGES, CA_SECTION, SECTION_COLORS } from '../../data/syllabus';
import { usePieLayouts } from '../../hooks/usePieLayouts';
import { ENV } from '../../lib/env';

interface Props { onAddCustomTopic?: () => void; }

interface PieEntry {
  key: string;
  labelTop: string;
  labelBottom: string;
  total: number;
  checked: number;
}

const COLS        = ENV.PIE_GRID_COLS;
const ROW_HEIGHT  = ENV.PIE_ROW_HEIGHT;
const MARGIN: [number, number] = [ENV.PIE_GRID_MARGIN, ENV.PIE_GRID_MARGIN];

export function PieMatrix({ onAddCustomTopic }: Props) {
  const { progress, getCustomTopics } = useTracker();
  const { profile } = useProfile();

  const optShortName = useMemo(() => {
    const raw = profile?.optional_subject_custom || profile?.optional_subject || 'Optional';
    if (!raw || raw === 'none') return 'Optional';
    return raw.length > 14 ? raw.substring(0, 12) + '…' : raw;
  }, [profile]);

  const pieOrder = useMemo(() => [
    { key: 'gs1', labelTop: 'Mains GS1',           labelBottom: 'History/Geo' },
    { key: 'gs2', labelTop: 'Mains GS2',           labelBottom: 'Polity/IR' },
    { key: 'gs3', labelTop: 'Mains GS3',           labelBottom: 'Economy/Tech' },
    { key: 'gs4', labelTop: 'Mains GS4',           labelBottom: 'Ethics' },
    { key: 'es',  labelTop: 'Mains Essay',         labelBottom: 'Essay' },
    { key: 'a1',  labelTop: `${optShortName} P1`,  labelBottom: 'Paper I' },
    { key: 'a2',  labelTop: `${optShortName} P2`,  labelBottom: 'Paper II' },
    { key: 'p1',  labelTop: 'Prelims P1',          labelBottom: 'GS Paper I' },
    { key: 'p2',  labelTop: 'Prelims P2',          labelBottom: 'CSAT' },
    { key: 'ca',  labelTop: 'CA Matrix',           labelBottom: 'Current Affairs' },
  ], [optShortName]);

  const keys = useMemo(() => pieOrder.map(p => p.key), [pieOrder]);
  const { layout, onLayoutChange, reset } = usePieLayouts(keys);

  // Lock state (persisted in localStorage)
  const [locked, setLocked] = useState(() => localStorage.getItem('pie-grid-locked') !== '0');
  const toggleLock = () => setLocked(prev => {
    const next = !prev;
    localStorage.setItem('pie-grid-locked', next ? '1' : '0');
    return next;
  });

  // ── Measure container width for RGL ───────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setWidth(w); };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // ── Compute entries ───────────────────────────────────────────────────────
  const entries: PieEntry[] = useMemo(() => {
    const sectionMap = new Map<string, number>();
    for (const stage of STAGES) {
      for (const sec of stage.sections) sectionMap.set(sec.key, sec.topics.length);
    }
    sectionMap.set('ca', CA_SECTION.topics.length);
    return pieOrder.map(({ key, labelTop, labelBottom }) => {
      const baseTotal    = sectionMap.get(key) ?? 0;
      const customTopics = getCustomTopics(key);
      const total        = baseTotal + customTopics.length;
      let checked = 0;
      for (let i = 0; i < baseTotal; i++) {
        if (progress.get(`uid-${key}-${i}`)?.is_checked) checked++;
      }
      checked += customTopics.filter(ct => ct.is_checked).length;
      return { key, labelTop, labelBottom, total, checked };
    });
  }, [progress, getCustomTopics, pieOrder]);

  const entryMap = useMemo(() => new Map(entries.map(e => [e.key, e])), [entries]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="neo-card rounded-3xl p-6">
      <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-2">
        <h3 className="text-xs font-bold tracking-widest text-violet-300 uppercase font-mono">
          SECTIONAL PIE COMPLETION MATRIX
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLock}
            title={locked ? 'Unlock pie layout' : 'Lock pie layout'}
            className={`cursor-pointer text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all font-mono border ${
              locked
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-slate-500/10 border-slate-500/30 text-slate-500 hover:bg-slate-500/20'
            }`}
          >{locked ? '🔒' : '🔓'}</button>
          <button className="pie-reset-btn" onClick={reset} title="Reset card layout">⟳ RESET</button>
          <button
            onClick={onAddCustomTopic}
            className="cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-lg shadow-violet-500/20 font-mono btn-vibrant"
          >
            + ADD CUSTOM TOPIC
          </button>
        </div>
      </div>

      <div ref={containerRef}>
        <GridLayout
          layout={layout as unknown as Layout}
          gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: MARGIN, containerPadding: [0, 0] }}
          dragConfig={{ enabled: !locked }}
          resizeConfig={{ enabled: !locked, handles: ['se', 'e', 's'] }}
          compactor={verticalCompactor}
          width={width}
          onLayoutChange={(rgl) => {
            if (!locked) onLayoutChange([...rgl].map(({ i, x, y, w, h }) => ({ i, x, y, w, h })));
          }}
        >
          {layout.map(({ i }) => {
            const e = entryMap.get(i);
            if (!e) return <div key={i} />;
            const pct   = e.total > 0 ? Math.round((e.checked / e.total) * 100) : 0;
            const color = SECTION_COLORS[i]?.hex ?? '#6366f1';
            return (
              <div key={i} className="pie-card-dark pie-card-rgl" title={`${e.labelBottom} — ${pct}%`}>
                <MiniPie pct={pct} color={color} />
                <div className="pie-card-text">
                  <div className="pie-label text-[10px] font-bold font-mono tracking-wide uppercase flex items-center gap-1.5">
                    <span className="pie-label-text">{e.labelTop}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] flex-shrink-0">{pct}%</span>
                  </div>
                  <div className="pie-title text-xs font-black mt-0.5 leading-tight">{e.labelBottom}</div>
                </div>
              </div>
            );
          })}
        </GridLayout>
      </div>
    </div>
  );
}

// ── MiniPie ───────────────────────────────────────────────────────────────────
function MiniPie({ pct, color }: { pct: number; color: string }) {
  const bg     = `conic-gradient(${color} ${pct}%, rgba(51,65,85,0.6) 0%)`;
  const border = pct > 0 ? 'none' : `2px solid ${color}4d`;
  return <div className="pie-chart-frame" style={{ background: bg, border, flexShrink: 0 }} />;
}
