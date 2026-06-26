import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ENV } from '../../lib/env';

// ── Types ────────────────────────────────────────────────────────────────────
interface ColDef { id: string; name: string; width: number; }
interface CellData {
  v: string; b?: boolean; i?: boolean; u?: boolean; sk?: boolean;
  sz?: number; fg?: string; bg?: string; al?: 'l' | 'c' | 'r';
  rs?: number; cs?: number; mg?: boolean;
}
interface RowData { id: string; cells: Record<string, CellData>; }
interface SheetData {
  id: string | null; plan_id: string; sheet_name: string;
  columns_data: ColDef[]; rows_data: RowData[]; sort_order: number;
}
interface Props { planId: string; readOnly?: boolean; }

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_COLS: ColDef[] = [
  { id: 'c_subj',   name: 'Subject / Tasks', width: 160 },
  { id: 'c_dates',  name: 'Date',            width: 130 },
  { id: 'c_target', name: 'Target',          width: 200 },
  { id: 'c_status', name: 'Self Status',     width: 120 },
  { id: 'c_remark', name: 'Remarks',         width: 260 },
];

const STANDARD_IDS = DEFAULT_COLS.map((c) => c.id);

// ── Normalize loaded columns to always lead with the 5 standard cols ─────────
// Preserves user-resized widths and appends any extra (custom/hw) cols at end.
// Also adds any missing standard cols (with empty cells auto-filled by getCell).
// Special: c_plan is always kept as the FIRST column when present (master sheet).
function normalizeColumns(stored: ColDef[]): ColDef[] {
  const planCol = stored.find((c) => c.id === 'c_plan');
  const result: ColDef[] = DEFAULT_COLS.map((std) => {
    const existing = stored.find((c) => c.id === std.id);
    return { id: std.id, name: std.name, width: existing?.width ?? std.width };
  });
  if (planCol) result.unshift(planCol); // Plan column always goes first
  // Append non-standard cols (not in DEFAULT_COLS, not c_plan)
  stored.forEach((c) => {
    if (!STANDARD_IDS.includes(c.id) && c.id !== 'c_plan') result.push(c);
  });
  return result;
}

// ── Ensure every row has cells for all columns ────────────────────────────────
function normalizeRows(rows: RowData[], cols: ColDef[]): RowData[] {
  return rows.map((row) => {
    const cells = { ...row.cells };
    cols.forEach((c) => { if (!(c.id in cells)) cells[c.id] = { v: '' }; });
    return { ...row, cells };
  });
}

const STATUS_OPTIONS = ['', '○ Pending', '⟳ In Progress', '✓ Done'];

// ── Date column helpers ───────────────────────────────────────────────────────
function isDateCol(col: ColDef): boolean { return col.id === 'c_dates'; }

function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])) : null;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function fmtDDMMYY(d: Date): string {
  return `${pad2(d.getDate())}-${pad2(d.getMonth()+1)}-${String(d.getFullYear()).slice(-2)}`;
}

/** Format two ISO strings → dd-mm-yy range string stored in cell.v */
export function formatDR(startISO: string, endISO: string): string {
  const s = isoToDate(startISO), e = isoToDate(endISO);
  if (!s && !e) return '';
  if (!s) return fmtDDMMYY(e!);
  if (!e || startISO === endISO) return fmtDDMMYY(s);
  return `${fmtDDMMYY(s)} – ${fmtDDMMYY(e)}`;
}

/** Parse a date range string → {start, end} ISO (best-effort) */
export function parseDR(display: string): { start: string; end: string } {
  if (!display) return { start: '', end: '' };

  // Parse dd-mm-yy or dd-mm-yyyy token
  const parseDMY = (tok: string): string => {
    const m = tok.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
    if (!m) return '';
    const day = parseInt(m[1]), mon = parseInt(m[2]) - 1;
    const yr = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    return `${yr}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };

  // Range: dd-mm-yy – dd-mm-yy
  const rangeSep = display.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (rangeSep) {
    const s = parseDMY(rangeSep[1]);
    const e = parseDMY(rangeSep[2]);
    if (s || e) return { start: s, end: e };
  }

  // Single date
  const single = parseDMY(display);
  if (single) return { start: single, end: '' };

  // Legacy month-name format fallback
  const MMAP: Record<string, number> = {
    jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
    january:0,february:1,march:2,april:3,june:5,july:6,august:7,
    september:8,october:9,november:10,december:11,
  };
  const d2iso = (day: number, mon: number, yr: number) =>
    `${yr}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const parseToken = (tok: string, yrFallback: number) => {
    const t = tok.trim().toLowerCase().replace(/\s+/g, ' ');
    const m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/);
    if (!m) return null;
    const mon = MMAP[m[2]];
    if (mon === undefined) return null;
    return { day: parseInt(m[1]), mon, yr: m[3] ? parseInt(m[3]) : yrFallback };
  };
  const legacySep = display.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (legacySep) {
    const rawEnd = legacySep[2].trim();
    const yrMatch = rawEnd.match(/(\d{4})\s*$/);
    const yr = yrMatch ? parseInt(yrMatch[1]) : new Date().getFullYear();
    const endParsed = parseToken(rawEnd, yr);
    if (!endParsed) return { start: '', end: '' };
    const endISO = d2iso(endParsed.day, endParsed.mon, endParsed.yr);
    const startRaw = legacySep[1].trim();
    const dayOnly = startRaw.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
    if (dayOnly) return { start: d2iso(parseInt(dayOnly[1]), endParsed.mon, endParsed.yr), end: endISO };
    const startParsed = parseToken(startRaw, endParsed.yr);
    return { start: startParsed ? d2iso(startParsed.day, startParsed.mon, startParsed.yr) : '', end: endISO };
  }
  const legacySingle = parseToken(display, new Date().getFullYear());
  return legacySingle ? { start: d2iso(legacySingle.day, legacySingle.mon, legacySingle.yr), end: '' } : { start: '', end: '' };
}

function createDefaultSheet(planId: string, name: string, order: number): SheetData {
  const cols = DEFAULT_COLS.map((c) => ({ ...c }));
  const rows: RowData[] = [];
  for (let i = 0; i < 8; i++) {
    const cells: Record<string, CellData> = {};
    cols.forEach((c) => { cells[c.id] = { v: '' }; });
    rows.push({ id: `r_${Date.now()}_${i}`, cells });
  }
  return { id: null, plan_id: planId, sheet_name: name, columns_data: cols, rows_data: rows, sort_order: order };
}

function getCell(raw: CellData | string | null | undefined): CellData {
  if (!raw) return { v: '' };
  if (typeof raw === 'string') return { v: raw };
  return raw;
}

function getCellStyle(c: CellData): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (c.b) style.fontWeight = 700;
  if (c.i) style.fontStyle = 'italic';
  const td: string[] = [];
  if (c.u) td.push('underline');
  if (c.sk) td.push('line-through');
  if (td.length) style.textDecoration = td.join(' ');
  if (c.sz) style.fontSize = `${c.sz}px`;
  if (c.fg) style.color = c.fg;
  if (c.bg) style.background = c.bg;
  if (c.al === 'c') style.textAlign = 'center';
  else if (c.al === 'r') style.textAlign = 'right';
  else if (c.al === 'l') style.textAlign = 'left';
  return style;
}

function statusClass(v: string): string {
  if (v === '✓ Done') return 'done';
  if (v === '⟳ In Progress') return 'progress';
  if (!v || v === '○ Pending') return 'pending';
  return 'custom';
}

// ── Component ────────────────────────────────────────────────────────────────
export function PlanTable({ planId, readOnly = false }: Props) {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [selAnchor, setSelAnchor] = useState<{ ri: number; ci: number } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterRow, setFilterRow] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ ri: number; ci: number } | null>(null);
  // ── Inline rename / add state ──────────────────────────────────────────────
  const [addingSheet, setAddingSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [renamingSheet, setRenamingSheet] = useState<number | null>(null);
  const [renameSheetVal, setRenameSheetVal] = useState('');
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameColVal, setRenameColVal] = useState('');
  const [customStatusCell, setCustomStatusCell] = useState<{ ri: number; colId: string } | null>(null);
  const [customStatusVal, setCustomStatusVal] = useState('');
  const [deleteRowsConfirm, setDeleteRowsConfirm] = useState(false);
  const [deleteSheetConfirm, setDeleteSheetConfirm] = useState<number | null>(null);
  const [fgPanelOpen, setFgPanelOpen] = useState(false);
  const [bgPanelOpen, setBgPanelOpen] = useState(false);
  // ── Date range picker state ────────────────────────────────────────────────
  const [datePicker, setDatePicker] = useState<{
    ri: number; ci: number; colId: string; startISO: string; endISO: string;
    anchorRect: DOMRect;
  } | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const selSnap = useRef<Record<string, boolean>>({});
  // Always-current ref so debounce timers never read stale sheets state
  const sheetsRef = useRef<SheetData[]>(sheets);
  useEffect(() => { sheetsRef.current = sheets; }, [sheets]);
  // ── Undo / Redo history stacks ─────────────────────────────────────────────
  const undoStack = useRef<{ si: number; rows: RowData[] }[]>([]);
  const redoStack = useRef<{ si: number; rows: RowData[] }[]>([]);

  // ── Load sheets ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      let loaded: SheetData[] = [];
      try {
        const { data } = await supabase
          .from('upsc_plan_tables').select('*')
          .eq('user_id', user.id).eq('plan_id', planId)
          .order('sort_order', { ascending: true });
        if (data && data.length > 0) {
          loaded = data.map((d: any) => {
            const cols = normalizeColumns(d.columns_data || DEFAULT_COLS);
            const rows = normalizeRows(d.rows_data || [], cols);
            return {
              id: d.id, plan_id: d.plan_id, sheet_name: d.sheet_name,
              columns_data: cols, rows_data: rows, sort_order: d.sort_order || 0,
            };
          });
        }
      } catch { /* fallback */ }
      if (!loaded.length) {
        try {
          const stored = localStorage.getItem(`upsc_pt_${planId}`);
          if (stored) {
            const parsed: SheetData[] = JSON.parse(stored);
            loaded = parsed.map((s) => {
              const cols = normalizeColumns(s.columns_data || DEFAULT_COLS);
              return { ...s, columns_data: cols, rows_data: normalizeRows(s.rows_data || [], cols) };
            });
          }
        } catch { /* ignore */ }
      }
      if (!loaded.length) {
        const def = createDefaultSheet(planId, 'Sheet 1', 0);
        loaded = [def];
        saveSheet(def, [def]);
      }
      setSheets(loaded);
      setActiveSheet(0);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, planId]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveSheet = useCallback(async (sheet: SheetData, allSheets?: SheetData[]) => {
    if (!user) return;
    setSaveStatus('saving');
    const all = allSheets || sheets;
    try { localStorage.setItem(`upsc_pt_${planId}`, JSON.stringify(all)); } catch { /* ignore */ }
    try {
      let planTitle = planId;
      try { planTitle = decodeURIComponent(escape(atob(planId))); } catch { /* ignore */ }
      const payload = {
        user_id: user.id, plan_id: planId, plan_title: planTitle,
        sheet_name: sheet.sheet_name, columns_data: sheet.columns_data,
        rows_data: sheet.rows_data, sort_order: sheet.sort_order || 0,
        updated_at: new Date().toISOString(),
      };
      if (sheet.id) {
        const { error } = await supabase.from('upsc_plan_tables').update(payload).eq('id', sheet.id).eq('user_id', user.id);
        if (error) sheet.id = null;
      }
      if (!sheet.id) {
        const { data: ins } = await supabase.from('upsc_plan_tables').insert(payload).select().single();
        if (ins) sheet.id = ins.id;
      }
    } catch { /* ignore */ }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }, [user, planId, sheets]);

  const debounceSave = useCallback((si: number) => {
    if (saveTimers.current[si]) clearTimeout(saveTimers.current[si]);
    setSaveStatus('saving');
    saveTimers.current[si] = setTimeout(() => {
      // Always read from ref — never from stale closure
      const latest = sheetsRef.current;
      const sheet = latest[si];
      if (sheet) saveSheet(sheet, latest);
    }, ENV.PT_DEBOUNCE_MS || 400);
  }, [saveSheet]); // no `sheets` dep — we use the ref

  // ── Helper to update active sheet ──────────────────────────────────────────
  const updateSheet = useCallback((updater: (s: SheetData) => SheetData) => {
    setSheets((prev) => {
      const next = [...prev];
      const si = activeSheet;
      // Push current rows to undo stack before mutating
      undoStack.current.push({ si, rows: JSON.parse(JSON.stringify(next[si].rows_data)) });
      if (undoStack.current.length > 60) undoStack.current.shift();
      redoStack.current = []; // new edit clears forward history
      next[si] = updater({ ...next[si] });
      return next;
    });
    debounceSave(activeSheet);
  }, [activeSheet, debounceSave]);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    setSheets((prev) => {
      const next = [...prev];
      redoStack.current.push({ si: entry.si, rows: JSON.parse(JSON.stringify(next[entry.si].rows_data)) });
      next[entry.si] = { ...next[entry.si], rows_data: entry.rows };
      return next;
    });
    debounceSave(activeSheet);
  }, [activeSheet, debounceSave]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    setSheets((prev) => {
      const next = [...prev];
      undoStack.current.push({ si: entry.si, rows: JSON.parse(JSON.stringify(next[entry.si].rows_data)) });
      next[entry.si] = { ...next[entry.si], rows_data: entry.rows };
      return next;
    });
    debounceSave(activeSheet);
  }, [activeSheet, debounceSave]);

  // ── Date picker commit ────────────────────────────────────────────────────
  const commitDatePicker = useCallback(() => {
    if (!datePicker) return;
    const { ri, colId, startISO, endISO } = datePicker;
    const value = formatDR(startISO, endISO);
    updateSheet((s) => {
      const rows = [...s.rows_data];
      const row = { ...rows[ri], cells: { ...rows[ri].cells } };
      row.cells[colId] = { ...getCell(row.cells[colId]), v: value };
      rows[ri] = row;
      return { ...s, rows_data: rows };
    });
    setDatePicker(null);
  }, [datePicker, updateSheet]);

  // Close date picker on outside click / Escape
  useEffect(() => {
    if (!datePicker) return;
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePicker(null);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDatePicker(null);
      if (e.key === 'Enter') commitDatePicker();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [datePicker, commitDatePicker]);

  // ── Cell editing ───────────────────────────────────────────────────────────
  const onCellBlur = (ri: number, colId: string, el: HTMLElement) => {
    const value = el.textContent || '';
    updateSheet((s) => {
      const rows = [...s.rows_data];
      const row = { ...rows[ri], cells: { ...rows[ri].cells } };
      row.cells[colId] = { ...getCell(row.cells[colId]), v: value };
      rows[ri] = row;
      return { ...s, rows_data: rows };
    });
    setEditingCell(null);
  };

  const onStatusChange = (ri: number, colId: string, value: string) => {
    if (value === '__custom__') {
      setCustomStatusCell({ ri, colId });
      setCustomStatusVal('');
      return;
    }
    if (value === '__custom_display__') return;
    updateSheet((s) => {
      const rows = [...s.rows_data];
      const row = { ...rows[ri], cells: { ...rows[ri].cells } };
      row.cells[colId] = { ...getCell(row.cells[colId]), v: value };
      rows[ri] = row;
      return { ...s, rows_data: rows };
    });
  };

  const commitCustomStatus = () => {
    if (!customStatusCell || !customStatusVal.trim()) { setCustomStatusCell(null); return; }
    const { ri, colId } = customStatusCell;
    updateSheet((s) => {
      const rows = [...s.rows_data];
      const row = { ...rows[ri], cells: { ...rows[ri].cells } };
      row.cells[colId] = { ...getCell(row.cells[colId]), v: customStatusVal.trim() };
      rows[ri] = row;
      return { ...s, rows_data: rows };
    });
    setCustomStatusCell(null);
  };

  // ── Row operations ─────────────────────────────────────────────────────────
  const addRow = () => {
    updateSheet((s) => {
      const cells: Record<string, CellData> = {};
      s.columns_data.forEach((c) => { cells[c.id] = { v: '' }; });
      return { ...s, rows_data: [...s.rows_data, { id: `r_${Date.now()}`, cells }] };
    });
  };

  const insertRowAt = (idx: number) => {
    updateSheet((s) => {
      const cells: Record<string, CellData> = {};
      s.columns_data.forEach((c) => { cells[c.id] = { v: '' }; });
      const rows = [...s.rows_data];
      rows.splice(idx + 1, 0, { id: `r_${Date.now()}`, cells });
      return { ...s, rows_data: rows };
    });
  };

  const delRow = (ri: number) => {
    updateSheet((s) => ({ ...s, rows_data: s.rows_data.filter((_, i) => i !== ri) }));
    setSelectedRows(new Set());
  };

  const delSelectedRows = () => {
    // Work from row-header selection OR any selected cells
    const toDelete = new Set(selectedRows);
    Object.keys(selSnap.current).forEach((k) => toDelete.add(parseInt(k.split('_')[0])));
    if (!toDelete.size) return;
    updateSheet((s) => ({ ...s, rows_data: s.rows_data.filter((_, i) => !toDelete.has(i)) }));
    setSelectedRows(new Set());
    setSel({});
    selSnap.current = {};
    setDeleteRowsConfirm(false);
  };

  // kept for backward compat (inline confirm still calls this)
  const doDeleteRows = delSelectedRows;

  // ── Delete selected columns ────────────────────────────────────────────────
  const delSelectedCols = () => {
    const toDeleteIdxs = new Set(selectedCols);
    Object.keys(selSnap.current).forEach((k) => toDeleteIdxs.add(parseInt(k.split('_')[1])));
    if (!toDeleteIdxs.size) return;
    const sheet = sheets[activeSheet];
    const toDeleteIds = new Set(
      [...toDeleteIdxs].map((ci) => sheet.columns_data[ci]?.id).filter(Boolean) as string[],
    );
    if (sheet.columns_data.length - toDeleteIds.size < 1) return; // keep at least one column
    updateSheet((s) => ({
      ...s,
      columns_data: s.columns_data.filter((c) => !toDeleteIds.has(c.id)),
      rows_data: s.rows_data.map((row) => {
        const cells = { ...row.cells };
        toDeleteIds.forEach((id) => delete cells[id]);
        return { ...row, cells };
      }),
    }));
    setSelectedCols(new Set());
    setSel({});
    selSnap.current = {};
  };

  // ── Column operations ──────────────────────────────────────────────────────
  const addCol = () => {
    const colId = `c_${Date.now()}`;
    updateSheet((s) => ({
      ...s,
      columns_data: [...s.columns_data, { id: colId, name: 'Column', width: 140 }],
      rows_data: s.rows_data.map((row) => ({ ...row, cells: { ...row.cells, [colId]: { v: '' } } })),
    }));
  };

  const delCol = (colId: string) => {
    const sheet = sheets[activeSheet];
    if (sheet.columns_data.length <= 1) return;
    // Direct delete — no confirm() popup
    updateSheet((s) => ({
      ...s,
      columns_data: s.columns_data.filter((c) => c.id !== colId),
      rows_data: s.rows_data.map((row) => { const cells = { ...row.cells }; delete cells[colId]; return { ...row, cells }; }),
    }));
  };

  const renameCol = (colId: string) => {
    const sheet = sheets[activeSheet];
    const col = sheet?.columns_data.find((c) => c.id === colId);
    if (!col) return;
    setRenamingCol(colId);
    setRenameColVal(col.name);
  };

  const commitRenameCol = () => {
    if (!renamingCol) return;
    const name = renameColVal.trim();
    if (name) updateSheet((s) => ({ ...s, columns_data: s.columns_data.map((c) => c.id === renamingCol ? { ...c, name } : c) }));
    setRenamingCol(null);
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  const toggleSort = (colId: string) => {
    if (sortCol === colId) {
      if (sortDir === 'desc') { setSortCol(null); setSortDir('asc'); }
      else setSortDir('desc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // ── Formatting ─────────────────────────────────────────────────────────────
  // Reads selSnap.current at call-time (never stale) so color swatches always work
  const applyFormat = useCallback((prop: keyof CellData, value?: string) => {
    const selKeys = Object.keys(selSnap.current);
    if (!selKeys.length) return;

    setSheets((prev) => {
      const next = [...prev];
      const s = { ...next[activeSheet] };
      const rows = [...s.rows_data];
      const isBool = prop === 'b' || prop === 'i' || prop === 'u' || prop === 'sk';

      // For toggle: detect if ALL selected cells have the property on
      let allOn = false;
      if (isBool) {
        allOn = selKeys.every((key) => {
          const [riStr, ciStr] = key.split('_');
          const ri = parseInt(riStr), ci = parseInt(ciStr);
          const col = s.columns_data[ci];
          if (!col || !rows[ri]) return false;
          const cell = getCell(rows[ri].cells[col.id]);
          return !!(cell as any)[prop];
        });
      }

      selKeys.forEach((key) => {
        const [riStr, ciStr] = key.split('_');
        const ri = parseInt(riStr), ci = parseInt(ciStr);
        const col = s.columns_data[ci];
        if (!col || !rows[ri]) return;
        const row = { ...rows[ri], cells: { ...rows[ri].cells } };
        const cell = { ...getCell(row.cells[col.id]) };
        if (isBool) (cell as any)[prop] = !allOn;
        else if (prop === 'al') cell.al = cell.al === value ? undefined : (value as 'l' | 'c' | 'r');
        else if (!value) delete (cell as any)[prop]; // empty = clear the property
        else (cell as any)[prop] = value;
        row.cells[col.id] = cell;
        rows[ri] = row;
      });
      s.rows_data = rows;
      next[activeSheet] = s;
      return next;
    });
    debounceSave(activeSheet);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet, debounceSave]); // intentionally omits `sel` — reads selSnap.current at call time

  // ── Selection ──────────────────────────────────────────────────────────────
  const selectRow = (ri: number) => {
    const sheet = sheets[activeSheet];
    const newSel: Record<string, boolean> = {};
    sheet.columns_data.forEach((_, ci) => { newSel[`${ri}_${ci}`] = true; });
    setSel(newSel);
    selSnap.current = newSel;
    setSelectedRows((prev) => { const n = new Set(prev); n.has(ri) ? n.delete(ri) : n.add(ri); return n; });
    setSelectedCols(new Set());
    setSelAnchor({ ri, ci: 0 });
  };

  const selectCol = (ci: number) => {
    const sheet = sheets[activeSheet];
    const newSel: Record<string, boolean> = {};
    sheet.rows_data.forEach((_, ri) => { newSel[`${ri}_${ci}`] = true; });
    setSel(newSel);
    selSnap.current = newSel;
    setSelectedCols((prev) => { const n = new Set(prev); n.has(ci) ? n.delete(ci) : n.add(ci); return n; });
    setSelectedRows(new Set());
    setSelAnchor({ ri: 0, ci });
  };

  const selectAll = useCallback(() => {
    const sheet = sheets[activeSheet];
    if (!sheet) return;
    const newSel: Record<string, boolean> = {};
    sheet.rows_data.forEach((_, ri) => sheet.columns_data.forEach((__, ci) => { newSel[`${ri}_${ci}`] = true; }));
    setSel(newSel);
    selSnap.current = newSel;
  }, [sheets, activeSheet]);

  const onCellMouseDown = (ri: number, ci: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'SELECT') return;
    // Focus the wrapper so keyboard events (arrows, Enter, etc.) are captured reliably
    wrapRef.current?.focus({ preventScroll: true });
    setSelectedRows(new Set());
    setSelectedCols(new Set());
    if (e.shiftKey && selAnchor) {
      const newSel: Record<string, boolean> = {};
      const r1 = Math.min(selAnchor.ri, ri), r2 = Math.max(selAnchor.ri, ri);
      const c1 = Math.min(selAnchor.ci, ci), c2 = Math.max(selAnchor.ci, ci);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) newSel[`${r}_${c}`] = true;
      setSel(newSel);
      selSnap.current = newSel;
    } else {
      const newSel = { [`${ri}_${ci}`]: true };
      setSel(newSel);
      selSnap.current = newSel;
      setSelAnchor({ ri, ci });
    }
    dragging.current = true;
  };

  const onCellMouseEnter = (ri: number, ci: number) => {
    if (!dragging.current || !selAnchor) return;
    const newSel: Record<string, boolean> = {};
    const r1 = Math.min(selAnchor.ri, ri), r2 = Math.max(selAnchor.ri, ri);
    const c1 = Math.min(selAnchor.ci, ci), c2 = Math.max(selAnchor.ci, ci);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) newSel[`${r}_${c}`] = true;
    setSel(newSel);
    selSnap.current = newSel;
  };

  const onCellDblClick = (ri: number, ci: number) => {
    if (readOnly) return;
    setEditingCell({ ri, ci });
  };

  useEffect(() => {
    const up = () => { dragging.current = false; };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, []);

  // Clear selection on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        // Don't clear if clicking toolbar
        const toolbar = wrapRef.current.previousElementSibling;
        if (toolbar && toolbar.contains(e.target as Node)) return;
        setSel({});
        setSelectedRows(new Set());
        setSelectedCols(new Set());
      }
      // Close color panels when clicking outside them
      const target = e.target as HTMLElement;
      if (!target.closest('.pt-clr-wrap')) {
        setFgPanelOpen(false);
        setBgPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Clipboard ──────────────────────────────────────────────────────────────
  const copyToClipboard = useCallback(async (cut = false) => {
    let selKeys = Object.keys(sel);
    if (!selKeys.length) selKeys = Object.keys(selSnap.current);
    if (!selKeys.length) return;
    const sheet = sheets[activeSheet];
    const coords = selKeys.map((k) => k.split('_').map(Number));
    const minR = Math.min(...coords.map((c) => c[0]));
    const maxR = Math.max(...coords.map((c) => c[0]));
    const minC = Math.min(...coords.map((c) => c[1]));
    const maxC = Math.max(...coords.map((c) => c[1]));

    const lines: string[] = [];
    const htmlRows: string[] = [];
    for (let r = minR; r <= maxR; r++) {
      const row: string[] = [];
      const htmlCells: string[] = [];
      for (let c = minC; c <= maxC; c++) {
        const col = sheet.columns_data[c];
        const cell = col ? getCell(sheet.rows_data[r]?.cells[col.id]) : { v: '' };
        row.push(cell.v);
        const escaped = cell.v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        htmlCells.push(`<td style="padding:4px 8px;border:1px solid #ccc">${escaped}</td>`);
      }
      lines.push(row.join('\t'));
      htmlRows.push(`<tr>${htmlCells.join('')}</tr>`);
    }
    const htmlTable = `<table style="border-collapse:collapse"><tbody>${htmlRows.join('')}</tbody></table>`;
    const plainText = lines.join('\n');
    // Write both plain text (tab-separated, works in Excel) and HTML (rich table)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlTable], { type: 'text/html' }),
        })
      ]);
    } catch {
      navigator.clipboard.writeText(plainText).catch(() => {});
    }

    if (cut) {
      updateSheet((s) => {
        const rows = [...s.rows_data];
        coords.forEach(([ri, ci]) => {
          const col = s.columns_data[ci];
          if (!col || !rows[ri]) return;
          const row = { ...rows[ri], cells: { ...rows[ri].cells } };
          row.cells[col.id] = { v: '' };
          rows[ri] = row;
        });
        return { ...s, rows_data: rows };
      });
    }
  }, [sel, sheets, activeSheet, updateSheet]);

  const pasteFromClipboard = useCallback(async () => {
    if (!selAnchor) return;
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').filter((l, i, arr) => i < arr.length - 1 || l.trim() !== '').map((l) => l.split('\t'));
      updateSheet((s) => {
        let rows = [...s.rows_data];
        // Expand rows if paste overflows
        const neededRows = selAnchor.ri + lines.length;
        while (rows.length < neededRows) {
          const cells: Record<string, { v: string }> = {};
          s.columns_data.forEach((c) => { cells[c.id] = { v: '' }; });
          rows.push({ id: `r_${Date.now()}_${rows.length}`, cells });
        }
        lines.forEach((line, dr) => {
          const ri = selAnchor.ri + dr;
          line.forEach((val, dc) => {
            const ci = selAnchor.ci + dc;
            const col = s.columns_data[ci];
            if (!col) return;
            const row = { ...rows[ri], cells: { ...rows[ri].cells } };
            row.cells[col.id] = { ...getCell(row.cells[col.id]), v: val };
            rows[ri] = row;
          });
        });
        return { ...s, rows_data: rows };
      });
    } catch { /* clipboard denied */ }
  }, [selAnchor, updateSheet]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only when table has focus or cells are selected
      const inTable = wrapRef.current?.contains(document.activeElement) || document.activeElement === wrapRef.current;
      const hasSel = Object.keys(sel).length > 0;
      if (!inTable && !hasSel) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // When a cell is in text-edit mode, let the browser handle all native shortcuts
      // (Ctrl+A selects cell text, Ctrl+C/X/V work on cell text, arrows move caret, etc.)
      if (editingCell) {
        // Only intercept Escape — everything else is native
        if (e.key === 'Escape') { setEditingCell(null); return; }
        return;
      }

      if (ctrl && e.key === 'b') { e.preventDefault(); applyFormat('b'); return; }
      if (ctrl && e.key === 'i' && !e.shiftKey) { e.preventDefault(); applyFormat('i'); return; }
      if (ctrl && e.key === 'u') { e.preventDefault(); applyFormat('u'); return; }
      if (ctrl && e.key === 'a') { e.preventDefault(); selectAll(); return; }
      if (ctrl && e.key === 'c') { copyToClipboard(); return; }
      if (ctrl && e.key === 'x') { copyToClipboard(true); return; }
      if (ctrl && e.key === 'v') { pasteFromClipboard(); return; }
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

      // Arrow key navigation
      if (selAnchor && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const sheet = sheets[activeSheet];
        let { ri, ci } = selAnchor;
        if (e.key === 'ArrowUp') ri = Math.max(0, ri - 1);
        if (e.key === 'ArrowDown') ri = Math.min(sheet.rows_data.length - 1, ri + 1);
        if (e.key === 'ArrowLeft') ci = Math.max(0, ci - 1);
        if (e.key === 'ArrowRight') ci = Math.min(sheet.columns_data.length - 1, ci + 1);
        const newSel = { [`${ri}_${ci}`]: true };
        setSel(newSel); selSnap.current = newSel;
        setSelAnchor({ ri, ci });
        return;
      }

      // Tab = move right/left
      if (e.key === 'Tab' && selAnchor && !editingCell) {
        e.preventDefault();
        const sheet = sheets[activeSheet];
        let { ri, ci } = selAnchor;
        if (e.shiftKey) ci = Math.max(0, ci - 1);
        else ci = Math.min(sheet.columns_data.length - 1, ci + 1);
        const newSel = { [`${ri}_${ci}`]: true };
        setSel(newSel); selSnap.current = newSel;
        setSelAnchor({ ri, ci });
        return;
      }

      // Enter = start editing
      if (e.key === 'Enter' && selAnchor && !editingCell) {
        if (readOnly) return;
        e.preventDefault();
        setEditingCell(selAnchor);
        return;
      }

      // Escape = clear selection (editingCell case already handled above)
      if (e.key === 'Escape') {
        setSel({}); setSelectedRows(new Set()); setSelectedCols(new Set());
        return;
      }

      // Delete/Backspace = clear selected cells
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingCell && hasSel && !readOnly) {
        e.preventDefault();
        updateSheet((s) => {
          const rows = [...s.rows_data];
          Object.keys(sel).forEach((key) => {
            const [riStr, ciStr] = key.split('_');
            const ri = parseInt(riStr), ci = parseInt(ciStr);
            const col = s.columns_data[ci];
            if (!col || !rows[ri]) return;
            const row = { ...rows[ri], cells: { ...rows[ri].cells } };
            row.cells[col.id] = { v: '' };
            rows[ri] = row;
          });
          return { ...s, rows_data: rows };
        });
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sel, selAnchor, editingCell, sheets, activeSheet, applyFormat, selectAll, copyToClipboard, pasteFromClipboard, updateSheet, undo, redo]);

  // ── Sheet management ───────────────────────────────────────────────────────
  const commitAddSheet = () => {
    const name = newSheetName.trim() || `Sheet ${sheets.length + 1}`;
    const newSheet = createDefaultSheet(planId, name, sheets.length);
    setSheets((prev) => [...prev, newSheet]);
    setActiveSheet(sheets.length);
    saveSheet(newSheet, [...sheets, newSheet]);
    setAddingSheet(false);
    setNewSheetName('');
  };

  const delSheet = (idx: number) => {
    if (sheets.length <= 1) return;
    setDeleteSheetConfirm(idx);
  };

  const doDeleteSheet = async (idx: number) => {
    const sheet = sheets[idx];
    if (sheet.id) { try { await supabase.from('upsc_plan_tables').delete().eq('id', sheet.id); } catch {} }
    setSheets((prev) => prev.filter((_, i) => i !== idx));
    if (activeSheet >= sheets.length - 1) setActiveSheet(Math.max(0, sheets.length - 2));
    setDeleteSheetConfirm(null);
  };

  const renameSheet = (idx: number) => {
    setRenamingSheet(idx);
    setRenameSheetVal(sheets[idx].sheet_name);
  };

  const commitRenameSheet = (idx: number) => {
    const name = renameSheetVal.trim();
    if (name) {
      setSheets((prev) => { const next = [...prev]; next[idx] = { ...next[idx], sheet_name: name }; return next; });
      debounceSave(idx);
    }
    setRenamingSheet(null);
  };

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)));
  const zoomReset = () => setZoom(1.0);

  // ── Computed display rows (sort + filter) ──────────────────────────────────
  const sheet = sheets[activeSheet];
  const displayRows = useMemo(() => {
    if (!sheet) return [];
    let rows = sheet.rows_data.map((r, i) => ({ ...r, _origIdx: i }));

    // Filter
    if (filterRow) {
      Object.entries(filters).forEach(([colId, fVal]) => {
        if (!fVal) return;
        const lower = fVal.toLowerCase();
        rows = rows.filter((r) => {
          const cell = getCell(r.cells[colId]);
          return cell.v.toLowerCase().includes(lower);
        });
      });
    }

    // Sort
    if (sortCol) {
      rows.sort((a, b) => {
        const va = getCell(a.cells[sortCol]).v.toLowerCase();
        const vb = getCell(b.cells[sortCol]).v.toLowerCase();
        const cmp = va.localeCompare(vb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [sheet, sortCol, sortDir, filterRow, filters]);

  const isStatusCol = (col: ColDef) => col.id === 'c_status' || /self.?status|^status$/i.test(col.name);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="pt-loading">Loading…</div>;
  if (!sheet) return <div className="pt-loading">No sheet data</div>;

  const containerClass = `pt-container${fullscreen ? ' pt-fullscreen' : ''}`;

  const tableContent = (
    <div className={containerClass}>
      {/* Toolbar — identical in both normal and fullscreen mode */}
      <div className="pt-toolbar2">
        <div className="pt-tb2-group">
          <button className="pt-fmt-btn" title="Bold (Ctrl+B)" onClick={() => applyFormat('b')}><b>B</b></button>
          <button className="pt-fmt-btn" title="Italic (Ctrl+I)" onClick={() => applyFormat('i')}><i>I</i></button>
          <button className="pt-fmt-btn" title="Underline (Ctrl+U)" onClick={() => applyFormat('u')}><u>U</u></button>
          <button className="pt-fmt-btn" title="Strikethrough" onClick={() => applyFormat('sk')}><s>S</s></button>
        </div>
        <span className="pt-tb2-sep" />
        <select
          className="pt-font-size"
          title="Font size"
          defaultValue="0"
          onChange={(e) => { if (e.target.value !== '0') { applyFormat('sz', e.target.value); e.target.value = '0'; } }}
        >
          <option value="0">Size</option>
          {[10,11,12,13,14,16,18,20,24,28,32].map((s) => <option key={s} value={String(s)}>{s}</option>)}
        </select>
        <span className="pt-tb2-sep" />
        <div className="pt-tb2-group">
          <button className="pt-fmt-btn" title="Align Left" onClick={() => applyFormat('al', 'l')}>⇤</button>
          <button className="pt-fmt-btn" title="Center" onClick={() => applyFormat('al', 'c')}>≡</button>
          <button className="pt-fmt-btn" title="Align Right" onClick={() => applyFormat('al', 'r')}>⇥</button>
        </div>
        <span className="pt-tb2-sep" />
        <div className="pt-tb2-group">
          <div className="pt-clr-wrap" style={{ position: 'relative' }}>
            <button
              className="pt-clr-btn"
              title="Text color"
              onMouseDown={(e) => { e.preventDefault(); setFgPanelOpen((v) => !v); setBgPanelOpen(false); }}
            >
              <span className="pt-clr-label-fg">A</span>
            </button>
            {fgPanelOpen && (
              <div className="pt-clr-panel" onMouseDown={(e) => e.preventDefault()}>
                {['#000000','#374151','#6b7280','#d1d5db','#ffffff','#ef4444','#f97316','#f59e0b','#84cc16','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#e11d48'].map((c) => (
                  <button key={c} className="pt-clr-swatch" style={{ background: c }} title={c}
                    onMouseDown={(e) => { e.preventDefault(); applyFormat('fg', c); setFgPanelOpen(false); }} />
                ))}
              </div>
            )}
          </div>
          <div className="pt-clr-wrap" style={{ position: 'relative' }}>
            <button
              className="pt-clr-btn"
              title="Fill color"
              onMouseDown={(e) => { e.preventDefault(); setBgPanelOpen((v) => !v); setFgPanelOpen(false); }}
            >
              <span className="pt-clr-label-bg">▣</span>
            </button>
            {bgPanelOpen && (
              <div className="pt-clr-panel" onMouseDown={(e) => e.preventDefault()}>
                {['transparent','#fef9c3','#fef08a','#fde68a','#fca5a5','#bbf7d0','#bfdbfe','#ddd6fe','#f5d0fe','#fed7aa','#e2e8f0','#1e293b','#000000','#ffffff','#7c3aed','#059669'].map((c) => (
                  <button key={c} className={`pt-clr-swatch${c === 'transparent' ? ' pt-clr-swatch-clear' : ''}`} style={{ background: c === 'transparent' ? undefined : c }} title={c === 'transparent' ? 'No fill' : c}
                    onMouseDown={(e) => { e.preventDefault(); applyFormat('bg', c === 'transparent' ? '' : c); setBgPanelOpen(false); }} />
                ))}
              </div>
            )}
          </div>
          <button className="pt-fmt-btn" title="Clear color" onMouseDown={(e) => { e.preventDefault(); applyFormat('fg', ''); applyFormat('bg', ''); }}>A⊘</button>
        </div>
        <span className="pt-tb2-sep" />
        <div className="pt-tb2-group">
          <button className="pt-fmt-btn" title="Insert Row Below" onClick={() => { const ri = selAnchor?.ri ?? sheet.rows_data.length - 1; insertRowAt(ri); }}>+Row</button>
          <button className="pt-fmt-btn" title="Delete selected row(s)" onClick={delSelectedRows}>−Row</button>
          <button className="pt-fmt-btn" title="Add Column" onClick={addCol}>+Col</button>
          <button className="pt-fmt-btn" title="Delete selected column(s)" onClick={delSelectedCols}>−Col</button>
        </div>
        <span className="pt-tb2-sep" />
        <div className="pt-tb2-group">
          <button className="pt-fmt-btn" title="Toggle Filter Row" onClick={() => setFilterRow((f) => !f)} style={filterRow ? { background: 'var(--accent1)', color: '#fff' } : undefined}>⊟ Filter</button>
          <button className="pt-fmt-btn" title="Copy (Ctrl+C)" onClick={() => copyToClipboard()}>⎘ Copy</button>
          <button className="pt-fmt-btn" title="Paste (Ctrl+V)" onClick={() => pasteFromClipboard()}>⎙ Paste</button>
        </div>
        <span className="pt-tb2-sep" />
        <div className="pt-tb2-group">
          <button className="pt-fmt-btn" title="Zoom Out" onClick={zoomOut}>−</button>
          <span className="pt-zoom-label" onClick={zoomReset} title="Click to reset zoom">{Math.round(zoom * 100)}%</span>
          <button className="pt-fmt-btn" title="Zoom In" onClick={zoomIn}>+</button>
        </div>
        <span className="pt-tb2-sep" />
        <div className="pt-tb2-group">
          <button className="pt-fmt-btn" title={fullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'} onClick={() => setFullscreen((f) => !f)}>{fullscreen ? '⊗ Exit' : '⛶ FS'}</button>
          <button className="pt-fmt-btn" title="Save Now" onClick={() => saveSheet(sheet, sheets)}>💾</button>
        </div>
        <span className="pt-save-status" data-status={saveStatus}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : ''}
        </span>
      </div>

      {/* Table wrapper */}
      <div className="pt-table-wrapper" ref={wrapRef} tabIndex={0} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', outline: 'none' }}>
        <table className="pt-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="pt-th-num" style={{ width: 32 }} onClick={selectAll} title="Select all">#</th>
              {sheet.columns_data.map((col, ci) => (
                <th key={col.id} className={`pt-th${selectedCols.has(ci) ? ' pt-selected' : ''}`} style={{ minWidth: col.width }}>
                  {renamingCol === col.id ? (
                    <input
                      className="pt-col-rename-input"
                      value={renameColVal}
                      autoFocus
                      onChange={(e) => setRenameColVal(e.target.value)}
                      onBlur={commitRenameCol}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRenameCol(); if (e.key === 'Escape') setRenamingCol(null); }}
                    />
                  ) : (
                    <>
                      <span className="pt-col-name" onClick={() => selectCol(ci)} title="Click to select column">{col.name}</span>
                      <span className="pt-col-sort" onClick={() => toggleSort(col.id)} title="Sort">{sortCol === col.id ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                      <button className="pt-edit-col" onClick={() => renameCol(col.id)} title="Rename column (click)">✎</button>
                      <button className="pt-del-col" onClick={() => delCol(col.id)} title="Delete column">×</button>
                    </>
                  )}
                </th>
              ))}
              <th className="pt-th-add" onClick={addCol} title="Add column">+</th>
            </tr>
            {filterRow && (
              <tr className="pt-filter-row">
                <td className="pt-td-num" />
                {sheet.columns_data.map((col) => (
                  <td key={col.id} className="pt-fi-cell">
                    <input className="pt-fi" placeholder="Filter…" value={filters[col.id] || ''}
                      onChange={(e) => setFilters((f) => ({ ...f, [col.id]: e.target.value }))} />
                  </td>
                ))}
                <td><button className="pt-fi-clear" onClick={() => setFilters({})} title="Clear filters">⊘</button></td>
              </tr>
            )}
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const ri = row._origIdx;
              return (
                <tr key={row.id} className={selectedRows.has(ri) ? 'pt-row-selected' : ''}>
                  <td className="pt-td-num" onClick={() => selectRow(ri)} title="Click to select row">
                    <span className="pt-row-num">{ri + 1}</span>
                  </td>
                  {sheet.columns_data.map((col, ci) => {
                    const cellData = getCell(row.cells[col.id]);
                    if (cellData.mg) return null;
                    const isSelected = !!sel[`${ri}_${ci}`];
                    const isEditing = editingCell?.ri === ri && editingCell?.ci === ci;

                    if (isStatusCol(col)) {
                      const isCustomInput = customStatusCell?.ri === ri && customStatusCell?.colId === col.id;
                      return (
                        <td key={col.id} className={`pt-td${isSelected ? ' pt-selected' : ''}`}
                          data-ri={ri} data-ci={ci}
                          onMouseDown={(e) => onCellMouseDown(ri, ci, e)}
                          onMouseEnter={() => onCellMouseEnter(ri, ci)}
                          style={getCellStyle(cellData)}>
                          {isCustomInput ? (
                            <input autoFocus className="pt-custom-status-input"
                              value={customStatusVal} placeholder="Custom status…"
                              onChange={(e) => setCustomStatusVal(e.target.value)}
                              onBlur={commitCustomStatus}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitCustomStatus(); if (e.key === 'Escape') setCustomStatusCell(null); }} />
                          ) : (
                            <select className={`pt-status-sel pt-status-${statusClass(cellData.v)}`}
                              value={STATUS_OPTIONS.includes(cellData.v) ? cellData.v : '__custom_display__'}
                              onChange={(e) => onStatusChange(ri, col.id, e.target.value)}>
                              <option value="">— Status —</option>
                              <option value="○ Pending">○ Pending</option>
                              <option value="⟳ In Progress">⟳ In Progress</option>
                              <option value="✓ Done">✓ Done</option>
                              {!STATUS_OPTIONS.includes(cellData.v) && cellData.v && (
                                <option value="__custom_display__">{cellData.v}</option>
                              )}
                              <option value="__custom__">✎ Custom…</option>
                            </select>
                          )}
                        </td>
                      );
                    }

                    // ── Date range picker cell ──────────────────────────────
                    if (isDateCol(col) && !readOnly) {
                      return (
                        <td key={col.id}
                          className={`pt-td pt-date-td${isSelected ? ' pt-selected' : ''}`}
                          data-ri={ri} data-ci={ci}
                          onMouseDown={(e) => onCellMouseDown(ri, ci, e)}
                          onMouseEnter={() => onCellMouseEnter(ri, ci)}
                          style={getCellStyle(cellData)}
                          onClick={(e) => {
                            const { start, end } = parseDR(cellData.v);
                            setDatePicker({
                              ri, ci, colId: col.id, startISO: start, endISO: end,
                              anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                            });
                          }}>
                          {cellData.v
                            ? <span className="pt-date-val">{cellData.v}</span>
                            : <span className="pt-date-ph">📅 date…</span>}
                        </td>
                      );
                    }

                    return (
                      <td key={col.id} className={`pt-td${isSelected ? ' pt-selected' : ''}`}
                        data-ri={ri} data-ci={ci}
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        style={getCellStyle(cellData)}
                        onMouseDown={(e) => onCellMouseDown(ri, ci, e)}
                        onMouseEnter={() => onCellMouseEnter(ri, ci)}
                        onDoubleClick={() => onCellDblClick(ri, ci)}
                        onBlur={(e) => { if (isEditing) onCellBlur(ri, col.id, e.currentTarget); }}
                        onKeyDown={(e) => {
                          if (!isEditing) return;
                          const ctrl = e.ctrlKey || e.metaKey;
                          // For all Ctrl combos, stop propagation so the global handler
                          // doesn't interfere — the browser handles them natively in contentEditable
                          if (ctrl) { e.stopPropagation(); return; }
                          if (e.key === 'Escape') { setEditingCell(null); e.currentTarget.blur(); wrapRef.current?.focus({ preventScroll: true }); }
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); const nri = Math.min(sheet.rows_data.length - 1, ri + 1); setEditingCell(null); setSel({ [`${nri}_${ci}`]: true }); setSelAnchor({ ri: nri, ci }); wrapRef.current?.focus({ preventScroll: true }); }
                          if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.blur(); const nc = e.shiftKey ? Math.max(0, ci - 1) : Math.min(sheet.columns_data.length - 1, ci + 1); setEditingCell({ ri, ci: nc }); setSel({ [`${ri}_${nc}`]: true }); setSelAnchor({ ri, ci: nc }); }
                        }}
                        ref={(el) => {
                          if (el && isEditing && document.activeElement !== el) {
                            el.textContent = cellData.v;
                            el.focus();
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            range.collapse(false);
                            const s = window.getSelection();
                            s?.removeAllRanges();
                            s?.addRange(range);
                          }
                        }}>
                        {!isEditing ? cellData.v : undefined}
                      </td>
                    );
                  })}
                  <td className="pt-td-del">
                    <button className="pt-row-del-btn" onClick={() => delRow(ri)} title="Delete row">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="pt-add-row-btn" onClick={addRow}>+ Add Row</button>
        {deleteRowsConfirm && (
          <div className="pt-inline-confirm">
            <span>Delete {selectedRows.size} selected row(s)?</span>
            <button className="pt-ic-del" onClick={doDeleteRows}>Delete</button>
            <button className="pt-ic-cancel" onClick={() => setDeleteRowsConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Sheet tabs */}
      <div className="pt-sheet-bar">
        {deleteSheetConfirm !== null && (
          <div className="pt-inline-confirm pt-sheet-confirm">
            <span>Delete sheet "{sheets[deleteSheetConfirm]?.sheet_name}"?</span>
            <button className="pt-ic-del" onClick={() => doDeleteSheet(deleteSheetConfirm)}>Delete</button>
            <button className="pt-ic-cancel" onClick={() => setDeleteSheetConfirm(null)}>Cancel</button>
          </div>
        )}
        {sheets.map((s, i) => (
          <button key={i}
            className={`pt-sheet-tab${i === activeSheet ? ' active' : ''}`}
            onClick={() => setActiveSheet(i)}
            onDoubleClick={() => renameSheet(i)}>
            {renamingSheet === i ? (
              <input className="pt-sheet-rename-input" autoFocus value={renameSheetVal}
                onChange={(e) => setRenameSheetVal(e.target.value)}
                onBlur={() => commitRenameSheet(i)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRenameSheet(i); if (e.key === 'Escape') setRenamingSheet(null); }}
                onClick={(e) => e.stopPropagation()} />
            ) : (
              s.sheet_name
            )}
            {sheets.length > 1 && (
              <span className="pt-sheet-del" onClick={(e) => { e.stopPropagation(); delSheet(i); }}>×</span>
            )}
          </button>
        ))}
        {addingSheet ? (
          <input className="pt-sheet-add-input" autoFocus value={newSheetName}
            placeholder={`Sheet ${sheets.length + 1}`}
            onChange={(e) => setNewSheetName(e.target.value)}
            onBlur={commitAddSheet}
            onKeyDown={(e) => { if (e.key === 'Enter') commitAddSheet(); if (e.key === 'Escape') { setAddingSheet(false); setNewSheetName(''); } }} />
        ) : (
          <button className="pt-add-sheet" onClick={() => setAddingSheet(true)}>+ Sheet</button>
        )}
      </div>

      {/* Fullscreen close — fixed in top-right corner */}
      {fullscreen && (
        <button className="pt-fs-close" onClick={() => setFullscreen(false)}>✕ Close</button>
      )}
    </div>
  );

  // ── Date range picker portal ───────────────────────────────────────────────
  const datePickerPortal = datePicker && createPortal(
    (() => {
      const rect = datePicker.anchorRect;
      // Position below the cell, left-aligned, flip up if near bottom
      const spaceBelow = window.innerHeight - rect.bottom;
      const popH = 260; // approx popup height
      const top = spaceBelow > popH ? rect.bottom + 4 : rect.top - popH - 4;
      const left = Math.min(rect.left, window.innerWidth - 300);
      return (
        <div
          ref={datePickerRef}
          className="pt-date-picker-popup"
          style={{ position: 'fixed', top, left, zIndex: 9999 }}
        >
          <div className="pt-dp-header">📅 Date Range</div>
          <div className="pt-dp-body">
            <label className="pt-dp-label">Start date</label>
            <input
              type="date"
              className="pt-dp-input"
              value={datePicker.startISO}
              onChange={(e) => setDatePicker((p) => p ? { ...p, startISO: e.target.value } : p)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            />
            <label className="pt-dp-label" style={{ marginTop: '0.6rem' }}>End date <span className="pt-dp-opt">(optional)</span></label>
            <input
              type="date"
              className="pt-dp-input"
              value={datePicker.endISO}
              min={datePicker.startISO || undefined}
              onChange={(e) => setDatePicker((p) => p ? { ...p, endISO: e.target.value } : p)}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            />
            {datePicker.startISO && (
              <div className="pt-dp-preview">
                {formatDR(datePicker.startISO, datePicker.endISO)}
              </div>
            )}
          </div>
          <div className="pt-dp-footer">
            <button className="pt-dp-clear" onClick={() => {
              updateSheet((s) => {
                const rows = [...s.rows_data];
                const row = { ...rows[datePicker.ri], cells: { ...rows[datePicker.ri].cells } };
                row.cells[datePicker.colId] = { v: '' };
                rows[datePicker.ri] = row;
                return { ...s, rows_data: rows };
              });
              setDatePicker(null);
            }}>Clear</button>
            <button className="pt-dp-cancel" onClick={() => setDatePicker(null)}>Cancel</button>
            <button className="pt-dp-apply" onClick={commitDatePicker}>Apply</button>
          </div>
        </div>
      );
    })(),
    document.body
  );

  return fullscreen
    ? createPortal(<>{tableContent}{datePickerPortal}</>, document.body)
    : <>{tableContent}{datePickerPortal}</>;
}
