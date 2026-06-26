// ─────────────────────────────────────────────────────────────────────────────
// useMetrics — MetricsService port from js/metrics.js
// Batches analytics events and flushes every 10 s or on page unload.
// All calls are fire-and-forget; errors are silently dropped (metrics are non-critical).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface MetricEvent {
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  session_id: string;
}

const FLUSH_INTERVAL = 10_000; // 10 s — matches old app
const MAX_BATCH      = 50;     // max rows per insert — matches old app

// Module-level session ID (stable for the browser tab lifetime, matches old app)
const SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

export function useMetrics() {
  const { user } = useAuth();
  const queueRef    = useRef<MetricEvent[]>([]);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageStartRef = useRef(Date.now());

  // ── Flush batch to Supabase ──────────────────────────────────────────
  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!queueRef.current.length || !user) return;
    const batch = queueRef.current.splice(0, MAX_BATCH);
    try {
      const { error } = await supabase.from('upsc_app_metrics').insert(batch);
      if (error) {
        // RLS or auth error — drop batch to stop retry flood (matches old app behavior)
        console.warn('[Metrics] flush err:', error.message);
      }
    } catch {
      // Network error — silently drop, metrics are non-critical
    }
    // Schedule next flush if queue still has items
    if (queueRef.current.length) {
      timerRef.current = setTimeout(flush, FLUSH_INTERVAL);
    }
  }, [user]);

  // ── Track a single event ─────────────────────────────────────────────
  const track = useCallback((eventType: string, data: Record<string, unknown> = {}) => {
    if (!user) return;
    queueRef.current.push({
      user_id:    user.id,
      event_type: eventType,
      event_data: data,
      session_id: SESSION_ID,
    });
    if (!timerRef.current) {
      timerRef.current = setTimeout(flush, FLUSH_INTERVAL);
    }
  }, [user, flush]);

  // ── Global error capture (unhandled errors + promise rejections) ────
  useEffect(() => {
    if (!user) return;
    const onError = (e: ErrorEvent) => {
      track('js_error', {
        message: e.message?.substring(0, 200),
        source:  e.filename?.replace(window.location.origin, '').substring(0, 100),
        line:    e.lineno,
      });
    };
    const onUnhandled = (e: PromiseRejectionEvent) => {
      track('js_error', {
        message: String(e.reason)?.substring(0, 200),
        source:  'unhandledrejection',
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [user, track]);

  // ── Auto-track page load + session end ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    // Track page load after a short delay (auth must settle first, matches old app 2s delay)
    const loadTimer = setTimeout(() => {
      track('page_load', { url: window.location.pathname, ua: navigator.userAgent.substring(0, 80) });
    }, 2000);

    // Track session duration on unload
    const handleUnload = () => {
      const dur = Math.round((Date.now() - pageStartRef.current) / 1000);
      if (dur > 3) {
        queueRef.current.push({
          user_id: user.id, event_type: 'session_end',
          event_data: { duration_seconds: dur }, session_id: SESSION_ID,
        });
      }
      // Attempt synchronous flush on unload (best-effort, matches old app)
      flush();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearTimeout(loadTimer);
      window.removeEventListener('beforeunload', handleUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, track, flush]);

  // ── Convenience wrappers (match old js/metrics.js exactly) ──────────
  return {
    track,
    trackTabSwitch:   (tab: string)         => track('tab_switch',   { tab }),
    trackTopicCheck:  (id: string, v: boolean) => track('topic_check', { id, checked: v }),
    trackPlanCreate:  (cat: string)          => track('plan_create',  { category: cat }),
    trackPlanEdit:    ()                     => track('plan_edit',    {}),
    trackFocusStart:  ()                     => track('focus_start',  {}),
    trackFocusEnd:    (secs: number)         => track('focus_end',    { duration_seconds: secs }),
    trackTableEdit:   (planId: string)       => track('table_edit',   { plan_id: planId }),
    trackPYQView:     (topic: string)        => track('pyq_view',     { topic }),
    trackCAView:      (month: string)        => track('ca_view',      { month }),
    trackSearch:      (query: string)        => track('search',       { query }),
    trackMsgSent:     ()                     => track('message_sent', {}),
    trackFeedbackSent: ()                    => track('feedback_sent', {}),
    sessionId:        SESSION_ID,
  };
}
