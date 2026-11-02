import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';

export const isSupabaseConfigured = !!(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);

// Placeholders keep the import from throwing so main.tsx can show a config message instead of a blank page.
export const supabase = createClient(
  ENV.SUPABASE_URL || 'https://not-configured.invalid',
  ENV.SUPABASE_ANON_KEY || 'not-configured',
);
