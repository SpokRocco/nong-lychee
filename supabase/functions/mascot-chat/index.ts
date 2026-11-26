// POST /functions/v1/mascot-chat
//  - { action: 'chat', question, mode, role, channel, history }  -> ผู้ใช้ทั่วไป (anon key)
//  - { action: 'summary', days }                                 -> ต้องแนบ JWT ของผู้ใช้ที่ล็อกอินแล้วเท่านั้น
import {
  adminClient,
  corsHeaders,
  jsonResponse,
  logAnalytics,
  summarize,
  think,
  type BrainInput,
  type Channel,
  type Mode,
} from '../_shared/brain.ts';

const MODES: Mode[] = ['SCHOOL_INFO', 'TUTOR'];
const CHANNELS: Channel[] = ['WEB', 'KIOSK_VOICE']; // LINE ใช้ line-webhook เท่านั้น
const ROLES = ['ทั่วไป', 'นักเรียน', 'ผู้ปกครอง', 'ผู้มาเยือน'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const body = await req.json();
    const db = adminClient();

    if (body.action === 'summary') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const { data, error } = await db.auth.getUser(token);
      // anon key ไม่ใช่ JWT ของผู้ใช้ -> getUser จะล้มเหลว จึงใช้ได้เฉพาะผู้ล็อกอินจริง
      if (error || !data.user) return jsonResponse({ error: 'unauthorized' }, 401);
      const days = Math.min(Math.max(Number(body.days) || 7, 1), 90);
      return jsonResponse({ summary: await summarize(db, days) });
    }

    const question = String(body.question ?? '').trim();
    if (!question) return jsonResponse({ error: 'question required' }, 400);
    if (question.length > 600) return jsonResponse({ error: 'question too long' }, 400);

    const input: BrainInput = {
      question,
      mode: MODES.includes(body.mode) ? body.mode : 'SCHOOL_INFO',
      role: ROLES.includes(body.role) ? body.role : 'ทั่วไป',
      channel: CHANNELS.includes(body.channel) ? body.channel : 'WEB',
      history: Array.isArray(body.history)
        ? body.history
            .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
            .slice(-6)
        : [],
    };
    const out = await think(input, db);
    await logAnalytics(db, input, out);
    return jsonResponse(out);
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'internal error' }, 500);
  }
});
