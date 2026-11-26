// สถานะที่ใช้ร่วมกันระหว่าง UI (React) กับโมเดล 3D (useFrame)
// ใช้ object แบบ mutable เพื่อให้ loop 60fps อ่านค่าได้โดยไม่ต้อง re-render React

export type Emotion = 'HAPPY' | 'EXCITED' | 'THINKING' | 'SAD' | 'SURPRISED' | 'WAVE';
export type Activity = 'idle' | 'listening' | 'thinking' | 'speaking';

export const EMOTIONS: Emotion[] = ['HAPPY', 'EXCITED', 'THINKING', 'SAD', 'SURPRISED', 'WAVE'];

export const mascotBus = {
  emotion: 'HAPPY' as Emotion,
  activity: 'idle' as Activity,
  /** ระดับเสียงไมโครโฟน 0..1 จาก Web Audio AnalyserNode (ตอนผู้ใช้พูด) */
  micLevel: 0,
  /** แรงกระตุ้นจาก boundary ของ speechSynthesis (0..1) ใช้ขยับปากตามจังหวะคำพูดจริง */
  pulse: 0,
  /** เวลา (ms) ที่เริ่มพูดล่าสุด เพื่อรีเซ็ต envelope */
  speakStartedAt: 0,
};

export function setEmotion(e: Emotion) {
  mascotBus.emotion = e;
}
export function setActivity(a: Activity) {
  mascotBus.activity = a;
  if (a !== 'listening') mascotBus.micLevel = 0;
}
