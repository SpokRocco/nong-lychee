import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Mic, MicOff, Play, ShieldCheck, X } from 'lucide-react';
import { MascotStage } from '../components/MascotStage';
import { Logo } from '../components/Header';
import { useMascotChat } from '../hooks/useMascotChat';
import { startPresence, type PresenceHandle } from '../lib/presence';
import { QUICK_QUESTIONS, SCHOOL } from '../lib/config';

const GREET_COOLDOWN_MS = 25_000;
const IDLE_RESET_MS = 60_000;

function greeting(): string {
  const h = new Date().getHours();
  const tod = h < 5 ? 'สวัสดีค่ะ' : h < 12 ? 'อรุณสวัสดิ์ค่ะ' : h < 17 ? 'สวัสดีตอนบ่ายค่ะ' : 'สวัสดีตอนเย็นค่ะ';
  const opts = [
    `${tod} น้องลิ้นจี่ยินดีต้อนรับสู่${SCHOOL.name}ค่ะ มีอะไรให้น้องช่วยไหมคะ`,
    `${tod} ยินดีต้อนรับค่ะ อยากรู้เรื่องโรงเรียนหรือลิ้นจี่เมืองจัง ถามน้องลิ้นจี่ได้เลยนะคะ`,
    `${tod} น้องลิ้นจี่ประจำโรงเรียนบ้านหาดเค็ดค่ะ แตะปุ่มไมค์แล้วพูดถามได้เลยนะคะ`,
  ];
  return opts[Math.floor(Math.random() * opts.length)];
}

export function KioskPage() {
  const chat = useMascotChat({ channel: 'KIOSK_VOICE', initialMode: 'SCHOOL_INFO' });
  const [started, setStarted] = useState(false);
  const [camState, setCamState] = useState<'off' | 'starting' | 'mediapipe' | 'motion' | 'denied'>('off');
  const [present, setPresent] = useState(false);
  const handle = useRef<PresenceHandle | null>(null);
  const lastGreet = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const live = useRef(chat);
  live.current = chat;

  const bumpIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      live.current.clear();
      live.current.sleep(); // จบช่วงสนทนา: ต่อไปต้องเรียก "น้องลิ้นจี่" หรือรอทักทายอัตโนมัติรอบใหม่
    }, IDLE_RESET_MS);
  }, []);

  const greet = useCallback(() => {
    const c = live.current;
    if (c.busy || c.listening || c.speaking) return;
    const now = Date.now();
    if (now - lastGreet.current < GREET_COOLDOWN_MS) return;
    lastGreet.current = now;
    const g = greeting();
    // ทักทายแล้วเปิดไมค์ฟังต่ออัตโนมัติ เพื่อให้ผู้มาเยือนพูดถามได้ทันที
    c.say(g, 'WAVE', () => {
      live.current.wake();
      void live.current.startMic();
    });
    bumpIdle();
  }, [bumpIdle]);

  const startCamera = useCallback(async () => {
    setCamState('starting');
    try {
      const h = await startPresence({
        onArrive: () => {
          setPresent(true);
          greet();
        },
        onLeave: () => setPresent(false),
      });
      handle.current = h;
      setCamState(h.mode);
    } catch (e) {
      console.warn('camera denied/unavailable', e);
      setCamState('denied');
    }
  }, [greet]);

  const stopCamera = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    setCamState('off');
    setPresent(false);
  }, []);

  const start = async () => {
    setStarted(true); // การแตะครั้งแรก = user gesture ที่เบราว์เซอร์ต้องการสำหรับเสียงพูด
    // เปิดโหมดสั่งงานด้วยเสียง (ฟังต่อเนื่อง) ถ้าเบราว์เซอร์รองรับ ไม่งั้นแค่ทักทาย
    const hello = 'สวัสดีค่ะ ระบบน้องลิ้นจี่พร้อมให้บริการแล้วค่ะ พูดถามได้เลย หรือเรียกชื่อน้องลิ้นจี่ก่อนก็ได้นะคะ';
    if (!live.current.enableVoice(hello)) live.current.say(hello, 'WAVE');
    await startCamera();
  };

  useEffect(() => () => handle.current?.stop(), []);
  useEffect(() => {
    if (chat.messages.length) bumpIdle();
  }, [chat.messages.length, bumpIdle]);
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  const last = [...chat.messages].reverse().find((m) => m.role === 'assistant');
  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-lychee-700 via-lychee-600 to-lychee-800 text-white">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-leaf-500/30 blur-3xl" />
      <header className="relative z-10 flex items-center gap-3 px-6 py-4">
        <Logo size={48} />
        <div className="flex-1">
          <p className="text-xl font-semibold leading-tight sm:text-2xl">{SCHOOL.name}</p>
          <p className="text-xs text-white/75 sm:text-sm">{SCHOOL.theme}</p>
        </div>
        <a href="#/" className="btn bg-white/15 text-white hover:bg-white/25" aria-label="ออกจากโหมด Kiosk">
          <X size={16} /> ออก
        </a>
      </header>

      <main className="relative z-10 grid flex-1 gap-4 px-4 pb-4 lg:grid-cols-2 lg:px-8">
        <MascotStage framing="close" className="h-[22rem] w-full lg:h-auto lg:min-h-[32rem]" />

        <div className="flex flex-col justify-center gap-4">
          <div className="rounded-3xl bg-white/95 p-6 text-lychee-900 shadow-2xl" aria-live="polite">
            {last || chat.busy || chat.listening ? (
              <>
                {lastUser && <p className="mb-2 text-sm text-lychee-700/70">คำถาม: {lastUser.text}</p>}
                <p className="min-h-[5rem] whitespace-pre-wrap text-xl leading-relaxed sm:text-2xl">
                  {chat.listening ? chat.interim || 'กำลังฟัง… พูดได้เลยค่ะ' : chat.busy ? 'น้องลิ้นจี่กำลังคิดนะคะ…' : last?.text}
                </p>
              </>
            ) : (
              <p className="text-xl leading-relaxed sm:text-2xl">
                {started
                  ? 'เดินเข้ามาใกล้ ๆ น้องลิ้นจี่จะทักทาย หรือพูดว่า “น้องลิ้นจี่” แล้วถามได้เลยค่ะ'
                  : 'แตะปุ่ม "เริ่มระบบ" เพื่อเปิดเสียงและกล้องตรวจจับผู้มาเยือน'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.SCHOOL_INFO.map((q) => (
              <button
                key={q}
                disabled={!started || chat.busy}
                onClick={() => void chat.ask(q)}
                className="rounded-full bg-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/25 disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!started ? (
              <button onClick={() => void start()} className="btn bg-white !px-8 !py-4 text-lg text-lychee-700 hover:bg-lychee-50">
                <Play size={22} /> เริ่มระบบ Smart Kiosk
              </button>
            ) : (
              <>
                <button
                  onClick={chat.toggleVoice}
                  className={`btn !p-5 ${chat.listening ? 'bg-white text-lychee-700 mic-live' : 'bg-leaf-600 text-white hover:bg-leaf-700'}`}
                  aria-pressed={chat.voiceMode}
                  aria-label={chat.voiceMode ? 'ปิดโหมดสั่งงานด้วยเสียง' : 'เปิดโหมดสั่งงานด้วยเสียง'}
                  title={chat.voiceMode ? (chat.standby ? 'รอฟังคำว่า “น้องลิ้นจี่” — แตะเพื่อปิด' : 'กำลังฟัง — แตะเพื่อปิด') : 'แตะเพื่อเปิดโหมดสั่งงานด้วยเสียง'}
                >
                  {chat.voiceMode ? <MicOff size={30} /> : <Mic size={30} />}
                </button>
                <button
                  onClick={camState === 'mediapipe' || camState === 'motion' ? stopCamera : () => void startCamera()}
                  className="btn bg-white/15 text-white hover:bg-white/25"
                >
                  {camState === 'mediapipe' || camState === 'motion' ? <Camera size={16} /> : <CameraOff size={16} />}
                  {camState === 'starting'
                    ? 'กำลังเปิดกล้อง…'
                    : camState === 'mediapipe'
                      ? present ? 'พบผู้มาเยือน' : 'รอผู้มาเยือน (ตรวจใบหน้า)'
                      : camState === 'motion'
                        ? present ? 'พบการเคลื่อนไหว' : 'รอผู้มาเยือน (ตรวจการเคลื่อนไหว)'
                        : camState === 'denied'
                          ? 'ไม่ได้รับสิทธิ์กล้อง - ลองใหม่'
                          : 'เปิดระบบทักทายอัตโนมัติ'}
                </button>
                <button onClick={chat.toggleTts} className="btn bg-white/15 text-white hover:bg-white/25">
                  {chat.ttsOn ? 'เสียง: เปิด' : 'เสียง: ปิด'}
                </button>
              </>
            )}
          </div>
          {chat.notice && <p className="rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-900">{chat.notice}</p>}
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-2 px-4 pb-4 text-xs text-white/75">
        <ShieldCheck size={14} aria-hidden /> ตรวจจับในเครื่องนี้เท่านั้น ไม่บันทึกภาพ ไม่อัปโหลดภาพหรือจดจำใบหน้า · {SCHOOL.directorTitle}: {SCHOOL.director}
      </footer>
    </div>
  );
}
