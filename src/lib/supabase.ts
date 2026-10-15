import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { createDemoClient } from '@/demo/client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Portfolio build: no backend, fictional data in the browser (see src/demo). */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const isSupabaseConfigured = isDemoMode || Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Supabase is not configured. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase: SupabaseClient<Database> = isDemoMode
  ? (createDemoClient() as unknown as SupabaseClient<Database>)
  : createClient<Database>(
      supabaseUrl ?? 'http://localhost:54321',
      supabaseAnonKey ?? 'anon-key-missing',
    );
