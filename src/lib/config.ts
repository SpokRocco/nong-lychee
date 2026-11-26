export const SCHOOL = {
  name: 'โรงเรียนบ้านหาดเค็ด',
  affiliation: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาน่าน เขต 1 (สพป.น่าน เขต 1)',
  director: 'นายเอกชัย สุภา',
  directorTitle: 'ผู้อำนวยการโรงเรียน',
  mascotName: 'น้องลิ้นจี่',
  mascotNameEn: 'Nong Lychee',
  theme: 'ลิ้นจี่เมืองจัง ของดีประจำอำเภอภูเพียง จังหวัดน่าน',
};

const env = import.meta.env;

export const ENV = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined)?.trim() || '',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '',
  modelUrl: (env.VITE_MASCOT_MODEL_URL as string | undefined)?.trim() || '',
  devGeminiKey: (env.VITE_DEV_GEMINI_API_KEY as string | undefined)?.trim() || '',
  mediapipeWasm:
    (env.VITE_MEDIAPIPE_WASM_URL as string | undefined)?.trim() ||
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
  mediapipeFaceModel:
    (env.VITE_MEDIAPIPE_FACE_MODEL_URL as string | undefined)?.trim() ||
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
};

export const USER_ROLES = ['ทั่วไป', 'นักเรียน', 'ผู้ปกครอง', 'ผู้มาเยือน'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type Mode = 'SCHOOL_INFO' | 'TUTOR';
export type Channel = 'WEB' | 'KIOSK_VOICE' | 'LINE';

export const QUICK_QUESTIONS: Record<Mode, string[]> = {
  SCHOOL_INFO: [
    'โรงเรียนบ้านหาดเค็ดอยู่สังกัดอะไร',
    'ผู้อำนวยการโรงเรียนชื่ออะไร',
    'ลิ้นจี่เมืองจังคืออะไร',
    'รับสมัครนักเรียนต้องเตรียมอะไรบ้าง',
  ],
  TUTOR: [
    'ช่วยสอนการบวกเลขเศษส่วนหน่อย',
    'วิทยาการคำนวณคืออะไร',
    'สอนเขียนคำควบกล้ำหน่อย',
    'ทำไมลิ้นจี่ถึงมีสีแดง',
  ],
};
