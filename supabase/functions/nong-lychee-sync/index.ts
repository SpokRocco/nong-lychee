// POST /functions/v1/nong-lychee-sync   (เรียกจาก Google Apps Script)
// Header: x-sync-secret: <ค่าเดียวกับ secret NONG_LYCHEE_SYNC_SECRET>
// Body: { drive_file_id, file_name, category, content }  หรือ { drive_file_id, delete: true }
// ไฟล์ยาวจะถูกแบ่งเป็นชิ้น (chunk) เก็บเป็นแถวละชิ้น โดยใช้ drive_file_id = "<fileId>#<index>"
import { adminClient, corsHeaders, embedTexts, jsonResponse, secret } from '../_nong_lychee_shared/brain.ts';

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const brk = Math.max(clean.lastIndexOf('\n', end), clean.lastIndexOf(' ', end));
      if (brk > start + size * 0.6) end = brk;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  const expected = secret('SYNC_SECRET') ?? '';
  const provided = req.headers.get('x-sync-secret') ?? '';
  if (!expected || !safeEqual(expected, provided)) return jsonResponse({ error: 'unauthorized' }, 401);

  try {
    const body = await req.json();
    const fileId = String(body.drive_file_id ?? '').trim();
    if (!fileId || fileId.includes('#')) return jsonResponse({ error: 'invalid drive_file_id' }, 400);
    const db = adminClient();

    if (body.delete) {
      await db.from('knowledge').delete().like('drive_file_id', `${fileId}#%`);
      return jsonResponse({ ok: true, deleted: fileId });
    }

    const fileName = String(body.file_name ?? '').slice(0, 200) || 'ไม่ระบุชื่อ';
    const category = String(body.category ?? 'ทั่วไป').slice(0, 60);
    const chunks = chunkText(String(body.content ?? ''));
    if (chunks.length === 0) return jsonResponse({ error: 'empty content' }, 400);

    // ใส่ชื่อไฟล์/หมวดนำหน้า เพื่อให้การค้นหาเข้าใจบริบทมากขึ้น
    const vectors = await embedTexts(
      chunks.map((c) => `${category} - ${fileName}\n${c}`),
      'RETRIEVAL_DOCUMENT',
    );
    const rows = chunks.map((content, i) => ({
      drive_file_id: `${fileId}#${i}`,
      file_name: fileName,
      category,
      content,
      embedding: vectors[i] as unknown as string, // supabase-js ส่ง array เป็น JSON ให้ pgvector แปลงเอง
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from('knowledge').upsert(rows, { onConflict: 'drive_file_id' });
    if (error) throw error;

    // ลบชิ้นเก่าที่เกินมา (กรณีไฟล์สั้นลง)
    const { data: existing } = await db
      .from('knowledge')
      .select('drive_file_id')
      .like('drive_file_id', `${fileId}#%`);
    const keep = new Set(rows.map((r) => r.drive_file_id));
    const stale = (existing ?? []).map((r) => r.drive_file_id as string).filter((id) => !keep.has(id));
    if (stale.length) await db.from('knowledge').delete().in('drive_file_id', stale);

    return jsonResponse({ ok: true, chunks: rows.length });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'internal error' }, 500);
  }
});
