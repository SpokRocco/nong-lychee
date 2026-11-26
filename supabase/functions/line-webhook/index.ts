// POST /functions/v1/line-webhook   (ตั้งเป็น Webhook URL ใน LINE Developers Console)
// Deploy ด้วย:  supabase functions deploy line-webhook --no-verify-jwt
// ตรวจลายเซ็น x-line-signature (HMAC-SHA256 ด้วย Channel secret) ก่อนประมวลผลทุกครั้ง
import { adminClient, logAnalytics, think, type Emotion, type Mode } from '../_shared/brain.ts';

const SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
const TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';

async function verifySignature(raw: string, signature: string): Promise<boolean> {
  if (!SECRET || !signature) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(raw));
}

const EMOTION_STYLE: Record<Emotion, { label: string; color: string }> = {
  HAPPY: { label: 'น้องลิ้นจี่ ยิ้มแย้ม', color: '#c8213f' },
  EXCITED: { label: 'น้องลิ้นจี่ ตื่นเต้น!', color: '#e93a55' },
  THINKING: { label: 'น้องลิ้นจี่ ลองคิดดูนะ', color: '#8a1636' },
  SAD: { label: 'น้องลิ้นจี่ ขออภัยนะคะ', color: '#6b7280' },
  SURPRISED: { label: 'น้องลิ้นจี่ ว้าว!', color: '#d97706' },
  WAVE: { label: 'น้องลิ้นจี่ สวัสดีค่ะ', color: '#c8213f' },
};

function flexAnswer(answer: string, emotion: Emotion, tag: string, mode: Mode) {
  const st = EMOTION_STYLE[emotion];
  return {
    type: 'flex',
    altText: answer.slice(0, 380),
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: st.color,
        paddingAll: '14px',
        contents: [
          { type: 'text', text: st.label, color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: mode === 'TUTOR' ? 'โหมดติวเตอร์' : 'ข้อมูลโรงเรียนบ้านหาดเค็ด', color: '#ffe0e3', size: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: answer.slice(0, 1800), wrap: true, size: 'sm', color: '#222222' },
          { type: 'text', text: `#${tag}`, size: 'xs', color: '#237a45' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          { type: 'button', style: 'secondary', height: 'sm', action: { type: 'message', label: 'ข้อมูลโรงเรียน', text: 'โหมดข้อมูลโรงเรียน' } },
          { type: 'button', style: 'primary', color: '#237a45', height: 'sm', action: { type: 'message', label: 'ติวเตอร์', text: 'โหมดติวเตอร์' } },
        ],
      },
    },
  };
}

async function reply(replyToken: string, messages: unknown[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) console.error('LINE reply failed', res.status, await res.text());
}

// จำโหมดของผู้ใช้แต่ละคนชั่วคราวในหน่วยความจำ (instance รีสตาร์ทแล้วกลับเป็น SCHOOL_INFO)
const userMode = new Map<string, Mode>();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get('x-line-signature') ?? ''))) {
    return new Response('invalid signature', { status: 401 });
  }

  const db = adminClient();
  const events = JSON.parse(raw).events ?? [];

  await Promise.all(
    events.map(async (ev: any) => {
      try {
        if (ev.type === 'follow') {
          return reply(ev.replyToken, [
            flexAnswer('สวัสดีค่ะ น้องลิ้นจี่ ผู้ช่วย AI ของโรงเรียนบ้านหาดเค็ดค่ะ ถามเรื่องโรงเรียนได้เลย หรือพิมพ์ "โหมดติวเตอร์" เพื่อให้น้องช่วยติวการบ้านนะคะ', 'WAVE', 'ทักทาย', 'SCHOOL_INFO'),
          ]);
        }
        if (ev.type !== 'message' || ev.message?.type !== 'text') return;
        const uid: string = ev.source?.userId ?? 'anon';
        const text: string = String(ev.message.text).trim();

        if (text === 'โหมดติวเตอร์' || text === 'โหมดข้อมูลโรงเรียน') {
          const m: Mode = text === 'โหมดติวเตอร์' ? 'TUTOR' : 'SCHOOL_INFO';
          userMode.set(uid, m);
          return reply(ev.replyToken, [
            flexAnswer(m === 'TUTOR' ? 'เข้าสู่โหมดติวเตอร์แล้วค่ะ ส่งโจทย์หรือเรื่องที่อยากเรียนมาได้เลยนะคะ' : 'กลับสู่โหมดข้อมูลโรงเรียนแล้วค่ะ อยากรู้เรื่องอะไรถามได้เลยนะคะ', 'HAPPY', 'เปลี่ยนโหมด', m),
          ]);
        }

        const mode = userMode.get(uid) ?? 'SCHOOL_INFO';
        const input = { question: text, mode, role: 'ทั่วไป', channel: 'LINE' as const };
        const out = await think(input, db);
        await logAnalytics(db, input, out);
        await reply(ev.replyToken, [flexAnswer(out.answer, out.emotion, out.topic_tag, mode)]);
      } catch (e) {
        console.error('line event error', e);
        await reply(ev.replyToken, [{ type: 'text', text: 'ขออภัยค่ะ ตอนนี้น้องลิ้นจี่ขัดข้องชั่วคราว ลองใหม่อีกครั้งนะคะ' }]);
      }
    }),
  );
  return new Response('ok');
});
