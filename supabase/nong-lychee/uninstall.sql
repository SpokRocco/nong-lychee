-- =====================================================================
--  supabase/nong-lychee/uninstall.sql
--  ถอนฐานข้อมูลน้องลิ้นจี่ออกจากโปรเจกต์ — ลบเฉพาะ schema nong_lychee (ข้อมูลความรู้/สถิติทั้งหมดของน้องลิ้นจี่จะหาย)
--  ไม่แตะ schema public ของเว็บโรงเรียน และไม่ลบส่วนเสริม vector (อาจมีส่วนอื่นใช้อยู่)
--  หลังรัน: เอา nong_lychee ออกจาก Exposed schemas ใน Project Settings > Data API
-- =====================================================================
drop schema if exists nong_lychee cascade;
