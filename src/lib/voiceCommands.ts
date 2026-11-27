import type { Mode, UserRole } from './config';
import type { Emotion } from './mascotBus';

/**
 * ตีความประโยคที่ได้ยินจากไมค์: ชื่อเรียก "น้องลิ้นจี่" (wake word) + คำสั่งเสียง
 * ทำงานบนข้อความภาษาไทยที่ได้จาก Web Speech API (SpeechRecognition th-TH)
 *
 * ออกแบบให้ "คำสั่ง" ต้องตรงทั้งประโยค (anchored) เพื่อไม่ให้ไปดักคำถามจริง เช่น
 * "โหมดติวเตอร์" = สั่งสลับโหมด แต่ "ติวเตอร์ที่ดีควรทำอย่างไร" = คำถามปกติ
 */

export type VoiceCommand =
  | { type: 'clear' }
  | { type: 'mode'; mode: Mode }
  | { type: 'role'; role: UserRole }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'repeat' }
  | { type: 'goodbye' }
  | { type: 'voiceOff' }
  | { type: 'emotion'; emotion: Emotion; say: string }
  | { type: 'help' };

export interface ParsedUtterance {
  /** มีคำเรียก "น้องลิ้นจี่" อยู่ในประโยค */
  wake: boolean;
  /** ข้อความหลังตัดคำเรียกออก (ว่างได้ ถ้าผู้ใช้เรียกชื่ออย่างเดียว) */
  text: string;
  /** ถ้าทั้งประโยคเป็นคำสั่ง */
  command: VoiceCommand | null;
}

export const VOICE_HELP =
  'เรียกชื่อน้องลิ้นจี่แล้วถามได้เลยค่ะ หรือสั่งว่า โหมดติวเตอร์ โหมดข้อมูลโรงเรียน พูดอีกครั้ง ล้างการสนทนา ปิดเสียง หรือจบการสนทนา ค่ะ';

// "น้องลิ้นจี่" — รองรับการถอดเสียงที่คลาดเคลื่อน: ลิ้นจี / ลิ้นจิ / ลินจี่ (ไม่มีวรรณยุกต์) และมีช่องว่างแทรก
// หมายเหตุ: ไม่ใช้คำว่า "ลิ้นจี่" เดี่ยวๆ เป็นคำเรียก เพราะเป็นคำที่อยู่ในคำถามจริงบ่อย (ลิ้นจี่เมืองจัง)
const WAKE_SRC = 'น[้่]?\\s*อง\\s*ลิ[้่๊๋]?\\s*น\\s*จ\\s*[ีิ][่้๊๋]?';
const WAKE_TEST = new RegExp(WAKE_SRC);
const WAKE_ALL = new RegExp(WAKE_SRC, 'g');

export function hasWakeWord(raw: string): boolean {
  return WAKE_TEST.test(raw);
}

const PUNCT = /[\s.,!?;:"'“”‘’()[\]{}\-_–—…。、，]/g;
const TRAILING_PARTICLES = /(?:นะคะ|นะครับ|นะจ๊ะ|นะ|ค่ะ|คะ|ครับ|คับ|จ้ะ|จ๊ะ|จ้า|จ๋า|หน่อย|เลย|ด้วย|เถอะ|สิ|ซิ)+$/;
const LEADING_POLITE = /^(?:ช่วย|ขอ|กรุณา|รบกวน|ลอง|อยากให้|อยาก|ให้)+/;

function compact(s: string): string {
  return s.toLowerCase().replace(PUNCT, '');
}

function core(s: string): string {
  let c = compact(s);
  c = c.replace(LEADING_POLITE, '');
  c = c.replace(TRAILING_PARTICLES, '');
  return c;
}

const VERB = '(?:เปิด|เข้า|เปลี่ยน|สลับ|ไป|กลับไป|กลับ|ขอ)?(?:เป็น|สู่|ที่|ไปที่|ไป)?';

const RULES: { re: RegExp; make: (m: RegExpMatchArray) => VoiceCommand }[] = [
  { re: /^(?:(?:ล้าง|ลบ)(?:การสนทนา|การคุย|แชท|ข้อความ|ประวัติ)|เริ่ม(?:ใหม่|คุยใหม่|การสนทนาใหม่))$/, make: () => ({ type: 'clear' }) },
  { re: new RegExp(`^${VERB}(?:โหมด)?(?:ติวเตอร์|ติว)(?:โหมด)?$`), make: () => ({ type: 'mode', mode: 'TUTOR' }) },
  {
    re: new RegExp(`^${VERB}โหมด(?:ข้อมูลโรงเรียน|โรงเรียน|ถามตอบ)$|^(?:กลับ|เปลี่ยน|สลับ|ไป)(?:เป็น|สู่|ที่|ไปที่)?(?:ข้อมูลโรงเรียน)$`),
    make: () => ({ type: 'mode', mode: 'SCHOOL_INFO' }),
  },
  {
    re: /^(?:ฉัน|ผม|หนู|เรา|ดิฉัน)(?:คือ|เป็น)?(นักเรียน|ผู้ปกครอง|ผู้มาเยือน|คนทั่วไป|บุคคลทั่วไป)$/,
    make: (m) => ({ type: 'role', role: (m[1].includes('ทั่วไป') ? 'ทั่วไป' : m[1]) as UserRole }),
  },
  { re: /^ปิด(?:เสียงพูด|เสียง)(?:น้อง|ลิ้นจี่)?$/, make: () => ({ type: 'mute' }) },
  { re: /^เปิด(?:เสียงพูด|เสียง)$/, make: () => ({ type: 'unmute' }) },
  {
    re: /^(?:(?:พูด|ตอบ|ว่า)(?:ซ้ำ|อีก(?:ครั้ง|ที|รอบ)?)|ซ้ำ|อีกครั้ง|อีกรอบ|พูดใหม่อีกครั้ง)$/,
    make: () => ({ type: 'repeat' }),
  },
  { re: /^(?:ปิด|หยุด|เลิก)(?:โหมดเสียง|โหมดสั่งงานด้วยเสียง|การฟัง|ไมค์|ไมโครโฟน|ฟัง)$/, make: () => ({ type: 'voiceOff' }) },
  {
    re: /^(?:(?:จบ|เลิก)(?:การสนทนา|การคุย|คุย)|ลาก่อน|บ๊ายบาย|บายบาย|บาย|ไปก่อน|แค่นี้|แค่นี้แหละ|แค่นี้พอ|ไว้คุยกันใหม่|ไว้เจอกันใหม่)$/,
    make: () => ({ type: 'goodbye' }),
  },
  { re: /^(?:โบกมือ|โบกมือทักทาย|ทักทาย|ทักหน่อย)$/, make: () => ({ type: 'emotion', emotion: 'WAVE', say: 'สวัสดีค่ะ น้องลิ้นจี่ยินดีต้อนรับค่ะ' }) },
  { re: /^(?:ยิ้ม|ยิ้มหน่อย)$/, make: () => ({ type: 'emotion', emotion: 'HAPPY', say: 'ยิ้มแย้มแจ่มใสค่ะ' }) },
  { re: /^(?:ดีใจ|ตื่นเต้น|เฮ)$/, make: () => ({ type: 'emotion', emotion: 'EXCITED', say: 'เย้ ดีใจจังเลยค่ะ' }) },
  {
    re: /^(?:ทำอะไรได้บ้าง|ช่วยอะไรได้บ้าง|มีคำสั่งอะไรบ้าง|มีคำสั่งอะไร|คำสั่งเสียง|ใช้งานยังไง|ใช้งานอย่างไร|ช่วยเหลือ|help)$/,
    make: () => ({ type: 'help' }),
  },
];

function matchCommand(text: string): VoiceCommand | null {
  const c = core(text);
  if (!c) return null;
  for (const r of RULES) {
    const m = c.match(r.re);
    if (m) return r.make(m);
  }
  return null;
}

export function parseUtterance(raw: string): ParsedUtterance {
  const original = raw.trim();
  const wake = hasWakeWord(original);
  let text = original
    .replace(WAKE_ALL, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,，.!?]+|[\s,，.!?]+$/g, '')
    .trim();
  // เหลือแต่คำลงท้าย เช่น "น้องลิ้นจี่คะ" → ถือว่าเรียกชื่ออย่างเดียว
  if (core(text) === '') text = '';
  return { wake, text, command: matchCommand(text) };
}
