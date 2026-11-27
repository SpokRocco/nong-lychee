-- =====================================================================
--  supabase/nong-lychee/checks.sql — ตรวจการแยกฐานข้อมูล (อ่านอย่างเดียว รันกี่ครั้งก็ได้)
--  ผลที่ถูกต้องอธิบายไว้ในคอมเมนต์ของแต่ละข้อ
-- =====================================================================

-- 1) ออบเจกต์ทั้งหมดของน้องลิ้นจี่ต้องอยู่ใน nong_lychee (คาดหวัง: knowledge, chat_analytics, admins, executive_top_topics)
select table_schema, table_name, table_type
from information_schema.tables
where table_schema = 'nong_lychee'
order by table_name;

-- 2) anon ต้องไม่มีสิทธิ์ใน schema นี้ (คาดหวัง: false ทั้งคู่)
select has_schema_privilege('anon', 'nong_lychee', 'usage')   as anon_can_use_schema,
       has_table_privilege ('anon', 'nong_lychee.chat_analytics', 'select') as anon_can_read_analytics;

-- 3) authenticated อ่านได้เฉพาะสถิติ (คาดหวัง: true, false, false)
select has_table_privilege('authenticated', 'nong_lychee.chat_analytics', 'select') as authed_can_select_analytics,
       has_table_privilege('authenticated', 'nong_lychee.knowledge',      'select') as authed_can_select_knowledge,
       has_table_privilege('authenticated', 'nong_lychee.admins',         'select') as authed_can_select_admins;

-- 4) RLS ต้องเปิดทุกตาราง (คาดหวัง: rowsecurity = true ทั้ง 3 แถว)
select tablename, rowsecurity
from pg_tables
where schemaname = 'nong_lychee'
order by tablename;

-- 5) ต้องไม่มีตารางชื่อเดียวกันของน้องลิ้นจี่หลุดไปอยู่ใน public (คาดหวัง: ไม่มีแถว)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('school_knowledge', 'chat_analytics', 'executive_top_topics', 'knowledge');

-- 6) มีผู้ดูแลกี่คน (คาดหวัง: ≥ 1 หลังเพิ่มผู้ดูแลแล้ว)
select count(*) as admin_count from nong_lychee.admins;
