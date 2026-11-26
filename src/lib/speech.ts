import { mascotBus } from './mascotBus';

/* ========== Speech-to-Text (Web Speech API: SpeechRecognition th-TH) ========== */

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => RecognitionLike) | null;
}

export const isSTTSupported = () => getRecognitionCtor() !== null;
export const isTTSSupported = () => 'speechSynthesis' in window;

export interface ListenHandlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError?: (code: string) => void;
}

export function startListening(h: ListenHandlers): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    h.onError?.('not-supported');
    h.onEnd();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = 'th-TH';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finalText = '';
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (finalText.trim()) h.onFinal(finalText.trim());
    h.onEnd();
  };
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) h.onInterim?.(interim);
  };
  rec.onerror = (e) => h.onError?.(String(e.error ?? 'error'));
  rec.onend = finish;
  try {
    rec.start();
  } catch {
    finish();
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}

/* ========== Text-to-Speech (speechSynthesis th-TH) ========== */

let thaiVoice: SpeechSynthesisVoice | null | undefined;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
    speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        clearTimeout(t);
        resolve(speechSynthesis.getVoices());
      },
      { once: true },
    );
  });
}

async function pickThaiVoice() {
  if (thaiVoice !== undefined) return thaiVoice;
  const voices = await loadVoices();
  thaiVoice =
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === 'th-th' && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('th')) ??
    null;
  return thaiVoice;
}

/** ตัดสัญลักษณ์ที่ไม่ควรอ่านออกเสียง */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/https?:\/\/\S+/g, 'ลิงก์')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitChunks(text: string, max = 140): string[] {
  const parts = text.split(/(?<=[.!?。])\s+|\n+/).flatMap((s) => {
    if (s.length <= max) return [s];
    const out: string[] = [];
    let cur = '';
    for (const w of s.split(' ')) {
      if ((cur + ' ' + w).length > max && cur) {
        out.push(cur);
        cur = w;
      } else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) out.push(cur);
    return out.flatMap((c) => (c.length > max * 1.6 ? c.match(new RegExp(`.{1,${max}}`, 'g')) ?? [c] : [c]));
  });
  return parts.map((p) => p.trim()).filter(Boolean);
}

let speakToken = 0;

export function stopSpeaking() {
  speakToken++;
  if (isTTSSupported()) speechSynthesis.cancel();
  mascotBus.pulse = 0;
}

export async function speakThai(text: string, cb: { onStart?: () => void; onEnd?: () => void } = {}) {
  if (!isTTSSupported()) {
    cb.onEnd?.();
    return;
  }
  const token = ++speakToken;
  speechSynthesis.cancel();
  const chunks = splitChunks(cleanForSpeech(text));
  if (!chunks.length) {
    cb.onEnd?.();
    return;
  }
  const voice = await pickThaiVoice();
  if (token !== speakToken) return;

  let started = false;
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = 'th-TH';
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.pitch = 1.25; // เสียงสดใสแบบมาสคอต
    u.onstart = () => {
      if (token !== speakToken) return;
      if (!started) {
        started = true;
        mascotBus.speakStartedAt = performance.now();
        cb.onStart?.();
      }
    };
    // boundary = ขอบเขตคำ ใช้กระตุ้นการอ้าปากให้สัมพันธ์กับจังหวะพูดจริง (บางเสียงไม่รองรับ จะใช้ envelope สำรอง)
    u.onboundary = () => {
      if (token === speakToken) mascotBus.pulse = 1;
    };
    const done = () => {
      if (token !== speakToken) return;
      if (i === chunks.length - 1) {
        mascotBus.pulse = 0;
        cb.onEnd?.();
      }
    };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}
