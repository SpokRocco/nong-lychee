import { SCHOOL } from './config';

export interface Fact {
  keywords: string[];
  topic: string;
  answer: string;
}

// ฐานความรู้สำรองในเครื่อง (ใช้เมื่อยังไม่ได้เชื่อม Supabase) มีเฉพาะข้อมูลที่ยืนยันแล้ว
// ข้อมูลอื่น เช่น ตารางเรียน การรับสมัคร ให้นำเข้าจาก Google Drive ผ่านระบบ RAG
export const FACTS: Fact[] = [
  {
    keywords: ['สังกัด', 'เขตพื้นที่', 'สพป', 'น่าน เขต 1', 'หน่วยงาน'],
    topic: 'ข้อมูลโรงเรียน',
    answer: `${SCHOOL.name} สังกัด${SCHOOL.affiliation} ค่ะ`,
  },
  {
    keywords: ['ผู้อำนวยการ', 'ผอ', 'ผู้บริหาร', 'เอกชัย'],
    topic: 'บุคลากร',
    answer: `${SCHOOL.directorTitle}${SCHOOL.name}คือ ${SCHOOL.director} ค่ะ`,
  },
  {
    keywords: ['ลิ้นจี่', 'เมืองจัง', 'ภูเพียง', 'ของดี'],
    topic: 'ลิ้นจี่เมืองจัง',
    answer:
      'ลิ้นจี่เมืองจังเป็นของดีประจำอำเภอภูเพียง จังหวัดน่านค่ะ น้องลิ้นจี่ก็เป็นมาสคอตที่สื่อถึงลิ้นจี่เมืองจังนี้เอง จึงสวมฮู้ดเปลือกลิ้นจี่สีแดงและมีใบลิ้นจี่สีเขียวบนหัวค่ะ',
  },
  {
    keywords: ['น้องลิ้นจี่', 'มาสคอต', 'คือใคร', 'ชื่ออะไร'],
    topic: 'ทั่วไป',
    answer: `น้องลิ้นจี่เป็นมาสคอต AI 3D ของ${SCHOOL.name} ช่วยตอบข้อมูลโรงเรียนและช่วยติวการบ้านให้นักเรียนค่ะ`,
  },
  {
    keywords: ['สวัสดี', 'หวัดดี', 'ทักทาย', 'hello', 'hi'],
    topic: 'ทักทาย',
    answer: `สวัสดีค่ะ น้องลิ้นจี่ยินดีต้อนรับสู่${SCHOOL.name}ค่ะ อยากรู้เรื่องอะไรถามได้เลยนะคะ`,
  },
];

export function matchFact(question: string): Fact | null {
  const q = question.toLowerCase();
  let best: { f: Fact; score: number } | null = null;
  for (const f of FACTS) {
    const score = f.keywords.reduce((s, k) => s + (q.includes(k.toLowerCase()) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { f, score };
  }
  return best?.f ?? null;
}

export function factsAsContext(question: string): string {
  const hit = matchFact(question);
  const base = FACTS.slice(0, 3).map((f) => `- ${f.answer}`);
  return hit && !FACTS.slice(0, 3).includes(hit) ? [...base, `- ${hit.answer}`].join('\n') : base.join('\n');
}
