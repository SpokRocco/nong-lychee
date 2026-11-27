import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV } from './config';

/**
 * Postgres schema ของน้องลิ้นจี่ — แยกจากตารางของเว็บไซต์โรงเรียน (schema public) 100%
 * ติดตั้งด้วย supabase/nong-lychee/schema.sql และต้องเพิ่มชื่อนี้ใน Project Settings > Data API > Exposed schemas
 */
export const NONG_LYCHEE_SCHEMA = 'nong_lychee';

/** ชื่อ Edge Function ของน้องลิ้นจี่ (มี prefix กันชนกับ function อื่นในโปรเจกต์เดียวกัน) */
export const FN_CHAT = 'nong-lychee-chat';

export const isSupabaseConfigured = Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey);

export const supabase: SupabaseClient<any, typeof NONG_LYCHEE_SCHEMA, any> | null = isSupabaseConfigured
  ? createClient<any, typeof NONG_LYCHEE_SCHEMA, any>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      db: { schema: NONG_LYCHEE_SCHEMA },
      // เก็บ session แยกคีย์ ไม่ปนกับแอปอื่น (เช่น เว็บโรงเรียน) ที่อาจรันบนโดเมน/localhost เดียวกัน
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nong-lychee-auth' },
    })
  : null;
