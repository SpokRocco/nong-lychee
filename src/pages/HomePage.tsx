import { Header } from '../components/Header';
import { MascotStage } from '../components/MascotStage';
import { ChatPanel } from '../components/ChatPanel';
import { useMascotChat } from '../hooks/useMascotChat';
import { SCHOOL } from '../lib/config';
import { isSupabaseConfigured } from '../lib/supabase';
import { mascotBus, setEmotion, type Emotion } from '../lib/mascotBus';

const MOODS: { e: Emotion; label: string }[] = [
  { e: 'WAVE', label: '👋 โบกมือ' },
  { e: 'HAPPY', label: '😊 ยิ้ม' },
  { e: 'EXCITED', label: '🎉 ดีใจ' },
  { e: 'THINKING', label: '🤔 คิด' },
];

export function HomePage() {
  const chat = useMascotChat({ channel: 'WEB' });

  return (
    <div className="min-h-screen bg-gradient-to-b from-lychee-50 via-white to-leaf-50">
      <Header route="home" />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-stretch">
        <section className="card relative overflow-hidden">
          <div className="absolute left-4 top-4 z-10 max-w-[70%]">
            <p className="text-xs font-medium text-leaf-700">{SCHOOL.theme}</p>
            <p className="mt-0.5 text-[11px] text-lychee-900/60">ลากเพื่อหมุนมองรอบตัวน้อง · น้องจะมองตามเมาส์</p>
          </div>
          <MascotStage className="h-[26rem] w-full sm:h-[32rem] lg:h-full lg:min-h-[34rem]" />
          <StatusPill chat={chat} />
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2">
            {MOODS.map((m) => (
              <button
                key={m.e}
                className="chip shadow-sm"
                onClick={() => {
                  setEmotion(m.e);
                  if (m.e === 'WAVE') chat.say('สวัสดีค่ะ น้องลิ้นจี่ยินดีต้อนรับค่ะ', 'WAVE');
                  else setTimeout(() => mascotBus.activity === 'idle' && setEmotion('HAPPY'), 3500);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {!isSupabaseConfigured && (
            <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
              ยังไม่ได้เชื่อมต่อ Supabase / Gemini — กำลังใช้ <b>โหมดออฟไลน์</b> (ตอบได้เฉพาะข้อมูลพื้นฐาน)
              ดูวิธีตั้งค่าใน README.md
            </p>
          )}
          <div className="flex-1">
            <ChatPanel chat={chat} />
          </div>
        </div>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-lychee-900/60">
        {SCHOOL.name} · {SCHOOL.affiliation}
        <br />
        {SCHOOL.directorTitle}: {SCHOOL.director}
      </footer>
    </div>
  );
}

function StatusPill({ chat }: { chat: ReturnType<typeof useMascotChat> }) {
  const label = chat.listening ? 'กำลังฟัง…' : chat.busy ? 'กำลังคิด…' : chat.speaking ? 'กำลังพูด…' : '';
  if (!label) return null;
  return (
    <div className="absolute right-4 top-4 z-10 rounded-full bg-lychee-600 px-3 py-1 text-xs font-medium text-white shadow-soft" role="status">
      {label}
    </div>
  );
}
