import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

import { ENV } from '../lib/env';

// ── Module-level SWR cache ────────────────────────────────────────────────
const PLANS_CACHE_TTL = ENV.PLANS_CACHE_TTL_MS;
const _plansCache = new Map<string, { data: Plan[]; ts: number }>();

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
  // Computed progress (not stored in DB)
  taskTotal?: number;
  taskDone?: number;
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
  const loadPlans = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('upsc_custom_plans')
        .select('plan_id, plan_title, plan_type, start_date, end_date, plan_category, plan_division, notif_enabled, plan_subject, content_type')
        .eq('user_id', user.id);

      const planList = (data ?? []) as Plan[];

      // Fetch task progress for all plans in one query
      if (planList.length > 0) {
        const { data: progressData } = await supabase
          .from('upsc_tracker_progress')
          .select('id, is_checked')
          .eq('user_id', user.id)
          .like('id', 'plan_task_%');

        if (progressData) {
          for (const plan of planList) {
            const prefix = `plan_task_${plan.plan_id}_`;
            const planTasks = progressData.filter((r) => r.id.startsWith(prefix) && !r.id.includes('_sub_'));
            plan.taskTotal = planTasks.length;
            plan.taskDone = planTasks.filter((r) => r.is_checked).length;
          }
        }
      }

      // Sort plans by category order, then title
      planList.sort((a, b) => {
        const oA = PLAN_CAT_ORDER[a.plan_category] ?? 99;
        const oB = PLAN_CAT_ORDER[b.plan_category] ?? 99;
        if (oA !== oB) return oA - oB;
        return a.plan_title.localeCompare(b.plan_title);
      });

      _plansCache.set(user.id, { data: planList, ts: Date.now() });
      setPlans(planList);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cached = _plansCache.get(user.id);
    if (cached) {
      setPlans(cached.data);
      setLoading(false);
      // Revalidate silently if stale
      if (Date.now() - cached.ts > PLANS_CACHE_TTL) loadPlans(true);
      return;
    }
    loadPlans();
  }, [loadPlans, user]);

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
          const updated = idx >= 0 ? prev.map((p, i) => i === idx ? plan : p) : [plan, ...prev];
          _plansCache.set(user.id, { data: updated, ts: Date.now() });
          return updated;
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
      setPlans((prev) => {
        const updated = prev.filter((p) => p.plan_id !== planId);
        _plansCache.set(user.id, { data: updated, ts: Date.now() });
        return updated;
      });
    },
    [user],
  );

  return { plans, loading, savePlan, deletePlan, EMPTY_FORM, refresh: loadPlans };
}

// ── Label maps (ported from old plans.js) ────────────────────────────────────
export const PLAN_CAT_ORDER: Record<string, number> = {
  gs1: 1, gs2: 2, gs3: 3, gs4: 4, essay: 5, optional: 6, common: 7, custom: 8,
};

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
