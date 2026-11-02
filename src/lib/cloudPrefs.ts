import { supabase } from './supabase';

export interface CloudPrefResult<T> { ok: boolean; found: boolean; value: T | null }

const TABLE = 'upsc_user_ui_prefs';
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Never throws: if the table does not exist yet (migration not run) the app keeps using localStorage.
export async function loadCloudPref<T>(userId: string, key: string): Promise<CloudPrefResult<T>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('user_id', userId)
      .eq('pref_key', key)
      .maybeSingle();
    if (error) return { ok: false, found: false, value: null };
    if (!data) return { ok: true, found: false, value: null };
    return { ok: true, found: true, value: (data.value as T) ?? null };
  } catch {
    return { ok: false, found: false, value: null };
  }
}

export function saveCloudPref(userId: string, key: string, value: unknown, delayMs = 600) {
  const id = `${userId}:${key}`;
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  timers.set(id, setTimeout(async () => {
    timers.delete(id);
    try {
      await supabase.from(TABLE).upsert(
        { user_id: userId, pref_key: key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,pref_key' },
      );
    } catch { /* non-critical */ }
  }, delayMs));
}
