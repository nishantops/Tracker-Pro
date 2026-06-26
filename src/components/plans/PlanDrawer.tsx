import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { PlanTable } from './PlanTable';
import type { Plan } from '../../hooks/usePlans';
import { useScrollLock } from '../../hooks/useScrollLock';
import { usePlans } from '../../hooks/usePlans';
import { MultiPageNotes, parseNotePages } from '../common/MultiPageNotes';
import type { NotesPage } from '../common/MultiPageNotes';

interface Props {
  plan: Plan | null;
  onClose: () => void;
  onPlanUpdated?: () => void;
}

type DrawerTab = 'tasks' | 'table' | 'note';

interface TaskRow {
  id: string;
  text: string;
  done: boolean;
  note: string;
  subTasks?: SubTaskRow[];
}

interface SubTaskRow {
  id: string;
  text: string;
  done: boolean;
}

const PLAN_CAT_LABELS: Record<string, string> = {
  common: 'Common', gs1: 'GS 1', gs2: 'GS 2', gs3: 'GS 3', gs4: 'GS 4',
  essay: 'Essay', optional: 'Optional', custom: 'Custom',
};
const PLAN_TYPE_LABELS: Record<string, string> = {
  weekly: 'Weekly Sprint', monthly: 'Monthly',
  custom_block: 'Custom Block', daily: 'Daily Target',
};
const PLAN_DIV_LABELS: Record<string, string> = {
  both: 'P + M', prelims: 'Prelims', mains: 'Mains',
};

export function PlanDrawer({ plan, onClose, onPlanUpdated }: Props) {
  useScrollLock(!!plan);
  const { user } = useAuth();
  const { savePlan } = usePlans();
  const [tab, setTab] = useState<DrawerTab>(plan?.content_type === 'tables' ? 'table' : 'tasks');
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [notePages, setNotePages] = useState<NotesPage[]>([{ id: 'p_default', title: 'Page 1', html: '' }]);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDivision, setEditDivision] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editContentType, setEditContentType] = useState<'tasks' | 'tables'>('tasks');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subInput, setSubInput] = useState('');
  // ── Drawer resize ──────────────────────────────────────────────────────────
  const [drawerWidth, setDrawerWidth] = useState(580);
  const resizingDrawer = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const onDrawerResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingDrawer.current = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = drawerWidth;
  }, [drawerWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingDrawer.current) return;
      const delta = resizeStartX.current - e.clientX; // drag left = wider
      const newW = Math.max(320, Math.min(window.innerWidth * 0.92, resizeStartW.current + delta));
      setDrawerWidth(newW);
    };
    const onUp = () => { resizingDrawer.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ESC closes drawer (unless sub-task input is open, which handles its own ESC)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !addingSubFor) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [addingSubFor, onClose]);

  // Load plan data from Supabase
  useEffect(() => {
    if (!plan || !user) return;
    const load = async () => {
      // Load tasks from upsc_tracker_progress with plan prefix
      const prefix = `plan_task_${plan.plan_id}_`;
      const { data: progressData } = await supabase
        .from('upsc_tracker_progress')
        .select('id, is_checked, topic_note')
        .eq('user_id', user.id)
        .like('id', `${prefix}%`);

      if (progressData && progressData.length > 0) {
        // Separate parent tasks and sub-tasks
        const parentRows = progressData.filter((r) => !r.id.includes('_sub_'));
        const subRows = progressData.filter((r) => r.id.includes('_sub_'));

        const loadedTasks = parentRows.map((r) => {
            const taskIdPart = r.id.replace(prefix, '');
            let text = taskIdPart;
            // Try base64 decode; strip auto_ prefix for legacy tasks
            const decodePart = taskIdPart.startsWith('auto_') ? '' : taskIdPart;
            if (decodePart) {
              try { text = decodeURIComponent(escape(atob(decodePart))); } catch { /* use raw if not base64 */ }
            } else {
              // Legacy auto_timestamp: show as "Task (legacy)" placeholder
              text = '(legacy task — use ⟳ Generate to refresh)';
            }

            // Find sub-tasks for this parent
            const mySubRows = subRows.filter((sr) => sr.id.includes(`_${taskIdPart}_sub_`));
            const subTasks: SubTaskRow[] = mySubRows.map((sr) => {
              const subPart = sr.id.split('_sub_')[1];
              let subText = subPart;
              try { subText = decodeURIComponent(escape(atob(subPart))); } catch { /* raw */ }
              return { id: sr.id, text: subText, done: sr.is_checked };
            });

            return {
              id: taskIdPart,
              text,
              done: r.is_checked,
              note: r.topic_note || '',
              subTasks,
            };
          });
        setTasks(loadedTasks);
      } else {
        setTasks([]);
      }

      // Load note
      const noteKey = `plan_card_${plan.plan_id}`;
      const { data: noteData } = await supabase
        .from('upsc_tracker_progress')
        .select('topic_note')
        .eq('user_id', user.id)
        .eq('id', noteKey)
        .single();
      if (noteData?.topic_note) setNotePages(parseNotePages(noteData.topic_note));
      else setNotePages([{ id: 'p_default', title: 'Page 1', html: '' }]);
    };
    load();
  }, [plan, user]);

  // Auto-generate tasks from date range
  const generateAutoTasks = useCallback(() => {
    if (!plan?.start_date || !plan?.end_date) return;
    const start = new Date(plan.start_date + 'T00:00:00');
    const end = new Date(plan.end_date + 'T00:00:00');
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    const newTasks: TaskRow[] = [];

    if (days > 60) {
      // Monthly breakdown
      const current = new Date(start);
      while (current <= end) {
        const monthName = current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        const label = `Month: ${monthName}`;
        const encoded = btoa(unescape(encodeURIComponent(label)));
        newTasks.push({ id: encoded, text: label, done: false, note: '' });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (days > 13) {
      // Weekly breakdown
      const current = new Date(start);
      let weekNum = 1;
      while (current <= end) {
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > end) weekEnd.setTime(end.getTime());
        const label = `Week ${weekNum}: ${current.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
        const encoded = btoa(unescape(encodeURIComponent(label)));
        newTasks.push({ id: encoded, text: label, done: false, note: '' });
        current.setDate(current.getDate() + 7);
        weekNum++;
      }
    } else {
      // Daily breakdown
      const current = new Date(start);
      while (current <= end) {
        const label = `Day: ${current.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;
        const encoded = btoa(unescape(encodeURIComponent(label)));
        newTasks.push({ id: encoded, text: label, done: false, note: '' });
        current.setDate(current.getDate() + 1);
      }
    }
    setTasks(newTasks);
    saveTasks(newTasks);
  }, [plan]);

  // Save tasks (compatible with old app format: text encoded in ID, note in topic_note)
  const saveTasks = async (taskList: TaskRow[]) => {
    if (!plan || !user) return;
    const prefix = `plan_task_${plan.plan_id}_`;
    const upserts = taskList.map((t) => ({
      id: `${prefix}${t.id}`,
      user_id: user.id,
      is_checked: t.done,
      topic_note: t.note || '',
      updated_at: new Date().toISOString(),
    }));
    if (upserts.length > 0) {
      await supabase.from('upsc_tracker_progress').upsert(upserts, { onConflict: 'id,user_id' });
    }
  };

  // Toggle task
  const toggleTask = (taskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => t.id === taskId ? { ...t, done: !t.done } : t);
      saveTasks(updated);
      return updated;
    });
  };

  // Add task (encode text in ID like old app: btoa(text))
  const addTask = () => {
    const text = prompt('Enter task description:');
    if (!text?.trim()) return;
    const encoded = btoa(unescape(encodeURIComponent(text.trim())));
    const newTask: TaskRow = { id: encoded, text: text.trim(), done: false, note: '' };
    setTasks((prev) => {
      const updated = [...prev, newTask];
      saveTasks(updated);
      return updated;
    });
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    if (!plan || !user) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const prefix = `plan_task_${plan.plan_id}_`;
    await supabase.from('upsc_tracker_progress').delete().eq('id', `${prefix}${taskId}`).eq('user_id', user.id);
    // Also delete all sub-tasks of this parent
    await supabase.from('upsc_tracker_progress').delete().like('id', `${prefix}${taskId}_sub_%`).eq('user_id', user.id);
  };

  // ── Sub-task CRUD ──────────────────────────────────────────────────────
  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const submitSubTask = async (parentId: string) => {
    if (!plan || !user || !subInput.trim()) return;
    const subText = subInput.trim();
    const subEncoded = btoa(unescape(encodeURIComponent(subText)));
    const subId = `plan_task_${plan.plan_id}_${parentId}_sub_${subEncoded}`;
    const newSub: SubTaskRow = { id: subId, text: subText, done: false };

    setTasks((prev) => prev.map((t) => t.id === parentId ? { ...t, subTasks: [...(t.subTasks || []), newSub] } : t));

    await supabase.from('upsc_tracker_progress').upsert({
      id: subId, user_id: user.id, is_checked: false, topic_note: '', updated_at: new Date().toISOString(),
    }, { onConflict: 'id,user_id' });

    setSubInput('');
    setAddingSubFor(null);
  };

  const toggleSubTask = async (parentId: string, subId: string) => {
    if (!user) return;
    setTasks((prev) => prev.map((t) => {
      if (t.id !== parentId) return t;
      const subs = (t.subTasks || []).map((s) => s.id === subId ? { ...s, done: !s.done } : s);
      return { ...t, subTasks: subs };
    }));
    // Get current state
    const task = tasks.find((t) => t.id === parentId);
    const sub = task?.subTasks?.find((s) => s.id === subId);
    if (sub) {
      await supabase.from('upsc_tracker_progress').update({
        is_checked: !sub.done, updated_at: new Date().toISOString(),
      }).eq('id', subId).eq('user_id', user.id);
    }
  };

  const deleteSubTask = async (parentId: string, subId: string) => {
    if (!user) return;
    setTasks((prev) => prev.map((t) => {
      if (t.id !== parentId) return t;
      return { ...t, subTasks: (t.subTasks || []).filter((s) => s.id !== subId) };
    }));
    await supabase.from('upsc_tracker_progress').delete().eq('id', subId).eq('user_id', user.id);
  };

  // Save note (debounced) — uses plan_card_ prefix matching old app
  const saveNote = (pages: NotesPage[]) => {
    setNotePages(pages);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      if (!plan || !user) return;
      const noteKey = `plan_card_${plan.plan_id}`;
      await supabase.from('upsc_tracker_progress').upsert({
        id: noteKey, user_id: user.id, is_checked: false, topic_note: JSON.stringify(pages), updated_at: new Date().toISOString(),
      }, { onConflict: 'id,user_id' });
    }, 1500);
  };

  if (!plan) return null;

  const startEdit = () => {
    setEditTitle(plan.plan_title);
    setEditStart(plan.start_date || '');
    setEditEnd(plan.end_date || '');
    setEditCategory(plan.plan_category);
    setEditDivision(plan.plan_division);
    setEditSubject(plan.plan_subject || '');
    setEditContentType((plan.content_type as 'tasks' | 'tables') || 'tasks');
    setEditing(true);
  };

  const saveEdit = async () => {
    await savePlan({
      title: editTitle,
      type: plan.plan_type,
      startDate: editStart,
      endDate: editEnd,
      category: editCategory,
      division: editDivision,
      notifEnabled: plan.notif_enabled ?? true,
      subject: editSubject,
      contentType: editContentType,
    }, plan.plan_id);
    setEditing(false);
    onPlanUpdated?.();
  };

  const catLabel = plan.plan_subject || PLAN_CAT_LABELS[plan.plan_category] || plan.plan_category;
  const dateStr = (plan.start_date || plan.end_date)
    ? `📅 ${plan.start_date ? new Date(plan.start_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '?'}${plan.end_date ? ' → ' + new Date(plan.end_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}`
    : '';

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <>
      {/* Overlay */}
      <div
        id="plan-drawer-overlay"
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[8000]"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        id="plan-drawer"
        className="fixed top-0 right-0 h-full z-[8500] flex flex-col"
        style={{ width: drawerWidth, background: 'var(--card)', borderLeft: '1px solid var(--bdr)', boxShadow: '-8px 0 40px rgba(0,0,0,0.4)', transform: 'translateX(0)', transition: resizingDrawer.current ? 'none' : 'transform 0.3s ease' }}
      >
        {/* Left resize handle */}
        <div
          onMouseDown={onDrawerResizeStart}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', zIndex: 10, background: 'transparent' }}
          title="Drag to resize"
        />
        {/* Header */}
        <div id="plan-drawer-header" style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--bdr)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ fontSize: '1rem', fontWeight: 700, background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.3rem 0.5rem', color: 'var(--t1)', width: '100%' }} />
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} style={{ fontSize: '0.72rem', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'var(--t2)' }} />
                  <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} style={{ fontSize: '0.72rem', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'var(--t2)' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ fontSize: '0.72rem', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'var(--t2)' }}>
                    {Object.entries(PLAN_CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={editDivision} onChange={(e) => setEditDivision(e.target.value)} style={{ fontSize: '0.72rem', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'var(--t2)' }}>
                    <option value="prelims">Prelims</option>
                    <option value="mains">Mains</option>
                    <option value="both">P + M</option>
                  </select>
                  <select value={editContentType} onChange={(e) => setEditContentType(e.target.value as 'tasks' | 'tables')} style={{ fontSize: '0.72rem', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.2rem 0.4rem', color: 'var(--t2)' }}>
                    <option value="tasks">✓ Tasks mode</option>
                    <option value="tables">⊞ Tables mode</option>
                  </select>
                </div>
                <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Subject label (e.g. GS 1 — Polity)" style={{ fontSize: '0.72rem', background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.25rem 0.5rem', color: 'var(--t2)', width: '100%' }} />
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={saveEdit} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', background: 'var(--bg2)', color: 'var(--t2)', border: '1px solid var(--bdr)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div id="plan-drawer-title" style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--t1)', fontFamily: 'var(--heading)' }}>{plan.plan_title}</div>
                  <button onClick={startEdit} title="Edit plan" style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: '0.85rem', cursor: 'pointer', padding: '0.15rem' }}>✎</button>
                </div>
                <div id="plan-drawer-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                  <span className="plan-badge plan-type-badge">{PLAN_TYPE_LABELS[plan.plan_type] || plan.plan_type}</span>
                  <span className={`plan-badge plan-cat-badge plan-cat-${plan.plan_category}`}>{catLabel}</span>
                  <span className="plan-badge plan-div-badge">{PLAN_DIV_LABELS[plan.plan_division] || plan.plan_division}</span>
                </div>
                {dateStr && <div id="plan-drawer-dates" style={{ fontSize: '0.68rem', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: '0.3rem' }}>{dateStr}</div>}
                {totalTasks > 0 && (
                  <div id="plan-drawer-pct" style={{ fontSize: '0.62rem', color: 'var(--accent-l)', fontFamily: 'var(--mono)', marginTop: '0.25rem', fontWeight: 700 }}>
                    {taskPct}% ({doneTasks}/{totalTasks})
                  </div>
                )}
              </>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}>✕</button>
        </div>

        {/* Tabs — always show all 3; content_type only affects default tab on open */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bdr)', padding: '0 1.25rem' }}>
          <button onClick={() => setTab('tasks')} className={`plan-drawer-tab ${tab === 'tasks' ? 'active' : ''}`}>✓ Tasks</button>
          <button onClick={() => setTab('table')} className={`plan-drawer-tab ${tab === 'table' ? 'active' : ''}`}>⊞ Tables</button>
          <button onClick={() => setTab('note')} className={`plan-drawer-tab ${tab === 'note' ? 'active' : ''}`}>✎ Note</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', background: 'var(--bg2)', scrollbarWidth: 'thin', scrollbarColor: 'var(--accent1) transparent' }}>
          {/* Tasks Tab */}
          {tab === 'tasks' && (
            <div>
              {/* Auto-setup banner */}
              {tasks.length === 0 && plan.start_date && plan.end_date && (
                <div className="plan-auto-setup">
                  <div className="plan-auto-setup-label">⚡ Quick Setup — {new Date(plan.start_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → {new Date(plan.end_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  <div className="plan-auto-desc">
                    {Math.ceil((new Date(plan.end_date + 'T00:00:00').getTime() - new Date(plan.start_date + 'T00:00:00').getTime()) / 86400000) + 1} days
                  </div>
                  <div className="plan-auto-setup-btns">
                    <button className="plan-auto-btn plan-auto-btn-primary" onClick={generateAutoTasks}>
                      📅 Generate Structure
                    </button>
                  </div>
                </div>
              )}

              {/* Task list */}
              <div className="space-y-2 mb-3">
                {tasks.map((task) => (
                  <div key={task.id}>
                    <div className="plan-trow" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1px solid var(--bdr)', background: task.done ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                        className="plan-task-checkbox"
                        style={{ width: '1rem', height: '1rem', accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, fontSize: '0.75rem', color: task.done ? 'var(--t3)' : 'var(--t1)', textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'var(--mono)' }}>
                        {task.text}
                      </span>
                      <button onClick={() => toggleExpand(task.id)} title="Sub-tasks" style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '0.7rem', transform: expandedTasks.has(task.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</button>
                      <button onClick={() => { setAddingSubFor(task.id); setExpandedTasks((s) => new Set(s).add(task.id)); }} title="Add sub-task" style={{ background: 'none', border: 'none', color: 'var(--accent1)', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}>+ Sub</button>
                      <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                    </div>
                    {/* Sub-tasks */}
                    {expandedTasks.has(task.id) && (
                      <div style={{ marginLeft: '1.5rem', marginTop: '0.25rem', borderLeft: '2px solid var(--bdr)', paddingLeft: '0.5rem' }}>
                        {(task.subTasks || []).map((sub) => (
                          <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.3rem', fontSize: '0.7rem' }}>
                            <input type="checkbox" checked={sub.done} onChange={() => toggleSubTask(task.id, sub.id)} style={{ width: '0.85rem', height: '0.85rem', accentColor: '#6366f1', cursor: 'pointer' }} />
                            <span style={{ flex: 1, color: sub.done ? 'var(--t3)' : 'var(--t2)', textDecoration: sub.done ? 'line-through' : 'none', fontFamily: 'var(--mono)' }}>{sub.text}</span>
                            <button onClick={() => deleteSubTask(task.id, sub.id)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                          </div>
                        ))}
                        {/* Inline add sub-task */}
                        {addingSubFor === task.id && (
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.25rem' }}>
                            <input
                              type="text"
                              value={subInput}
                              onChange={(e) => setSubInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') submitSubTask(task.id); if (e.key === 'Escape') { setAddingSubFor(null); setSubInput(''); } }}
                              placeholder="Sub-task…"
                              autoFocus
                              style={{ flex: 1, background: 'var(--inp)', border: '1px solid var(--bdr)', borderRadius: '4px', padding: '0.25rem 0.4rem', fontSize: '0.68rem', color: 'var(--t1)', fontFamily: 'var(--mono)' }}
                            />
                            <button onClick={() => submitSubTask(task.id)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                            <button onClick={() => { setAddingSubFor(null); setSubInput(''); }} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addTask} className="ptask-add-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(99,102,241,0.1)', border: '1px dashed rgba(99,102,241,0.3)', color: 'var(--accent)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--mono)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Row
              </button>
            </div>
          )}

          {/* Table Tab */}
          {tab === 'table' && (
            <PlanTable planId={plan.plan_id} />
          )}

          {/* Note Tab */}
          {tab === 'note' && (
            <div style={{ padding: '0.5rem 0' }}>
              <MultiPageNotes
                pages={notePages}
                onChange={saveNote}
                placeholder="Master strategy / goals for this plan\u2026"
                minHeight="240px"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
