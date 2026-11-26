-- =====================================================================
--  SUPABASE_SETUP.sql  |  น้องลิ้นจี่ AI Mascot - โรงเรียนบ้านหาดเค็ด
--
--  วิธีใช้:
--   1) เปิด Supabase Dashboard > เลือกโปรเจกต์ > SQL Editor > New query
--   2) คัดลอกทั้งไฟล์นี้ไปวาง แล้วกด RUN (รันซ้ำได้ ปลอดภัย: ใช้ if not exists / drop policy if exists)
--   3) สร้างผู้ใช้ผู้บริหาร/แอดมินที่ Authentication > Users > Add user (อีเมล+รหัสผ่าน)
--      เพื่อใช้ล็อกอินหน้า Dashboard (#/dashboard)
--   4) Deploy Edge Functions ตามขั้นตอนใน README.md
--
--  หมายเหตุ: เวกเตอร์ 768 มิติ รองรับทั้ง text-embedding-004 (เดิม) และ
--  gemini-embedding-001 ที่กำหนด outputDimensionality=768 (ค่าเริ่มต้นของโปรเจกต์นี้)
-- =====================================================================

-- 1. เปิดใช้งาน pgvector สำหรับเก็บความรู้จาก Google Drive (RAG)
create extension if not exists vector;

-- 2. ตารางเก็บข้อมูลความรู้ของโรงเรียนบ้านหาดเค็ด (ซิงก์จาก Google Drive)
create table if not exists school_knowledge (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique,
  file_name text not null,
  category text default 'ทั่วไป', -- เช่น วิชาการ, กิจกรรม, บุคลากร, รับสมัครนักเรียน
  content text not null,
  embedding vector(768), -- รองรับ Gemini text-embedding-004 (768 dimensions)
  updated_at timestamp with time zone default now()
);

create index if not exists school_knowledge_embedding_idx
  on school_knowledge using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. ฟังก์ชันค้นหาข้อมูลโรงเรียนที่ตรงกับคำถามที่สุด (Vector Similarity Search)
create or replace function match_school_knowledge (
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  file_name text,
  category text,
  content text,
  similarity float
)
language sql stable
as $$ select school_knowledge.id, school_knowledge.file_name, school_knowledge.category, school_knowledge.content, 1 - (school_knowledge.embedding <=> query_embedding) as similarity from school_knowledge where 1 - (school_knowledge.embedding <=> query_embedding) > match_threshold order by similarity desc limit match_count; $$;

-- 4. ตารางบันทึกประวัติคำถามและวิเคราะห์ Top List สำหรับผู้บริหารและแอดมิน
create table if not exists chat_analytics (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'WEB', -- 'WEB', 'KIOSK_VOICE', 'LINE'
  mode text not null default 'SCHOOL_INFO', -- 'SCHOOL_INFO' หรือ 'TUTOR'
  user_role text default 'ทั่วไป', -- 'นักเรียน', 'ผู้ปกครอง', 'ผู้มาเยือน'
  question text not null,
  topic_tag text not null, -- หมวดหมู่ที่ AI จัดกลุ่มให้ เช่น 'รับสมัครเรียน', 'เงินอุดหนุน', 'ตารางเรียน', 'ติววิทยาการคำนวณ'
  ai_response text,
  emotion_used text default 'HAPPY',
  created_at timestamp with time zone default now()
);

-- 5. View สรุป Top 10 คำถาม/หัวข้อยอดฮิตสำหรับ Dashboard ผู้บริหาร
--    security_invoker = true : ให้ view บังคับใช้ RLS ของผู้เรียกดู (ไม่เช่นนั้น view จะรันด้วยสิทธิ์เจ้าของ
--    และเปิดให้ anon key อ่านสถิติได้โดยข้าม RLS) - ต้องใช้ Postgres 15+ (Supabase ค่าเริ่มต้นรองรับ)
create or replace view executive_top_topics
with (security_invoker = true) as
select
  topic_tag,
  mode,
  channel,
  count(*) as total_questions,
  max(created_at) as last_asked_at
from chat_analytics
group by topic_tag, mode, channel
order by total_questions desc
limit 10;

-- 6. เปิดใช้งาน Row Level Security (RLS)
alter table school_knowledge enable row level security;
alter table chat_analytics enable row level security;

drop policy if exists "Allow public read knowledge" on school_knowledge;
create policy "Allow public read knowledge" on school_knowledge
  for select using (true);

drop policy if exists "Allow service role manage knowledge" on school_knowledge;
create policy "Allow service role manage knowledge" on school_knowledge
  for all using (auth.role() = 'service_role');

drop policy if exists "Allow public insert analytics" on chat_analytics;
create policy "Allow public insert analytics" on chat_analytics
  for insert with check (true);

drop policy if exists "Allow authenticated read analytics" on chat_analytics;
create policy "Allow authenticated read analytics" on chat_analytics
  for select using (auth.role() = 'authenticated');
