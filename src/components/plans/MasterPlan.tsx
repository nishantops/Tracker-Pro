import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { usePlans } from '../../hooks/usePlans';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { PlanTable, formatDR, parseDR } from './PlanTable';
import { PlanDrawer } from './PlanDrawer';
import type { Plan } from '../../hooks/usePlans';

// Color map for categories
const CAT_COLORS: Record<string, string> = {
  common: '#818cf8', gs1: '#f59e0b', gs2: '#10b981', gs3: '#06b6d4',
  gs4: '#8b5cf6', essay: '#ec4899', optional: '#f97316', custom: '#64748b',
};

const CAT_LABELS: Record<string, string> = {
  common: 'Common', gs1: 'GS 1', gs2: 'GS 2', gs3: 'GS 3', gs4: 'GS 4',
  essay: 'Essay', optional: 'Optional', custom: 'Custom',
};

const CAT_STYLES: Record<string, { bg: string; text: string }> = {
  common:   { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  gs1:      { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  gs2:      { bg: 'rgba(16,185,129,0.15)',  text: '#34d399' },
  gs3:      { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa' },
  gs4:      { bg: 'rgba(236,72,153,0.15)',  text: '#f472b6' },
  essay:    { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
  optional: { bg: 'rgba(244,63,94,0.15)',   text: '#fb7185' },
  custom:   { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function ganttUnitEnd(u: Date, viewMode: 'month' | 'week'): Date {
  if (viewMode === 'month') {
    return new Date(u.getFullYear(), u.getMonth() + 1, 0, 23, 59, 59);
  }
  const e = new Date(u);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59);
  return e;
}

function ganttUnits(minD: Date, maxD: Date, viewMode: 'month' | 'week'): Date[] {
  const units: Date[] = [];
  if (viewMode === 'month') {
    const d = new Date(minD.getFullYear(), minD.getMonth(), 1);
    const end = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
    while (d <= end) { units.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
  } else {
    const d = new Date(minD);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const end = new Date(maxD); end.setDate(end.getDate() + 7);
    while (d <= end) { units.push(new Date(d)); d.setDate(d.getDate() + 7); }
  }
  return units;
}

function ganttIsNow(u: Date, viewMode: 'month' | 'week', now: Date): boolean {
  if (viewMode === 'month') return u.getFullYear() === now.getFullYear() && u.getMonth() === now.getMonth();
  return now >= u && now <= ganttUnitEnd(u, viewMode);
}

// ── Types for aggregate ───────────────────────────────────────────────────────
interface PlanStat { title: string; total: number; done: number; color: string; }

export function MasterPlan() {
  const { plans, refresh } = usePlans();
  const { user } = useAuth();
  const [ganttView, setGanttView] = useState<'month' | 'week'>('month');
  const [aggStats, setAggStats] = useState<PlanStat[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [calVisible, setCalVisible] = useState(false);
  const [calHeight, setCalHeight] = useState<number | null>(null);
  const calRef = useRef<HTMLDivElement>(null);
  const calDragging = useRef(false);
  const calDragStartY = useRef(0);
  const calDragStartH = useRef(0);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const handlePlanClick = useCallback((planId: string) => {
    const plan = plans.find((p) => p.plan_id === planId);
    if (plan) setSelectedPlan(plan);
  }, [plans]);

  const handleCalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    calDragging.current = true;
    calDragStartY.current = e.clientY;
    calDragStartH.current = calRef.current?.offsetHeight ?? 320;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!calDragging.current) return;
      setCalHeight(Math.max(200, calDragStartH.current + (e.clientY - calDragStartY.current)));
    };
    const onUp = () => { calDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [])

  // Plans with dates for Gantt/Calendar
  const datedPlans = useMemo(
    () => plans.filter((p) => p.start_date && p.end_date),
    [plans],
  );
  const undatedPlans = useMemo(
    () => plans.filter((p) => !p.start_date || !p.end_date),
    [plans],
  );

  // ── Load spreadsheet data for Aggregate Dashboard ──────────────────────────
  useEffect(() => {
    if (!user || !plans.length) return;
    const load = async () => {
      const stats: PlanStat[] = [];
      for (const plan of plans) {
        try {
          const { data } = await supabase
            .from('upsc_plan_tables').select('columns_data,rows_data')
            .eq('user_id', user.id).eq('plan_id', plan.plan_id);
          if (!data || !data.length) continue;
          let total = 0, done = 0;
          for (const sheet of data) {
            const cols: { id: string; name: string }[] = sheet.columns_data || [];
            const rows: { cells: Record<string, { v: string }> }[] = sheet.rows_data || [];
            const statusCol = cols.find((c) => c.id === 'c_status' || /self.?status|^status$/i.test(c.name));
            const subjCol = cols.find((c) => /subj|subject|topic/i.test(c.name) || c.id === 'c_subj');
            const targetCol = cols.find((c) => /target|task|goal/i.test(c.name) || c.id === 'c_target');
            for (const row of rows) {
              const sv = subjCol ? String(row.cells[subjCol.id]?.v || '').trim() : '';
              const tv = targetCol ? String(row.cells[targetCol.id]?.v || '').trim() : '';
              if (!sv && !tv) continue;
              total++;
              if (statusCol && String(row.cells[statusCol.id]?.v || '').trim() === '✓ Done') done++;
            }
          }
          if (total > 0) {
            stats.push({ title: plan.plan_title, total, done, color: CAT_COLORS[plan.plan_category] || '#818cf8' });
          }
        } catch { /* skip */ }
      }
      setAggStats(stats);
    };
    load();
  }, [user, plans]);

  // Compute Gantt units
  const ganttData = useMemo(() => {
    if (!datedPlans.length) return null;
    const allDates = datedPlans.flatMap((p) => [
      new Date(p.start_date! + 'T00:00:00').getTime(),
      new Date(p.end_date! + 'T00:00:00').getTime(),
    ]);
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    const units = ganttUnits(minDate, maxDate, ganttView);
    return { units, minDate, maxDate };
  }, [datedPlans, ganttView]);

  // Calendar data (navigable month)
  const calendarData = useMemo(() => {
    const year = calYear;
    const month = calMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const days: { day: number; plans: typeof datedPlans }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const activePlans = datedPlans.filter((p) => {
        const s = new Date(p.start_date! + 'T00:00:00');
        const e = new Date(p.end_date! + 'T00:00:00');
        return date >= s && date <= e;
      });
      days.push({ day: d, plans: activePlans });
    }
    return { year, month, firstDay, days, monthName: new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), todayDay: today.getMonth() === month && today.getFullYear() === year ? today.getDate() : -1 };
  }, [datedPlans, calYear, calMonth]);

  // Aggregate stats
  const totalTasks = aggStats.reduce((a, s) => a + s.total, 0);
  const doneTasks = aggStats.reduce((a, s) => a + s.done, 0);
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Pie chart segments
  const pieR = 42, pieRi = 27, pieC = 55, svgSize = pieC * 2;
  let pieAngle = -Math.PI / 2;
  const pieSegs: { d: string; color: string }[] = [];
  const pieLegend: { title: string; pct: number; color: string }[] = [];
  if (totalTasks > 0) {
    for (const s of aggStats) {
      if (!s.total) continue;
      const sweep = (s.total / totalTasks) * 2 * Math.PI;
      const ea = pieAngle + sweep;
      const large = sweep > Math.PI ? 1 : 0;
      const ox1 = pieC + pieR * Math.cos(pieAngle), oy1 = pieC + pieR * Math.sin(pieAngle);
      const ox2 = pieC + pieR * Math.cos(ea), oy2 = pieC + pieR * Math.sin(ea);
      const ix1 = pieC + pieRi * Math.cos(ea), iy1 = pieC + pieRi * Math.sin(ea);
      const ix2 = pieC + pieRi * Math.cos(pieAngle), iy2 = pieC + pieRi * Math.sin(pieAngle);
      pieSegs.push({ color: s.color, d: `M${ox1},${oy1} A${pieR},${pieR} 0 ${large},1 ${ox2},${oy2} L${ix1},${iy1} A${pieRi},${pieRi} 0 ${large},0 ${ix2},${iy2} Z` });
      pieLegend.push({ title: s.title, pct: Math.round((s.total / totalTasks) * 100), color: s.color });
      pieAngle = ea;
    }
  }

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [planTableKey, setPlanTableKey] = useState(0);

  // Sync all plan spreadsheets into master_sheet with month-based tabs (matches old app exactly)
  const syncFromPlans = useCallback(async () => {
    if (!user || !plans.length) return;
    setSyncBusy(true); setSyncMsg('Loading plan data…');
    try {
      const { data: allSheets } = await supabase
        .from('upsc_plan_tables').select('plan_id,sheet_name,columns_data,rows_data')
        .eq('user_id', user.id).neq('plan_id', 'master_sheet');
      if (!allSheets?.length) { setSyncMsg('No plan spreadsheet data found.'); setSyncBusy(false); return; }

      const PLAN_CAT_ORDER: Record<string, number> = { gs1:1, gs2:2, gs3:3, gs4:4, essay:5, optional:6, common:7, custom:8 };
      const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      // Master sheet columns — use standard PlanTable IDs so normalizeColumns works without duplication
      const masterCols = [
        { id: 'c_plan',   name: 'Plan',          width: 140 },
        { id: 'c_subj',   name: 'Subject/Tasks', width: 255 },
        { id: 'c_dates',  name: 'Date',          width: 145 },
        { id: 'c_target', name: 'Target',        width: 175 },
        { id: 'c_status', name: 'Self Status',   width: 105 },
        { id: 'c_remark', name: 'Remarks',       width: 175 },
      ];

      // Parse first month name found in a date string → YYYY-MM key (matches old _guessTaskMonth)
      function guessTaskMonth(periodStr: string, planStart: Date): string | null {
        if (!periodStr || periodStr === 'No dates set') return null;
        const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const lower = periodStr.toLowerCase();
        for (let m = 0; m < MONTHS.length; m++) {
          if (lower.includes(MONTHS[m])) {
            const yrMatch = periodStr.match(/\b(20\d{2})\b/);
            const yr = yrMatch ? parseInt(yrMatch[1]) : planStart.getFullYear();
            return `${yr}-${String(m + 1).padStart(2, '0')}`;
          }
        }
        return null;
      }

      // Positional mapping: col[0]=Subject/Tasks, col[1]=Date, col[2]=Target, col[3]=Self Status, col[4]=Remarks
      type RawItem = { planTitle: string; planCat: string; col0: string; col1: string; col2: string; col3: string; col4: string };
      type MonthBucket = { label: string; items: RawItem[] };

      const monthBuckets: Record<string, MonthBucket> = {};
      const allItems: RawItem[] = [];

      for (const sheet of allSheets) {
        const planMeta = plans.find((p) => p.plan_id === sheet.plan_id);
        const planTitle = planMeta?.plan_title ?? sheet.plan_id;
        const planCat   = planMeta?.plan_category ?? 'common';
        const planSd    = planMeta?.start_date ? new Date(planMeta.start_date + 'T00:00:00') : null;
        const planEd    = planMeta?.end_date   ? new Date(planMeta.end_date   + 'T00:00:00') : planSd;

        // Pre-register all months this plan spans (creates empty tab even if no tasks in that month)
        if (planSd && planEd) {
          const cur = new Date(planSd.getFullYear(), planSd.getMonth(), 1);
          while (cur <= planEd) {
            const yk = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            if (!monthBuckets[yk]) monthBuckets[yk] = { label: `${MONTH_SHORT[cur.getMonth()]} ${cur.getFullYear()}`, items: [] };
            cur.setMonth(cur.getMonth() + 1);
          }
        }

        // Positional: take column ids by their order in the array (position 0-4)
        const cols: Array<{ id: string; name: string }> = sheet.columns_data ?? [];
        const rows: Array<{ id: string; cells: Record<string, { v: string }> }> = sheet.rows_data ?? [];
        const colId = (pos: number) => cols[pos]?.id ?? null;
        const c0 = colId(0); // Subject / Tasks
        const c1 = colId(1); // Date
        const c2 = colId(2); // Target
        const c3 = colId(3); // Self Status
        const c4 = colId(4); // Remarks

        for (const row of rows) {
          const col0 = c0 ? String(row.cells[c0]?.v ?? '').trim() : '';
          const col1 = c1 ? String(row.cells[c1]?.v ?? '').trim() : '';
          const col2 = c2 ? String(row.cells[c2]?.v ?? '').trim() : '';
          const col3 = c3 ? String(row.cells[c3]?.v ?? '').trim() : '';
          const col4 = c4 ? String(row.cells[c4]?.v ?? '').trim() : '';
          // Skip completely empty rows
          if (!col0 && !col1 && !col2 && !col3 && !col4) continue;

          // Parse date range from col1 to determine month routing
          const { start: startISO, end: endISO } = parseDR(col1);
          const startD = startISO ? new Date(startISO + 'T00:00:00') : null;
          const endD   = endISO   ? new Date(endISO   + 'T00:00:00') : startD;

          const item = { planTitle, planCat, col0, col1, col2, col3, col4 };
          allItems.push(item);

          if (startD && endD) {
            // Split across months: one entry per month the date range touches
            const cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
            while (cur <= endD) {
              const yk = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
              if (monthBuckets[yk]) {
                // Clip the date to this month's bounds
                const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
                const clippedStart = startD > cur ? startD : cur;
                const clippedEnd   = endD < monthEnd ? endD : monthEnd;
                const clippedDateStr = formatDR(
                  `${clippedStart.getFullYear()}-${String(clippedStart.getMonth()+1).padStart(2,'0')}-${String(clippedStart.getDate()).padStart(2,'0')}`,
                  `${clippedEnd.getFullYear()}-${String(clippedEnd.getMonth()+1).padStart(2,'0')}-${String(clippedEnd.getDate()).padStart(2,'0')}`
                );
                monthBuckets[yk].items.push({ ...item, col1: clippedDateStr });
              }
              cur.setMonth(cur.getMonth() + 1);
            }
          } else {
            // No parseable date — fall back to plan start month
            const yk = guessTaskMonth(col1, planSd ?? new Date())
              ?? (planSd ? `${planSd.getFullYear()}-${String(planSd.getMonth() + 1).padStart(2, '0')}` : null);
            if (yk && monthBuckets[yk]) monthBuckets[yk].items.push(item);
          }
        }
      }

      // Sort by cat order then plan title (matches old _sortItems)
      const sortItems = (items: RawItem[]) => items.slice().sort((a, b) => {
        const oA = PLAN_CAT_ORDER[a.planCat] ?? 99, oB = PLAN_CAT_ORDER[b.planCat] ?? 99;
        return oA !== oB ? oA - oB : a.planTitle.localeCompare(b.planTitle);
      });

      // Build spreadsheet rows — plan name shown once per group, blank for subsequent rows of same plan
      const buildRows = (items: RawItem[]) => {
        const sorted = sortItems(items);
        if (!sorted.length) return [{ id: 'r_empty', cells: {
          c_plan:{v:'(no items)'}, c_subj:{v:''}, c_dates:{v:''}, c_target:{v:''}, c_status:{v:''}, c_remark:{v:''}
        }}];
        let lastPlan = '';
        return sorted.map((item, i) => {
          const showPlan = item.planTitle !== lastPlan;
          lastPlan = item.planTitle;
          return { id: `r_${i}`, cells: {
            c_plan:   { v: showPlan ? item.planTitle : '' },
            c_subj:   { v: item.col0 },
            c_dates:  { v: item.col1 },
            c_target: { v: item.col2 },
            c_status: { v: item.col3 },
            c_remark: { v: item.col4 },
          }};
        });
      };

      // Wipe all existing master_sheet content and re-insert fresh
      await supabase.from('upsc_plan_tables').delete()
        .eq('user_id', user.id).eq('plan_id', 'master_sheet');

      const sortedYks = Object.keys(monthBuckets).sort();
      const toInsert = [
        { user_id: user.id, plan_id: 'master_sheet', sheet_name: '\u2605 All Items',
          columns_data: masterCols, rows_data: buildRows(allItems), sort_order: 0 },
        ...sortedYks.map((yk, i) => ({
          user_id: user.id, plan_id: 'master_sheet',
          sheet_name: monthBuckets[yk].label,
          columns_data: masterCols, rows_data: buildRows(monthBuckets[yk].items),
          sort_order: i + 1,
        })),
      ];
      for (const s of toInsert) await supabase.from('upsc_plan_tables').insert(s);
      setPlanTableKey((k) => k + 1);
      setSyncMsg(`\u2713 Synced ${allItems.length} rows \u2192 \u2605 All Items + ${sortedYks.length} month tabs`);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncMsg('Sync failed. See console.');
    } finally {
      setSyncBusy(false);
    }
  }, [user, plans]);

  return (
    <div className="space-y-6">
      {/* Mission Timeline — header + calendar sidebar + gantt in one card */}
      <div className="neo-card rounded-3xl p-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="heading-font text-xl font-black">📅 Mission Timeline</h2>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className={`plan-gantt-view-btn${calVisible ? ' active' : ''}`} onClick={() => setCalVisible(v => !v)}>📅 Calendar</button>
            <button className={`plan-gantt-view-btn${ganttView === 'month' ? ' active' : ''}`} onClick={() => setGanttView('month')}>Monthly</button>
            <button className={`plan-gantt-view-btn${ganttView === 'week' ? ' active' : ''}`} onClick={() => setGanttView('week')}>Weekly</button>
          </div>
        </div>
        {plans.length === 0 ? (
          <div className="plan-gantt-empty-msg">No plans yet. Create plans to see the mission timeline.</div>
        ) : datedPlans.length === 0 ? (
          <div className="plan-gantt-empty-msg">
            Add start → end dates to your plans to see them on the timeline.
            {undatedPlans.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
                {undatedPlans.map((p) => <span key={p.plan_id} className="plan-badge plan-type-badge">{p.plan_title}</span>)}
              </div>
            )}
          </div>
        ) : ganttData ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Calendar sidebar — 295px, collapsible, drag-resizable */}
            {calVisible && (
              <div ref={calRef} style={{ width: '295px', flexShrink: 0, background: 'var(--card)', border: '1px solid var(--bdr)', borderRadius: '0.85rem', padding: '0.75rem 0.9rem 0.5rem', overflow: 'hidden', ...(calHeight ? { height: calHeight + 'px' } : {}) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.6rem' }}>
                  <button onClick={() => { const d = new Date(calYear, calMonth - 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} style={{ background: 'none', border: '1px solid var(--bdr)', color: 'var(--t2)', borderRadius: '0.3rem', width: '1.5rem', height: '1.5rem', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--t1)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{calendarData.monthName}</span>
                  <button onClick={() => { const d = new Date(calYear, calMonth + 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} style={{ background: 'none', border: '1px solid var(--bdr)', color: 'var(--t2)', borderRadius: '0.3rem', width: '1.5rem', height: '1.5rem', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
                  <button onClick={() => { const t = new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: '0.3rem', padding: '0.1rem 0.45rem', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>Today</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: '0.58rem', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)', padding: '0.14rem 0' }}>{d}</div>
                  ))}
                  {Array.from({ length: calendarData.firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                  {calendarData.days.map(({ day, plans: dayPlans }) => {
                    const isToday = day === calendarData.todayDay;
                    return (
                      <div key={day} style={{ textAlign: 'center', fontSize: '0.7rem', fontFamily: 'var(--mono)', color: isToday ? '#818cf8' : dayPlans.length ? '#34d399' : 'var(--t2)', padding: '0.32rem 0.05rem', borderRadius: '0.28rem', lineHeight: 1.3, minHeight: '2.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: isToday ? 900 : dayPlans.length ? 700 : undefined, background: isToday ? 'rgba(99,102,241,0.18)' : 'transparent', boxShadow: isToday ? 'inset 0 0 0 1px rgba(99,102,241,0.45)' : undefined }}>
                        {day}
                        {dayPlans.length > 0 && (
                          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' }}>
                            {dayPlans.slice(0, 4).map((dp) => (
                              <div key={dp.plan_id} style={{ width: 5, height: 5, borderRadius: '50%', background: CAT_COLORS[dp.plan_category] || '#34d399', cursor: 'pointer', flexShrink: 0 }} title={dp.plan_title} onClick={(e) => { e.stopPropagation(); handlePlanClick(dp.plan_id); }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="sw-resize-handle" onMouseDown={handleCalResizeStart} title="Drag to resize calendar height">
                  <span className="sw-resize-dots">⋯</span>
                </div>
              </div>
            )}
            {/* Gantt chart */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="plan-gantt-outer">
                <div className="plan-gantt-scroll">
                  <div
                    className="plan-gantt-grid"
                    style={{ gridTemplateColumns: `9rem repeat(${ganttData.units.length}, minmax(${ganttView === 'month' ? '4.8rem' : '3.2rem'}, 1fr))` }}
                  >
                    <div className="plan-gantt-corner">PLAN</div>
                    {ganttData.units.map((u, ci) => {
                      const isNow = ganttIsNow(u, ganttView, new Date());
                      const label = ganttView === 'month'
                        ? u.toLocaleDateString('en-IN', { month: 'short' })
                        : u.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                      const yearStr = ganttView === 'month' ? String(u.getFullYear()) : '';
                      return (
                        <div key={ci} className={`plan-gantt-col-hdr${isNow ? ' plan-gantt-now-col' : ''}`}>
                          {label}{yearStr && <><br /><span className="plan-gantt-yr">{yearStr}</span></>}
                        </div>
                      );
                    })}
                    {datedPlans.map((p) => {
                      const catStyle = CAT_STYLES[p.plan_category] || CAT_STYLES.custom;
                      const catLabel = p.plan_subject || CAT_LABELS[p.plan_category] || p.plan_category;
                      const planStart = new Date(p.start_date! + 'T00:00:00');
                      const planEnd = new Date(p.end_date! + 'T23:59:59');
                      return [
                        <div key={`lbl-${p.plan_id}`} className="plan-gantt-row-label" style={{ cursor: 'pointer' }} onClick={() => handlePlanClick(p.plan_id)} title={`Open ${p.plan_title}`}>
                          <div className="plan-gantt-plan-name" title={p.plan_title}>{p.plan_title}</div>
                          <div className="plan-gantt-plan-sub" style={{ color: catStyle.text }}>{catLabel}</div>
                        </div>,
                        ...ganttData.units.map((u, ci) => {
                          const uEnd = ganttUnitEnd(u, ganttView);
                          if (planStart > uEnd || planEnd < u) {
                            return <div key={`empty-${p.plan_id}-${ci}`} className="plan-gantt-empty-cell" />;
                          }
                          const isFirst = ci === 0 || planStart > ganttUnitEnd(ganttData.units[ci - 1], ganttView);
                          const isLast = ci === ganttData.units.length - 1 || planEnd < ganttData.units[ci + 1];
                          const rL = isFirst ? '0.4rem' : '0';
                          const rR = isLast ? '0.4rem' : '0';
                          return (
                            <div
                              key={`bar-${p.plan_id}-${ci}`}
                              className="plan-gantt-bar-cell"
                              style={{
                                background: catStyle.bg,
                                borderTop: `2px solid ${catStyle.text}55`,
                                borderBottom: `2px solid ${catStyle.text}55`,
                                ...(isFirst ? { borderLeft: `3px solid ${catStyle.text}` } : {}),
                                ...(isLast ? { borderRight: `2px solid ${catStyle.text}` } : {}),
                                borderRadius: `${rL} ${rR} ${rR} ${rL}`,
                                cursor: 'pointer',
                              }}
                              onClick={() => handlePlanClick(p.plan_id)}
                              title={p.plan_title}
                            />
                          );
                        }),
                      ];
                    })}
                  </div>
                </div>
                {undatedPlans.length > 0 && (
                  <div className="plan-gantt-undated">
                    <span style={{ color: 'var(--t3)', fontSize: '0.65rem', fontFamily: 'var(--mono)' }}>No date range:</span>
                    {undatedPlans.map((p) => (
                      <span key={p.plan_id} className="plan-badge plan-type-badge" style={{ cursor: 'pointer' }} onClick={() => handlePlanClick(p.plan_id)} title={`Open ${p.plan_title}`}>{p.plan_title}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Aggregate Dashboard */}
      <div className="neo-card rounded-3xl p-6">
        <h2 className="heading-font text-xl font-black mb-4">📊 Aggregate Overview</h2>
        {plans.length === 0 ? (
          <p className="text-xs text-slate-400 font-mono text-center py-4">No plans yet. Create plans to see the aggregate dashboard.</p>
        ) : aggStats.length === 0 ? (
          <p style={{ fontSize: '0.7rem', color: 'var(--t3)', fontFamily: 'var(--mono)', textAlign: 'center', padding: '1rem 0' }}>
            No table rows yet — add rows in your plan spreadsheets.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Bar chart — Completion % per Plan */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--mono)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>▪ Completion % per Plan</div>
              {aggStats.map((s) => {
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ minWidth: '7.5rem', maxWidth: '7.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.63rem', color: 'var(--t2)', fontFamily: 'var(--mono)' }} title={s.title}>{s.title}</span>
                    <div style={{ flex: 1, background: 'var(--bdr)', borderRadius: '1rem', overflow: 'hidden', height: '0.42rem' }}>
                      <div style={{ width: `${pct}%`, background: s.color, height: '100%', borderRadius: '1rem', transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: 'var(--t3)', fontFamily: 'var(--mono)', minWidth: '2.5rem', textAlign: 'right' }}>{s.done}/{s.total}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--t2)', fontFamily: 'var(--mono)', minWidth: '2rem', textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
            {/* Pie chart — Plan Distribution */}
            {pieSegs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', minWidth: 110 }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Plan Distribution</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    {pieSegs.map((seg, i) => (
                      <path key={i} d={seg.d} fill={seg.color} opacity={0.88} stroke="var(--card)" strokeWidth={1.5} />
                    ))}
                    <text x={pieC} y={pieC + 4} textAnchor="middle" fontSize={11} fontWeight={900} fill="var(--t1)" fontFamily="monospace">{totalTasks}</text>
                  </svg>
                  <div style={{ minWidth: 76 }}>
                    {pieLegend.map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '0.6rem', color: 'var(--t2)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '6rem' }} title={l.title}>{l.title}</span>
                        <span style={{ fontSize: '0.58rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginLeft: 'auto' }}>{l.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Done/Pending chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 76 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Overall</div>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '0.45rem', padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981', fontFamily: 'var(--mono)', lineHeight: 1 }}>{doneTasks}</div>
                <div style={{ fontSize: '0.55rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 1 }}>✓ Done</div>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: '0.45rem', padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--mono)', lineHeight: 1 }}>{totalTasks - doneTasks}</div>
                <div style={{ fontSize: '0.55rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 1 }}>○ Pending</div>
              </div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--t2)', fontFamily: 'var(--mono)', textAlign: 'center', padding: '0.15rem 0' }}>{overallPct}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Master Spreadsheet */}
      <div className="neo-card rounded-3xl p-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="heading-font text-xl font-black">⊞ Master Spreadsheet</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {syncMsg && <span style={{ fontSize: '0.65rem', color: syncMsg.startsWith('✓') ? '#10b981' : '#f59e0b', fontFamily: 'var(--mono)' }}>{syncMsg}</span>}
            <button
              onClick={syncFromPlans}
              disabled={syncBusy || !plans.length}
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: '0.5rem', padding: '0.3rem 0.75rem', fontSize: '0.65rem', fontWeight: 700, cursor: syncBusy ? 'not-allowed' : 'pointer', fontFamily: 'var(--mono)', opacity: syncBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}
              title="Import all plan spreadsheets and create month-based tabs"
            >
              {syncBusy ? '↺ Syncing…' : '↺ Sync from Plans'}
            </button>
          </div>
        </div>
        <PlanTable key={planTableKey} planId="master_sheet" readOnly />
      </div>

      {/* Plan Drawer: opened when clicking a plan in Gantt/Calendar */}
      {selectedPlan && (
        <PlanDrawer
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onPlanUpdated={() => { refresh(true); setSelectedPlan(null); }}
        />
      )}
    </div>
  );
}
