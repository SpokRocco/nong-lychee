-- =====================================================================
--  supabase/nong-lychee/schema.sql
--  ฐานข้อมูลของ "น้องลิ้นจี่ AI Mascot" — ใช้ร่วมโปรเจกต์ Supabase ของเว็บไซต์โรงเรียน
--  แต่แยกขาดด้วย Postgres schema ชื่อ  nong_lychee  (ไม่แตะ schema public ของเว็บโรงเรียนเลย)
--
--  หลักการแยก 100%
--   1) ทุกอย่างอยู่ใน schema nong_lychee เท่านั้น (ตาราง / view / function / index / policy)
--   2) ไม่สร้าง ไม่แก้ ไม่อ่าน ตารางใน public (เช่น admin_users, news, school_settings ของเว็บโรงเรียน)
--   3) บทบาท anon (ผู้เยี่ยมชมเว็บ) ไม่มีสิทธิ์ใดๆ ใน schema นี้ — ผู้เยี่ยมชมคุยผ่าน Edge Function
--      (nong-lychee-chat) เท่านั้น ซึ่งใช้ service_role เขียน/อ่านให้
--   4) ผู้ดูแลแดชบอร์ดกำหนดด้วยตาราง nong_lychee.admins ของเราเอง (ไม่ใช้ตารางผู้ใช้ของเว็บโรงเรียน)
--   5) ถอนการติดตั้งได้ด้วย uninstall.sql (drop schema nong_lychee) โดยไม่กระทบเว็บโรงเรียน
--
--  วิธีใช้ (รันซ้ำได้ปลอดภัย)
--   1) Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์นี้ > RUN
--   2) Project Settings > Data API > Exposed schemas > เพิ่ม  nong_lychee  (เพิ่มต่อท้าย ห้ามลบของเดิม) > Save
--   3) เพิ่มผู้ดูแลแดชบอร์ด (ดู "ขั้นตอนเพิ่มผู้ดูแล" ท้ายไฟล์)
--   4) ตรวจสอบด้วย  checks.sql
-- =====================================================================

-- 0. ส่วนเสริมสำหรับเวกเตอร์ (pgvector) — เพิ่มเข้าโปรเจกต์ได้อย่างเดียว ไม่กระทบตารางอื่น
--    ถ้าโปรเจกต์ติดตั้งไว้แล้วคำสั่งนี้จะไม่ทำอะไร
create extension if not exists vector with schema extensions;

-- 1. schema ของน้องลิ้นจี่
create schema if not exists nong_lychee;

-- 2. ความรู้ของโรงเรียนสำหรับน้องลิ้นจี่ (ซิงก์จาก Google Drive ผ่าน nong-lychee-sync)
create table if not exists nong_lychee.knowledge (
  id            uuid primary key default gen_random_uuid(),
  drive_file_id text unique,
  file_name     text not null,
  category      text not null default 'ทั่วไป',   -- เช่น วิชาการ, กิจกรรม, บุคลากร, รับสมัครนักเรียน
  content       text not null,
  embedding     extensions.vector(768),            -- Gemini embedding 768 มิติ
  updated_at    timestamptz not null default now()
);

create index if not exists knowledge_embedding_idx
  on nong_lychee.knowledge using hnsw (embedding extensions.vector_cosine_ops);

-- 3. ค้นหาความรู้ที่ใกล้เคียงคำถามที่สุด (Vector similarity search)
create or replace function nong_lychee.match_knowledge (
  query_embedding extensions.vector(768),
  match_threshold float default 0.5,
  match_count     int   default 5
)
returns table (
  id         uuid,
  file_name  text,
  category   text,
  content    text,
  similarity float
)
language sql stable
set search_path = nong_lychee, extensions, public
as $$
  select k.id, k.file_name, k.category, k.content,
         (1 - (k.embedding <=> query_embedding))::float as similarity
  from nong_lychee.knowledge k
  where 1 - (k.embedding <=> query_embedding) > match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

-- 4. บันทึกคำถามเพื่อวิเคราะห์ Top List ให้ผู้บริหาร
create table if not exists nong_lychee.chat_analytics (
  id           uuid primary key default gen_random_uuid(),
  channel      text not null default 'WEB'         check (channel in ('WEB', 'KIOSK_VOICE', 'LINE')),
  mode         text not null default 'SCHOOL_INFO' check (mode in ('SCHOOL_INFO', 'TUTOR')),
  user_role    text default 'ทั่วไป',
  question     text not null check (char_length(question) <= 600),
  topic_tag    text not null,
  ai_response  text,
  emotion_used text default 'HAPPY',
  created_at   timestamptz not null default now()
);

create index if not exists chat_analytics_created_at_idx on nong_lychee.chat_analytics (created_at desc);

-- 5. ผู้ดูแลแดชบอร์ดของน้องลิ้นจี่ (อ้างอิงผู้ใช้จาก Supabase Auth เท่านั้น ไม่ผูกกับตารางผู้ใช้ของเว็บโรงเรียน)
create table if not exists nong_lychee.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

-- ผู้เรียกเป็นผู้ดูแลหรือไม่ (security definer เพื่ออ่านตาราง admins ได้โดยไม่เปิดสิทธิ์ตารางให้ผู้ใช้)
create or replace function nong_lychee.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from nong_lychee.admins a where a.user_id = auth.uid());
$$;

-- 6. View Top 10 หัวข้อยอดฮิต (security_invoker = true → บังคับใช้ RLS ของผู้เรียก, ต้องใช้ Postgres 15+)
create or replace view nong_lychee.executive_top_topics
with (security_invoker = true) as
select
  topic_tag,
  mode,
  channel,
  count(*)        as total_questions,
  max(created_at) as last_asked_at
from nong_lychee.chat_analytics
group by topic_tag, mode, channel
order by total_questions desc
limit 10;

-- 7. Row Level Security
alter table nong_lychee.knowledge      enable row level security;
alter table nong_lychee.chat_analytics enable row level security;
alter table nong_lychee.admins         enable row level security;

-- knowledge / admins : ไม่มี policy สำหรับ anon/authenticated → เข้าถึงได้เฉพาะ service_role (Edge Function)
-- chat_analytics     : ผู้ใช้ที่ล็อกอินและอยู่ในตาราง admins เท่านั้นที่อ่านได้ (ไม่มี policy insert → เขียนผ่าน Edge Function เท่านั้น)
drop policy if exists "nong_lychee admins read analytics" on nong_lychee.chat_analytics;
create policy "nong_lychee admins read analytics" on nong_lychee.chat_analytics
  for select to authenticated
  using (nong_lychee.is_admin());

-- 8. สิทธิ์ (Grants) — ปิดทุกอย่างก่อน แล้วเปิดเท่าที่จำเป็น
revoke all on schema nong_lychee from public, anon, authenticated;
revoke all on all tables    in schema nong_lychee from public, anon, authenticated;
revoke all on all functions in schema nong_lychee from public, anon, authenticated;

grant usage on schema nong_lychee to authenticated, service_role;
grant all   on all tables    in schema nong_lychee to service_role;
grant all   on all functions in schema nong_lychee to service_role;

-- ผู้ดูแลที่ล็อกอิน: อ่านสถิติได้ (ถูกกรองด้วย RLS + is_admin()) และเรียก is_admin() เพื่อตรวจสิทธิ์
grant select  on nong_lychee.chat_analytics, nong_lychee.executive_top_topics to authenticated;
grant execute on function nong_lychee.is_admin() to authenticated;

-- ออบเจกต์ที่จะสร้างใน schema นี้ในอนาคต: ให้เฉพาะ service_role
alter default privileges in schema nong_lychee grant all on tables    to service_role;
alter default privileges in schema nong_lychee grant all on functions to service_role;

-- =====================================================================
--  ขั้นตอนเพิ่มผู้ดูแลแดชบอร์ด (รันแยกหลังสร้างผู้ใช้แล้ว)
--   1) Authentication > Users > Add user (อีเมล + รหัสผ่าน)
--      แนะนำปิด "Allow new users to sign up" เพื่อไม่ให้คนนอกสมัครบัญชีได้
--      (แม้สมัครได้ ก็ยังอ่านสถิติไม่ได้ เพราะไม่อยู่ใน nong_lychee.admins)
--   2) รัน (แก้อีเมลเป็นของผู้บริหาร):
--
--      insert into nong_lychee.admins (user_id, note)
--      select id, 'ผู้อำนวยการ' from auth.users where email = 'director@example.com'
--      on conflict (user_id) do nothing;
-- =====================================================================
