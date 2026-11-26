import { useEffect, useRef, useState } from 'react';
import { GraduationCap, Mic, MicOff, School, Send, Trash2, Volume2, VolumeX } from 'lucide-react';
import { QUICK_QUESTIONS, USER_ROLES, type UserRole } from '../lib/config';
import { isSTTSupported } from '../lib/speech';
import type { useMascotChat } from '../hooks/useMascotChat';

type Chat = ReturnType<typeof useMascotChat>;

const EMOTION_LABEL: Record<string, string> = {
  HAPPY: 'ยิ้มแย้ม',
  EXCITED: 'ตื่นเต้น',
  THINKING: 'กำลังคิด',
  SAD: 'ขออภัย',
  SURPRISED: 'ว้าว',
  WAVE: 'ทักทาย',
};

export function ChatPanel({ chat }: { chat: Chat }) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const sttOk = isSTTSupported();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.busy, chat.interim]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    void chat.ask(text);
    setText('');
  };

  return (
    <section className="card flex h-[34rem] flex-col overflow-hidden lg:h-full lg:min-h-[34rem]" aria-label="แชทกับน้องลิ้นจี่">
      {/* โหมด + ผู้ใช้ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-lychee-100 p-3">
        <div className="flex rounded-full bg-lychee-50 p-1" role="tablist" aria-label="โหมดการใช้งาน">
          <button
            role="tab"
            aria-selected={chat.mode === 'SCHOOL_INFO'}
            className={`btn !px-3 !py-1.5 ${chat.mode === 'SCHOOL_INFO' ? 'btn-primary' : 'text-lychee-700'}`}
            onClick={() => chat.setMode('SCHOOL_INFO')}
          >
            <School size={15} aria-hidden /> ข้อมูลโรงเรียน
          </button>
          <button
            role="tab"
            aria-selected={chat.mode === 'TUTOR'}
            className={`btn !px-3 !py-1.5 ${chat.mode === 'TUTOR' ? 'bg-leaf-600 text-white' : 'text-lychee-700'}`}
            onClick={() => chat.setMode('TUTOR')}
          >
            <GraduationCap size={15} aria-hidden /> ติวเตอร์
          </button>
        </div>
        <label className="ml-auto flex items-center gap-1 text-xs text-lychee-900/70">
          ฉันคือ
          <select
            value={chat.role}
            onChange={(e) => chat.setRole(e.target.value as UserRole)}
            className="rounded-full border border-lychee-200 bg-white px-2 py-1 text-xs"
          >
            {USER_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-ghost !p-2" onClick={chat.toggleTts} aria-label={chat.ttsOn ? 'ปิดเสียงน้องลิ้นจี่' : 'เปิดเสียงน้องลิ้นจี่'} title="เสียงพูด">
          {chat.ttsOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button className="btn btn-ghost !p-2" onClick={chat.clear} aria-label="ล้างการสนทนา" title="ล้างการสนทนา">
          <Trash2 size={16} />
        </button>
      </div>

      {/* ข้อความ */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {chat.messages.length === 0 && (
          <div className="rounded-2xl bg-lychee-50 p-4 text-sm text-lychee-900">
            <p className="font-medium">สวัสดีค่ะ น้องลิ้นจี่ยินดีที่ได้รู้จักค่ะ 🍒</p>
            <p className="mt-1 text-lychee-900/75">
              {chat.mode === 'TUTOR'
                ? 'โหมดติวเตอร์: ถามการบ้านหรือเรื่องที่อยากรู้ได้เลย น้องจะอธิบายทีละขั้นนะคะ'
                : 'โหมดข้อมูลโรงเรียน: ถามเรื่องโรงเรียนบ้านหาดเค็ดและลิ้นจี่เมืองจังได้เลยค่ะ'}
            </p>
          </div>
        )}
        {chat.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'rounded-br-md bg-lychee-600 text-white' : 'rounded-bl-md bg-lychee-50 text-lychee-900'
              }`}
            >
              {m.text}
              {m.role === 'assistant' && (m.topic || m.emotion) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-lychee-900/60">
                  {m.topic && <span className="rounded-full bg-white px-2 py-0.5">#{m.topic}</span>}
                  {m.emotion && <span>{EMOTION_LABEL[m.emotion]}</span>}
                  {m.via === 'offline' && <span className="text-amber-700">โหมดออฟไลน์</span>}
                  {m.sources && m.sources.length > 0 && <span>อ้างอิง: {[...new Set(m.sources)].slice(0, 2).join(', ')}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {chat.listening && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md border border-dashed border-lychee-300 px-4 py-2 text-sm text-lychee-700">
              {chat.interim || 'กำลังฟัง… พูดได้เลยค่ะ'}
            </div>
          </div>
        )}
        {chat.busy && (
          <div className="flex gap-1.5 px-2" aria-label="น้องลิ้นจี่กำลังคิด">
            {[0, 1, 2].map((i) => (
              <span key={i} className="dot h-2 w-2 rounded-full bg-lychee-400" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {chat.notice && <p className="mx-4 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{chat.notice}</p>}

      {/* คำถามด่วน */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-2">
        {QUICK_QUESTIONS[chat.mode].map((q) => (
          <button key={q} className="chip shrink-0" disabled={chat.busy} onClick={() => void chat.ask(q)}>
            {q}
          </button>
        ))}
      </div>

      {/* ช่องพิมพ์ */}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-lychee-100 p-3">
        <button
          type="button"
          onClick={chat.toggleMic}
          disabled={!sttOk}
          className={`btn !p-3 ${chat.listening ? 'btn-primary mic-live' : 'btn-ghost'}`}
          aria-label={chat.listening ? 'หยุดฟัง' : 'พูดถามน้องลิ้นจี่ (ภาษาไทย)'}
          title={sttOk ? 'พูดถามด้วยเสียง' : 'เบราว์เซอร์ไม่รองรับการรับเสียง'}
        >
          {chat.listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          placeholder={chat.mode === 'TUTOR' ? 'พิมพ์โจทย์หรือสิ่งที่อยากเรียน…' : 'พิมพ์คำถามเกี่ยวกับโรงเรียน…'}
          className="min-w-0 flex-1 rounded-full border border-lychee-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-lychee-400 focus:ring-2 focus:ring-lychee-200"
          aria-label="พิมพ์ข้อความ"
        />
        <button type="submit" disabled={chat.busy || !text.trim()} className="btn btn-primary !p-3" aria-label="ส่งข้อความ">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
