import { useState, useCallback } from 'react';
import { usePlans, type PlanFormData } from '../../hooks/usePlans';
import { PlanCard } from './PlanCard';
import { PlanModal } from './PlanModal';

export function PlansGrid() {
  const { plans, loading, savePlan, deletePlan, EMPTY_FORM } = usePlans();
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<{ form: PlanFormData; id: string } | null>(null);

  const handleOpen = useCallback(
    (planId: string) => {
      const p = plans.find((x) => x.plan_id === planId);
      if (!p) return;
      setEditPlan({
        id: planId,
        form: {
          title: p.plan_title,
          type: p.plan_type,
          startDate: p.start_date ?? '',
          endDate: p.end_date ?? '',
          category: p.plan_category,
          division: p.plan_division,
          notifEnabled: p.notif_enabled,
          subject: p.plan_subject,
          contentType: p.content_type,
        },
      });
    },
    [plans],
  );

  const closeModal = () => {
    setModalOpen(false);
    setEditPlan(null);
  };

  if (loading) {
    return (
      <div className="welcome-card">
        <p>Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="plans-view">
      <button className="create-plan-btn" onClick={() => setModalOpen(true)}>
        + Create New Plan
      </button>

      {plans.length === 0 ? (
        <div className="welcome-card">
          <h2>No Plans Yet</h2>
          <p>Create your first study plan to start tracking weekly sprints, revision blocks, and custom schedules.</p>
        </div>
      ) : (
        <div className="plans-grid">
          {plans.map((p) => (
            <PlanCard key={p.plan_id} plan={p} onOpen={handleOpen} onDelete={deletePlan} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <PlanModal
        open={modalOpen}
        initial={EMPTY_FORM}
        onSave={savePlan}
        onClose={closeModal}
      />

      {/* Edit modal */}
      {editPlan && (
        <PlanModal
          open={true}
          initial={editPlan.form}
          editId={editPlan.id}
          onSave={savePlan}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
