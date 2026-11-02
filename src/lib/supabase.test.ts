import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('supabase client guard', () => {
  beforeEach(() => vi.resetModules());

  it('does not throw and reports unconfigured when env vars are missing', async () => {
    vi.doMock('./env', () => ({ ENV: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }));
    const mod = await import('./supabase');
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeDefined();
  });

  it('reports configured when both vars are present', async () => {
    vi.doMock('./env', () => ({ ENV: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' } }));
    const mod = await import('./supabase');
    expect(mod.isSupabaseConfigured).toBe(true);
  });

  it('is unconfigured if only one var is present', async () => {
    vi.doMock('./env', () => ({ ENV: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: '' } }));
    const mod = await import('./supabase');
    expect(mod.isSupabaseConfigured).toBe(false);
  });
});
