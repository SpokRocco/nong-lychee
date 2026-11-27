import { ENV, type Channel, type Mode } from './config';
import { EMOTIONS, type Emotion } from './mascotBus';
import { factsAsContext, matchFact } from './localKnowledge';
import { FN_CHAT, isSupabaseConfigured, supabase } from './supabase';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AskParams {
  question: string;
  mode: Mode;
  role: string;
  channel: Channel;
  history: ChatTurn[];
}

export interface AskResult {
  answer: string;
  emotion: Emotion;
  topic_tag: string;
  sources: { file_name: string; category: string; similarity: number }[];
  via: 'edge' | 'gemini-dev' | 'offline';
}

function normalizeEmotion(e: unknown): Emotion {
  return EMOTIONS.includes(e as Emotion) ? (e as Emotion) : 'HAPPY';
}

async function viaEdge(p: AskParams): Promise<AskResult> {
  if (!supabase) throw new Error('supabase not configured');
  const { data, error } = await supabase.functions.invoke(FN_CHAT, {
    body: {
      action: 'chat',
      question: p.question,
      mode: p.mode,
      role: p.role,
      channel: p.channel,
      history: p.history.slice(-6),
    },
  });
  if (error) throw error;
  if (!data?.answer) throw new Error('empty response');
  return {
    answer: data.answer,
    emotion: normalizeEmotion(data.emotion),
    topic_tag: data.topic_tag ?? 'ทั่วไป',
    sources: data.sources ?? [],
    via: 'edge',
  };
}

const DEV_PERSONA = `คุณคือ "น้องลิ้นจี่" มาสคอต AI ประจำโรงเรียนบ้านหาดเค็ด สพป.น่าน เขต 1 (ผอ. นายเอกชัย สุภา) สื่อถึงลิ้นจี่เมืองจัง อ.ภูเพียง จ.น่าน
พูดสุภาพ สดใส ลงท้ายค่ะ/นะคะ ตอบสั้นไม่เกิน 4-5 ประโยค ห้ามใช้ markdown/อีโมจิ ห้ามแต่งข้อมูลโรงเรียนที่ไม่มีในข้อมูลอ้างอิง ผู้ใช้อาจเป็นเด็กประถม ตอบ JSON ตามสคีมา`;

async function viaDevGemini(p: AskParams): Promise<AskResult> {
  const mode =
    p.mode === 'TUTOR'
      ? 'โหมดติวเตอร์ระดับประถม: อธิบายทีละขั้น ให้คำใบ้ก่อนเฉลย topic_tag ขึ้นต้นด้วย "ติว"'
      : `โหมดข้อมูลโรงเรียน ใช้เฉพาะข้อมูลอ้างอิง:\n${factsAsContext(p.question)}`;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ENV.devGeminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${DEV_PERSONA}\n${mode}\nผู้ถาม: ${p.role}` }] },
        contents: [
          ...p.history.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: p.question }] },
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              answer: { type: 'STRING' },
              emotion: { type: 'STRING', enum: EMOTIONS },
              topic_tag: { type: 'STRING' },
            },
            required: ['answer', 'emotion', 'topic_tag'],
          },
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text ?? '').join('') ?? '';
  const parsed = JSON.parse(raw);
  return {
    answer: String(parsed.answer),
    emotion: normalizeEmotion(parsed.emotion),
    topic_tag: String(parsed.topic_tag || 'ทั่วไป').slice(0, 30),
    sources: [],
    via: 'gemini-dev',
  };
}

function offline(p: AskParams): AskResult {
  if (p.mode === 'TUTOR') {
    return {
      answer:
        'โหมดติวเตอร์ต้องเชื่อมต่อสมอง AI ก่อนนะคะ ผู้ดูแลระบบต้อง Deploy Edge Function และตั้งค่า Supabase ตามคู่มือ README ค่ะ',
      emotion: 'SAD',
      topic_tag: 'ติวเตอร์ (ออฟไลน์)',
      sources: [],
      via: 'offline',
    };
  }
  const f = matchFact(p.question);
  if (f) return { answer: f.answer, emotion: f.topic === 'ทักทาย' ? 'WAVE' : 'HAPPY', topic_tag: f.topic, sources: [], via: 'offline' };
  return {
    answer:
      'ตอนนี้น้องลิ้นจี่ยังไม่มีข้อมูลเรื่องนี้ค่ะ ลองสอบถามคุณครูหรือที่ห้องธุรการของโรงเรียนได้เลยนะคะ',
    emotion: 'SAD',
    topic_tag: 'ไม่มีข้อมูล',
    sources: [],
    via: 'offline',
  };
}

export async function askMascot(p: AskParams): Promise<AskResult> {
  if (isSupabaseConfigured) {
    try {
      return await viaEdge(p); // Edge Function บันทึก analytics เอง
    } catch (e) {
      console.warn('Edge function unavailable, falling back', e);
    }
  }
  // ไม่บันทึก analytics จากเบราว์เซอร์โดยตรง: ผู้เยี่ยมชม (anon) ไม่มีสิทธิ์เขียนฐานข้อมูล nong_lychee
  // การบันทึกทำโดย Edge Function nong-lychee-chat เท่านั้น
  if (ENV.devGeminiKey) {
    try {
      return await viaDevGemini(p);
    } catch (e) {
      console.warn('Dev Gemini failed', e);
    }
  }
  return offline(p);
}

export async function fetchExecutiveSummary(days: number): Promise<string> {
  if (!supabase) throw new Error('Supabase ยังไม่ได้ตั้งค่า');
  const { data, error } = await supabase.functions.invoke(FN_CHAT, { body: { action: 'summary', days } });
  if (error) throw error;
  return String(data?.summary ?? '');
}
