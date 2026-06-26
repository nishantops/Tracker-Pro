import { useState, useRef, memo } from 'react';
import type { Plan } from '../../hooks/usePlans';
import { useToast } from '../common/Toast';

interface Props {
  plan: Plan;
  onOpen: (planId: string) => void;
  onDelete: (planId: string) => void;
  pinned?: boolean;
  onPin?: (planId: string) => void;
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

export const PlanCard = memo(function PlanCard({ plan, onOpen, onDelete, pinned, onPin }: Props) {
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dragRef = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });

  const catLabel = plan.plan_subject || PLAN_CAT_LABELS[plan.plan_category] || plan.plan_category;
  const catClass = `plan-cat-${plan.plan_category}`;

  let dateStr = '';
  let daysLabel = '';
  let daysCls = '';
  if (plan.start_date || plan.end_date) {
    const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    dateStr = (plan.start_date ? fmt(plan.start_date) : '?') + (plan.end_date ? ' → ' + fmt(plan.end_date) : '');
  }
  if (plan.end_date) {
    const diff = Math.ceil((new Date(plan.end_date + 'T00:00:00').getTime() - Date.now()) / 86400000);
    daysLabel = diff > 0 ? `${diff}d left` : diff === 0 ? 'Due today' : `${Math.abs(diff)}d over`;
    daysCls = diff < 0 ? 'pcard-days-over' : diff <= 7 ? 'pcard-days-warn' : 'pcard-days-ok';
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  return (
    <div
      className={`plan-card${pinned ? ' plan-card-pinned' : ''}`}
      onMouseDown={(e) => { mousePos.current = { x: e.clientX, y: e.clientY }; dragRef.current = false; }}
      onMouseMove={(e) => {
        if (!dragRef.current) {
          const dx = e.clientX - mousePos.current.x;
          const dy = e.clientY - mousePos.current.y;
          if (dx * dx + dy * dy > 25) dragRef.current = true;
        }
      }}
      onClick={() => { if (!dragRef.current) onOpen(plan.plan_id); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(plan.plan_id); }}
    >
      {/* Drag handle — grab here to move the card */}
      <div className="pcard-handle" title="Drag to move" onClick={(e) => e.stopPropagation()}>
        <span className="pcard-handle-dots">⠿</span>
      </div>
      {onPin && (
        <button
          className={`pcard-pin-btn${pinned ? ' pcard-pin-active' : ''}`}
          title={pinned ? 'Unpin card' : 'Pin card (freeze position)'}
          onClick={(e) => { e.stopPropagation(); onPin(plan.plan_id); }}
        >📌</button>
      )}
      <div className="plan-card-stripe" style={{ background: `linear-gradient(90deg, var(--accent1), transparent)` }} />
      <div className="plan-card-inner">
        <div className="plan-card-top">
          <span className="plan-card-title">{plan.plan_title}</span>
          <button className="plan-card-del" onClick={handleDelete} title="Delete plan">×</button>
        </div>
        <div className="plan-card-badges">
          <span className="plan-badge plan-type-badge">{PLAN_TYPE_LABELS[plan.plan_type] || plan.plan_type}</span>
          <span className={`plan-badge plan-cat-badge ${catClass}`}>{catLabel}</span>
          <span className="plan-badge plan-div-badge">{PLAN_DIV_LABELS[plan.plan_division] || plan.plan_division}</span>
          {!plan.notif_enabled && <span className="plan-badge plan-muted-badge">🔕</span>}
        </div>
        {dateStr && (
          <div className="plan-card-dates">
            📅 <span>{dateStr}</span>
            {daysLabel && <span className={`pcard-days ${daysCls}`}>{daysLabel}</span>}
          </div>
        )}
        <div className="plan-card-footer">
          <div className="plan-card-pbar">
            <div className="plan-card-pbar-fill" style={{ width: `${plan.taskTotal && plan.taskTotal > 0 ? Math.round((plan.taskDone! / plan.taskTotal) * 100) : 0}%` }} />
          </div>
          <span className="plan-card-pct">{plan.taskTotal && plan.taskTotal > 0 ? Math.round((plan.taskDone! / plan.taskTotal) * 100) : 0}%</span>
        </div>        {confirmDelete && (
          <div className="pcard-confirm-del" onClick={(e) => e.stopPropagation()}>
            <span>Delete "{plan.plan_title}"?</span>
            <button className="pcard-cd-yes" onClick={(e) => { e.stopPropagation(); onDelete(plan.plan_id); showToast('Plan deleted', 'success'); }}>Delete</button>
            <button className="pcard-cd-no" onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}>Cancel</button>
          </div>
        )}      </div>
    </div>
  );
});
