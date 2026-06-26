import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ENV } from '../lib/env';

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  confirmationSent: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: (force?: boolean) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────
function resolveEmail(input: string): string {
  return input.toLowerCase() === ENV.SUPERUSER_ALIAS ? ENV.SUPERUSER_EMAIL : input;
}

function isSuperuser(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower === ENV.SUPERUSER_EMAIL || lower === ENV.SUPERUSER_ALIAS;
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    confirmationSent: false,
  });

  const lastActivityRef = useRef(Date.now());
  const sessionStartRef = useRef<number | null>(null);

  // ── Record session in DB ───────────────────────────────────────────────────
  const recordSession = useCallback(async (userId: string, email: string) => {
    try {
      await supabase.from('upsc_user_sessions').upsert(
        {
          user_id: userId,
          email,
          is_superuser: isSuperuser(email),
          login_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    } catch {
      /* non-critical */
    }
  }, []);

  // ── Lock / admin check ─────────────────────────────────────────────────────
  const checkLock = useCallback(
    async (userId: string): Promise<{ locked: boolean; reason?: string; isAdmin?: boolean }> => {
      try {
        const { data } = await supabase
          .from('upsc_user_profiles')
          .select('is_locked,locked_reason,is_admin')
          .eq('user_id', userId)
          .maybeSingle();
        if (data?.is_locked) return { locked: true, reason: data.locked_reason };
        if (data?.is_admin) return { locked: false, isAdmin: true };
      } catch {
        /* proceed */
      }
      return { locked: false };
    },
    [],
  );

  // ── handleAuthUser — shared post-auth flow ─────────────────────────────────
  const handleAuthUser = useCallback(
    async (user: User) => {
      if (!isSuperuser(user.email)) {
        const lock = await checkLock(user.id);
        if (lock.locked) {
          await supabase.auth.signOut();
          setState((s) => ({
            ...s,
            user: null,
            session: null,
            loading: false,
            error: '🔒 Account locked' + (lock.reason ? ': ' + lock.reason : '. Contact admin.'),
          }));
          return;
        }
        if (lock.isAdmin) {
          window.location.href = 'admin.html';
          return;
        }
      }
      await recordSession(user.id, user.email || '');
      sessionStartRef.current = Date.now();
    },
    [checkLock, recordSession],
  );

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, error: null, loading: true, confirmationSent: false }));
      try {
        const resolved = resolveEmail(email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: resolved,
          password,
        });
        if (error) throw error;
        await handleAuthUser(data.user);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Authentication failed.';
        setState((s) => ({ ...s, error: msg, loading: false }));
      }
    },
    [handleAuthUser],
  );

  // ── Sign up ────────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, error: null, loading: true, confirmationSent: false }));
      try {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const resolved = resolveEmail(email);
        const { data, error } = await supabase.auth.signUp({ email: resolved, password });
        if (error) throw error;

        if (data.user && data.session) {
          await handleAuthUser(data.user);
        } else {
          setState((s) => ({ ...s, loading: false, confirmationSent: true }));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Signup failed.';
        setState((s) => ({ ...s, error: msg, loading: false }));
      }
    },
    [handleAuthUser],
  );

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/' },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
      setState((s) => ({ ...s, error: msg }));
    }
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async (_force = false) => {
    // Confirmation is handled by the calling UI layer
    // Stop focus mode before logout (matching old app behavior)
    window.dispatchEvent(new Event('upsc-logout'));
    sessionStartRef.current = null;
    // Clear activity + focus timestamps so next login starts fresh
    try {
      localStorage.removeItem('upsc_last_activity_ts');
      localStorage.removeItem('upsc_focus_active');
    } catch { /* ignore */ }
    await supabase.auth.signOut();
  }, []);

  // ── Clear error ────────────────────────────────────────────────────────────
  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null, confirmationSent: false }));
  }, []);

  // ── Auth state listener (THE key fix — keeps JWT fresh automatically) ──────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handleAuthUser(session.user);
      }
      setState((s) => ({
        ...s,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
    });

    return () => subscription.unsubscribe();
  }, [handleAuthUser]);

  // ── Activity-based auto-logout ─────────────────────────────────────────────
  useEffect(() => {
    if (!state.user) return;

    // Superuser skips auto-logout entirely
    if (isSuperuser(state.user.email)) return;

    const LS_ACTIVITY_KEY = 'upsc_last_activity_ts';
    const LS_FOCUS_KEY    = 'upsc_focus_active';
    const TIMEOUT         = ENV.AUTO_LOGOUT_MS; // 15 min

    // ── 2. Activity listener ─────────────────────────────────────────────────
    const onActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      try { localStorage.setItem(LS_ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true, capture: true }));

    // ── 1. Stale-session check on mount (async to handle cross-device focus) ─
    (async () => {
      const storedTs = Number(localStorage.getItem(LS_ACTIVITY_KEY) ?? 0);
      const localFocusActive = !!localStorage.getItem(LS_FOCUS_KEY);
      if (storedTs > 0 && !localFocusActive && Date.now() - storedTs > TIMEOUT) {
        // Check DB: focus might be active on another device → don't logout if so
        let dbFocusActive = false;
        try {
          const { data } = await supabase
            .from('upsc_user_sessions')
            .select('focus_active')
            .eq('user_id', state.user!.id)
            .single();
          dbFocusActive = data?.focus_active ?? false;
        } catch { /* non-critical */ }
        if (!dbFocusActive) { signOut(true); return; }
      }
      // Seed lastActivityRef from localStorage so continuity survives page reloads
      lastActivityRef.current = storedTs > 0 ? storedTs : Date.now();
    })();

    // ── 3. Visibility-change: fires when user returns to tab / wakes device ──
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      // Check localStorage first (instant); if not set, ask DB (cross-device focus)
      if (localStorage.getItem(LS_FOCUS_KEY)) return;
      try {
        const { data } = await supabase
          .from('upsc_user_sessions')
          .select('focus_active')
          .eq('user_id', state.user!.id)
          .single();
        if (data?.focus_active) return; // focus active on another device — stay logged in
      } catch { /* non-critical, proceed to idle check */ }
      const idle = Date.now() - lastActivityRef.current;
      if (idle > TIMEOUT) { signOut(true); return; }
      try {
        const { data: { session: live } } = await supabase.auth.getSession();
        if (!live) signOut(true);
      } catch { /* proceed */ }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // ── 4. Periodic check every 2 min ────────────────────────────────────────
    const interval = setInterval(async () => {
      // Check localStorage first (same device, instant); fall back to DB (cross-device)
      let focusActive = !!localStorage.getItem(LS_FOCUS_KEY);
      if (!focusActive) {
        try {
          const { data } = await supabase
            .from('upsc_user_sessions')
            .select('focus_active')
            .eq('user_id', state.user!.id)
            .single();
          focusActive = data?.focus_active ?? false;
        } catch { /* non-critical */ }
      }

      if (focusActive) {
        // Focus mode is ON (this device or another) — keep heartbeat, never timeout
        const now = Date.now();
        lastActivityRef.current = now;
        try { localStorage.setItem(LS_ACTIVITY_KEY, String(now)); } catch { /* ignore */ }
      } else {
        const idle = Date.now() - lastActivityRef.current;
        if (idle > TIMEOUT) { signOut(true); return; }
      }
      // Update DB for admin dashboard visibility
      try {
        const now = new Date().toISOString();
        await supabase.from('upsc_user_sessions').upsert(
          { user_id: state.user!.id, email: state.user!.email, is_superuser: false, last_active: now },
          { onConflict: 'user_id' },
        );
        await supabase
          .from('upsc_user_profiles')
          .update({ last_active: now })
          .eq('user_id', state.user!.id);
      } catch { /* non-critical */ }
    }, ENV.SESSION_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((ev) =>
        document.removeEventListener(ev, onActivity, { capture: true } as EventListenerOptions),
      );
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [state.user, signOut]);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signInWithGoogle, signOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
