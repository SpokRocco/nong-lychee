import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './config';

export const isSupabaseConfigured = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
