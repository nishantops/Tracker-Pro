import { memo } from 'react';
import {
  type Plan,
  PLAN_CAT_LABELS,
  PLAN_DIV_LABELS,
  PLAN_TYPE_LABELS,
  PLAN_CAT_COLORS,
  daysLeft,
} from '../../hooks/usePlans';

interface Props {
  plan: Plan;
  onOpen: (planId: string) => void;
  onDelete: (planId: string) => void;
}

export const PlanCard = memo(function PlanCard({ plan, onOpen, onDelete }: Props) {
  const catColor = PLAN_CAT_COLORS[plan.plan_category] ?? '#64748b';
  const catLabel = plan.plan_subject || PLAN_CAT_LABELS[plan.plan_category] || plan.plan_category;
  const divLabel = PLAN_DIV_LABELS[plan.plan_division] || plan.plan_division;
  const typeLabel = PLAN_TYPE_LABELS[plan.plan_type] || plan.plan_type;
  const dl = daysLeft(plan.end_date);

  const dateStr = [
    plan.start_date ? formatDate(plan.start_date) : null,
    plan.end_date ? formatDate(plan.end_date) : null,
  ]
    .filter(Boolean)
    .join(' → ');

  return (
    <div className="plan-card" onClick={() => onOpen(plan.plan_id)} role="button" tabIndex={0}>
      <div className="plan-card-stripe" style={{ background: `linear-gradient(90deg, ${catColor}99, ${catColor}22)` }} />
      <div className="plan-card-inner">
        <div className="plan-card-top">
          <span className="plan-card-title">{plan.plan_title}</span>
          <button
            className="plan-card-del"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete plan "${plan.plan_title}"?`)) onDelete(plan.plan_id);
            }}
            title="Delete plan"
          >
            ×
          </button>
        </div>

        <div className="plan-card-badges">
          <span className="plan-badge plan-type-badge">{typeLabel}</span>
          <span className="plan-badge plan-cat-badge" style={{ background: `${catColor}22`, color: catColor }}>
            {catLabel}
          </span>
          <span className="plan-badge plan-div-badge">{divLabel}</span>
          {!plan.notif_enabled && <span className="plan-badge plan-muted-badge">🔕</span>}
        </div>

        {dateStr && (
          <div className="plan-card-dates">
            📅 {dateStr}
            {dl && <span className={`plan-days ${dl.cls}`}>{dl.label}</span>}
          </div>
        )}
      </div>
    </div>
  );
});

function formatDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
