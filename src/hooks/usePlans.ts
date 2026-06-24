import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Plan {
  plan_id: string;          // btoa(title)
  plan_title: string;
  plan_type: string;        // weekly | monthly | custom_block | daily
  start_date: string | null;
  end_date: string | null;
  plan_category: string;    // common | gs1-4 | essay | optional | custom
  plan_division: string;    // both | prelims | mains
  notif_enabled: boolean;
  plan_subject: string;
  content_type: string;     // both | tasks | tables
}

export interface PlanFormData {
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  category: string;
  division: string;
  notifEnabled: boolean;
  subject: string;
  contentType: string;
}

const EMPTY_FORM: PlanFormData = {
  title: '',
  type: 'weekly',
  startDate: '',
  endDate: '',
  category: 'common',
  division: 'both',
  notifEnabled: true,
  subject: '',
  contentType: 'both',
};

export function usePlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load plans ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('upsc_custom_plans')
          .select('*')
          .eq('user_id', user.id);
        setPlans(data ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Create / Update ────────────────────────────────────────────────────
  const savePlan = useCallback(
    async (form: PlanFormData, existingId?: string) => {
      if (!user) return;
      const planId = existingId ?? btoa(unescape(encodeURIComponent(form.title)));

      const row = {
        plan_id: planId,
        user_id: user.id,
        plan_title: form.title,
        plan_type: form.type,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        plan_category: form.category,
        plan_division: form.division,
        notif_enabled: form.notifEnabled,
        plan_subject: form.subject || null,
        content_type: form.contentType,
      };

      const { error } = await supabase
        .from('upsc_custom_plans')
        .upsert(row, { onConflict: 'plan_id,user_id' });

      if (!error) {
        setPlans((prev) => {
          const idx = prev.findIndex((p) => p.plan_id === planId);
          const plan: Plan = {
            plan_id: planId,
            plan_title: form.title,
            plan_type: form.type,
            start_date: form.startDate || null,
            end_date: form.endDate || null,
            plan_category: form.category,
            plan_division: form.division,
            notif_enabled: form.notifEnabled,
            plan_subject: form.subject,
            content_type: form.contentType,
          };
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = plan;
            return copy;
          }
          return [plan, ...prev];
        });
      }
    },
    [user],
  );

  // ── Delete ─────────────────────────────────────────────────────────────
  const deletePlan = useCallback(
    async (planId: string) => {
      if (!user) return;
      await supabase.from('upsc_custom_plans').delete().eq('plan_id', planId).eq('user_id', user.id);
      setPlans((prev) => prev.filter((p) => p.plan_id !== planId));
    },
    [user],
  );

  return { plans, loading, savePlan, deletePlan, EMPTY_FORM };
}

// ── Label maps (ported from old plans.js) ────────────────────────────────────
export const PLAN_CAT_LABELS: Record<string, string> = {
  common: 'Common', gs1: 'GS 1', gs2: 'GS 2', gs3: 'GS 3', gs4: 'GS 4',
  essay: 'Essay', optional: 'Optional', custom: 'Custom',
};

export const PLAN_DIV_LABELS: Record<string, string> = {
  both: 'Prelims + Mains', prelims: 'Prelims Only', mains: 'Mains Only',
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  weekly: 'Weekly Sprint', monthly: 'Monthly', custom_block: 'Custom Block', daily: 'Daily Target',
};

export const PLAN_CAT_COLORS: Record<string, string> = {
  common: '#6366f1', gs1: '#f59e0b', gs2: '#f43f5e', gs3: '#a855f7',
  gs4: '#06b6d4', essay: '#14b8a6', optional: '#d946ef', custom: '#64748b',
};

export function daysLeft(endDate: string | null): { label: string; cls: string } | null {
  if (!endDate) return null;
  const diff = Math.ceil((new Date(endDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
  if (diff > 0) return { label: `${diff}d left`, cls: diff <= 7 ? 'days-warn' : 'days-ok' };
  if (diff === 0) return { label: 'Due today', cls: 'days-warn' };
  return { label: `${Math.abs(diff)}d over`, cls: 'days-over' };
}
