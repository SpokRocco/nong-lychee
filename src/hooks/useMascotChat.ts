import { useCallback, useEffect, useRef, useState } from 'react';
import { askMascot, type ChatTurn } from '../lib/ai';
import type { Channel, Mode, UserRole } from '../lib/config';
import { mascotBus, setActivity, setEmotion, type Emotion } from '../lib/mascotBus';
import { MicMeter } from '../lib/audioMeter';
import { isSTTSupported, isTTSSupported, speakThai, startListening, stopSpeaking } from '../lib/speech';
import { hasWakeWord, parseUtterance, VOICE_HELP, type VoiceCommand } from '../lib/voiceCommands';

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  emotion?: Emotion;
  topic?: string;
  via?: string;
  sources?: string[];
  /** 'command' = ข้อความจากคำสั่งเสียง (ไม่ส่งเป็นประวัติให้ AI) */
  kind?: 'command';
}

interface Options {
  channel: Channel;
  initialMode?: Mode;
  /**
   * โหมดสั่งงานด้วยเสียง: true = ต้องเรียก "น้องลิ้นจี่" ก่อน (หรืออยู่ในช่วงสนทนา) ถึงจะตอบ
   * ป้องกันน้องตอบเสียงคนคุยกันรอบข้าง
   */
  requireWakeWord?: boolean;
}

let seq = 1;

/** หลังตอบแล้ว ผู้ใช้พูดต่อได้โดยไม่ต้องเรียกชื่อซ้ำภายในช่วงเวลานี้ */
const AWAKE_MS = 25_000;
/** ถ้ากำลังประมวลผล/พูดค้างนานเกินนี้ ให้ watchdog เริ่มฟังใหม่ */
const HOLD_TIMEOUT_MS = 30_000;

export function useMascotChat({ channel, initialMode = 'SCHOOL_INFO', requireWakeWord = true }: Options) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<UserRole>('ทั่วไป');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [notice, setNotice] = useState('');
  /** เปิดโหมดสั่งงานด้วยเสียงอยู่หรือไม่ (ฟังต่อเนื่อง) */
  const [voiceMode, setVoiceMode] = useState(false);
  /** อยู่ในช่วงสนทนา (ไม่ต้องเรียกชื่อ) */
  const [awake, setAwake] = useState(false);
  /** ไมค์เปิดอยู่แต่รอได้ยินคำเรียกชื่อ */
  const [standby, setStandby] = useState(false);

  const stopListenRef = useRef<((discard?: boolean) => void) | null>(null);
  const meter = useRef(new MicMeter());
  const live = useRef({ messages, mode, role, ttsOn, busy });
  live.current = { messages, mode, role, ttsOn, busy };

  const voiceOnRef = useRef(false);
  const awakeUntil = useRef(0);
  const awakeTimer = useRef<ReturnType<typeof setTimeout>>();
  /** true ระหว่างประมวลผลคำพูด/น้องกำลังพูด: ห้ามเปิดไมค์ใหม่ (กันได้ยินเสียงตัวเอง) */
  const hold = useRef(false);
  const holdSince = useRef(0);
  const relistenTimer = useRef<ReturnType<typeof setTimeout>>();
  const startMicRef = useRef<((after?: () => void) => Promise<void>) | null>(null);
  const handleHeardRef = useRef<(heard: string, after?: () => void) => void>(() => {});
  const lastError = useRef('');
  const startedAt = useRef(0);
  const quickEnds = useRef(0);

  const idleSoon = useCallback(() => {
    setSpeaking(false);
    setActivity('idle');
    setEmotion('HAPPY');
  }, []);

  const stopListening = useCallback((discard = false) => {
    stopListenRef.current?.(discard);
    stopListenRef.current = null;
    meter.current.stop();
    setListening(false);
    setStandby(false);
    setInterim('');
    if (mascotBus.activity === 'listening') setActivity('idle');
  }, []);

  /** เริ่มฟังรอบถัดไป (เฉพาะตอนเปิดโหมดเสียง) และปลด hold */
  const relisten = useCallback((delay = 350) => {
    hold.current = false;
    if (!voiceOnRef.current) return;
    clearTimeout(relistenTimer.current);
    relistenTimer.current = setTimeout(() => {
      relistenTimer.current = undefined;
      if (!voiceOnRef.current || hold.current || stopListenRef.current) return;
      void startMicRef.current?.();
    }, delay);
  }, []);

  const wake = useCallback(() => {
    awakeUntil.current = Date.now() + AWAKE_MS;
    setAwake(true);
    clearTimeout(awakeTimer.current);
    awakeTimer.current = setTimeout(() => setAwake(false), AWAKE_MS);
  }, []);

  const sleep = useCallback(() => {
    awakeUntil.current = 0;
    clearTimeout(awakeTimer.current);
    setAwake(false);
  }, []);

  const say = useCallback(
    (text: string, emotion: Emotion, onDone?: () => void) => {
      setEmotion(emotion);
      const hands = voiceOnRef.current;
      if (hands) {
        // น้องกำลังจะพูด → ปิดไมค์ทิ้งก่อน กันไมค์ได้ยินเสียงตัวเอง (โดยเฉพาะประโยคที่มีคำว่า "น้องลิ้นจี่")
        hold.current = true;
        holdSince.current = Date.now();
        stopListening(true);
      }
      const done = () => {
        onDone?.();
        if (hands) relisten();
      };
      if (!live.current.ttsOn || !isTTSSupported()) {
        setActivity('idle');
        done();
        // กลับเป็นยิ้มหลังโชว์อารมณ์สักครู่
        setTimeout(() => mascotBus.activity === 'idle' && setEmotion('HAPPY'), 3500);
        return;
      }
      void speakThai(text, {
        onStart: () => {
          setSpeaking(true);
          setActivity('speaking');
        },
        onEnd: () => {
          idleSoon();
          done();
        },
      });
    },
    [idleSoon, relisten, stopListening],
  );

  const disableVoice = useCallback(() => {
    voiceOnRef.current = false;
    setVoiceMode(false);
    clearTimeout(relistenTimer.current);
    relistenTimer.current = undefined;
    hold.current = false;
    quickEnds.current = 0;
    sleep();
    stopListening(true);
  }, [sleep, stopListening]);

  const clear = useCallback(() => {
    stopSpeaking();
    stopListening(true);
    idleSoon();
    setMessages([]);
  }, [idleSoon, stopListening]);

  /** ตอบด้วยข้อความ+เสียง โดยแสดงในแชทเป็นข้อความ "คำสั่งเสียง" */
  const reply = useCallback(
    (heard: string | null, text: string, emotion: Emotion, after?: () => void) => {
      const add: Message[] = [];
      if (heard) add.push({ id: seq++, role: 'user', text: heard, kind: 'command' });
      add.push({ id: seq++, role: 'assistant', text, emotion, topic: 'คำสั่งเสียง', kind: 'command' });
      setMessages((m) => [...m, ...add]);
      say(text, emotion, after);
    },
    [say],
  );

  const runCommand = useCallback(
    (cmd: VoiceCommand, heard: string, after?: () => void) => {
      switch (cmd.type) {
        case 'clear':
          clear();
          reply(null, 'ล้างการสนทนาแล้วค่ะ เริ่มคุยกันใหม่ได้เลยนะคะ', 'HAPPY', after);
          return;
        case 'mode':
          setMode(cmd.mode);
          reply(
            heard,
            cmd.mode === 'TUTOR'
              ? 'เปลี่ยนเป็นโหมดติวเตอร์แล้วค่ะ ส่งโจทย์หรือเรื่องที่อยากเรียนมาได้เลยนะคะ'
              : 'กลับสู่โหมดข้อมูลโรงเรียนแล้วค่ะ อยากรู้เรื่องอะไรถามได้เลยนะคะ',
            'HAPPY',
            after,
          );
          return;
        case 'role':
          setRole(cmd.role);
          reply(heard, `รับทราบค่ะ ตอนนี้น้องลิ้นจี่คุยกับ${cmd.role === 'ทั่วไป' ? 'คนทั่วไป' : cmd.role}นะคะ`, 'HAPPY', after);
          return;
        case 'mute':
          // ตอบเป็นข้อความแล้วค่อยปิดเสียง (ปิดเสียงทันทีจะไม่มีเสียงยืนยัน)
          setMessages((m) => [...m, { id: seq++, role: 'user', text: heard, kind: 'command' }, { id: seq++, role: 'assistant', text: 'ปิดเสียงพูดแล้วค่ะ (บอก "เปิดเสียง" เพื่อเปิดใหม่)', emotion: 'HAPPY', topic: 'คำสั่งเสียง', kind: 'command' }]);
          live.current.ttsOn = false;
          setTtsOn(false);
          stopSpeaking();
          idleSoon();
          after?.();
          if (voiceOnRef.current) relisten();
          return;
        case 'unmute':
          live.current.ttsOn = true;
          setTtsOn(true);
          reply(heard, 'เปิดเสียงพูดแล้วค่ะ', 'HAPPY', after);
          return;
        case 'repeat': {
          const last = [...live.current.messages].reverse().find((m) => m.role === 'assistant' && !m.kind);
          if (last) reply(heard, last.text, last.emotion ?? 'HAPPY', after);
          else reply(heard, 'ยังไม่มีคำตอบให้พูดซ้ำค่ะ ลองถามน้องลิ้นจี่ก่อนนะคะ', 'SAD', after);
          return;
        }
        case 'goodbye':
          sleep();
          reply(heard, 'ไว้คุยกันใหม่นะคะ เรียกชื่อน้องลิ้นจี่ได้ตลอดเลยค่ะ', 'WAVE', after);
          return;
        case 'voiceOff':
          setMessages((m) => [...m, { id: seq++, role: 'user', text: heard, kind: 'command' }, { id: seq++, role: 'assistant', text: 'ปิดโหมดสั่งงานด้วยเสียงแล้วค่ะ', emotion: 'HAPPY', topic: 'คำสั่งเสียง', kind: 'command' }]);
          disableVoice();
          say('ปิดโหมดสั่งงานด้วยเสียงแล้วค่ะ', 'HAPPY', after);
          return;
        case 'emotion':
          reply(heard, cmd.say, cmd.emotion, after);
          return;
        case 'help':
          reply(heard, VOICE_HELP, 'HAPPY', after);
          return;
      }
    },
    [clear, disableVoice, idleSoon, relisten, reply, say, sleep],
  );

  const ask = useCallback(
    async (text: string, after?: () => void) => {
      const q = text.trim();
      if (!q || live.current.busy) {
        after?.();
        if (voiceOnRef.current) relisten();
        return;
      }
      stopSpeaking();
      stopListening();
      setNotice('');
      const history: ChatTurn[] = live.current.messages
        .filter((m) => !m.kind)
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));
      setMessages((m) => [...m, { id: seq++, role: 'user', text: q }]);
      setBusy(true);
      setActivity('thinking');
      setEmotion('THINKING');
      try {
        const r = await askMascot({ question: q, mode: live.current.mode, role: live.current.role, channel, history });
        setMessages((m) => [
          ...m,
          {
            id: seq++,
            role: 'assistant',
            text: r.answer,
            emotion: r.emotion,
            topic: r.topic_tag,
            via: r.via,
            sources: r.sources.map((s) => s.file_name),
          },
        ]);
        say(r.answer, r.emotion, after);
      } catch (e) {
        console.error(e);
        const msg = 'ขออภัยค่ะ น้องลิ้นจี่ขัดข้องชั่วคราว ลองถามใหม่อีกครั้งนะคะ';
        setMessages((m) => [...m, { id: seq++, role: 'assistant', text: msg, emotion: 'SAD' }]);
        say(msg, 'SAD', after);
      } finally {
        setBusy(false);
      }
    },
    [channel, relisten, say, stopListening],
  );

  /** ประมวลผลประโยคที่ได้ยิน: คำสั่งเสียง / เรียกชื่ออย่างเดียว / คำถาม */
  const handleHeard = (heard: string, after?: () => void) => {
    const p = parseUtterance(heard);
    const hands = voiceOnRef.current;
    const inConversation = !requireWakeWord || Date.now() < awakeUntil.current;
    // โหมดเสียง + ยังไม่เรียกชื่อ + ไม่อยู่ในช่วงสนทนา → ถือเป็นเสียงรอบข้าง ข้ามไป (ไม่ hold → ฟังรอบใหม่ต่อ)
    if (hands && !inConversation && !p.wake) return;

    if (hands) {
      hold.current = true;
      holdSince.current = Date.now();
      wake();
    }
    setNotice('');

    if (p.command) {
      runCommand(p.command, p.text || heard, after);
      return;
    }
    if (!p.text) {
      // เรียกชื่ออย่างเดียว → ขานรับแล้วรอฟังคำถาม
      reply(null, 'ค่ะ น้องลิ้นจี่อยู่ตรงนี้ค่ะ มีอะไรให้ช่วยคะ', 'WAVE', after);
      return;
    }
    void ask(p.text, after);
  };
  handleHeardRef.current = handleHeard;

  const startMic = useCallback(
    async (after?: () => void) => {
      if (!isSTTSupported()) {
        setNotice('เบราว์เซอร์นี้ยังไม่รองรับการรับเสียงพูด แนะนำให้ใช้ Google Chrome หรือ Edge');
        return;
      }
      if (stopListenRef.current) return; // กำลังฟังอยู่แล้ว
      stopSpeaking();
      setNotice('');
      const hands = voiceOnRef.current;
      // active = ไมค์ที่ "ตั้งใจฟังเรา" (กดไมค์เอง หรืออยู่ในช่วงสนทนา) / ไม่ active = รอได้ยินชื่อเรียก
      const active = !hands || !requireWakeWord || Date.now() < awakeUntil.current;
      setListening(active);
      setStandby(!active);
      if (active) {
        setActivity('listening');
        setEmotion('HAPPY');
        void meter.current.start(); // Web Audio AnalyserNode: ระดับเสียงจริง -> ท่าทางน้อง
      }
      lastError.current = '';
      startedAt.current = Date.now();
      let gotFinal = false;
      stopListenRef.current = startListening({
        onInterim: (t) => {
          if (active || hasWakeWord(t)) setInterim(t);
        },
        onFinal: (t) => {
          gotFinal = true;
          handleHeardRef.current(t, after);
        },
        onEnd: () => {
          stopListenRef.current = null;
          meter.current.stop();
          setListening(false);
          setStandby(false);
          setInterim('');
          if (mascotBus.activity === 'listening') setActivity('idle');
          if (!voiceOnRef.current) return;

          // กันลูปหมุนเร็วผิดปกติ (ไมค์ใช้ไม่ได้ / ถูกขัดจังหวะซ้ำๆ)
          const quick = !hold.current && Date.now() - startedAt.current < 800 && !gotFinal;
          quickEnds.current = quick ? quickEnds.current + 1 : 0;
          if (quickEnds.current >= 8) {
            setNotice('ไมโครโฟนทำงานผิดปกติ จึงปิดโหมดสั่งงานด้วยเสียงชั่วคราว ลองเปิดใหม่อีกครั้งนะคะ');
            disableVoice();
            return;
          }
          if (!hold.current) relisten(lastError.current === 'no-speech' ? 250 : quick ? 900 : 350);
        },
        onError: (code) => {
          lastError.current = code;
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            setNotice('กรุณาอนุญาตการใช้ไมโครโฟนในเบราว์เซอร์ (และเปิดผ่าน localhost หรือ HTTPS)');
            if (voiceOnRef.current) disableVoice();
          } else if (code === 'audio-capture') {
            setNotice('ไม่พบไมโครโฟน ตรวจสอบการเชื่อมต่ออุปกรณ์ด้วยนะคะ');
            if (voiceOnRef.current) disableVoice();
          } else if (code === 'network') {
            setNotice('บริการรับเสียงต้องใช้อินเทอร์เน็ต ตรวจสอบการเชื่อมต่อด้วยนะคะ');
            if (voiceOnRef.current) disableVoice();
          } else if (code === 'no-speech') {
            if (!voiceOnRef.current) setNotice('น้องลิ้นจี่ไม่ได้ยินเสียง ลองพูดอีกครั้งนะคะ');
          }
        },
      });
    },
    [disableVoice, relisten, requireWakeWord],
  );
  startMicRef.current = startMic;

  /** เปิดโหมดสั่งงานด้วยเสียง (ต้องเรียกจากการแตะ/คลิกของผู้ใช้ เพราะเบราว์เซอร์บังคับสำหรับเสียงพูด) */
  const enableVoice = useCallback(
    (announce?: string): boolean => {
      if (!isSTTSupported()) {
        setNotice('เบราว์เซอร์นี้ยังไม่รองรับการรับเสียงพูด แนะนำให้ใช้ Google Chrome หรือ Edge');
        return false;
      }
      if (voiceOnRef.current) return true;
      voiceOnRef.current = true;
      quickEnds.current = 0;
      setVoiceMode(true);
      setNotice('');
      wake(); // ให้ถามได้ทันทีโดยยังไม่ต้องเรียกชื่อ
      const text =
        announce ?? (requireWakeWord ? 'เปิดโหมดสั่งงานด้วยเสียงแล้วค่ะ พูดถามได้เลย หรือเรียกชื่อน้องลิ้นจี่ก่อนก็ได้นะคะ' : 'เปิดโหมดสั่งงานด้วยเสียงแล้วค่ะ พูดถามได้เลยนะคะ');
      reply(null, text, 'WAVE', () => relisten(150));
      return true;
    },
    [relisten, reply, requireWakeWord, wake],
  );

  const toggleVoice = useCallback(() => {
    if (voiceOnRef.current) {
      stopSpeaking();
      idleSoon();
      disableVoice();
    } else enableVoice();
  }, [disableVoice, enableVoice, idleSoon]);

  const toggleMic = useCallback(() => {
    if (voiceOnRef.current) {
      // กดไมค์ระหว่างโหมดเสียง = หยุดฟังต่อเนื่อง
      stopSpeaking();
      idleSoon();
      disableVoice();
    } else if (stopListenRef.current) stopListening();
    else void startMic();
  }, [disableVoice, idleSoon, startMic, stopListening]);

  const toggleTts = useCallback(() => {
    setTtsOn((v) => {
      if (v) {
        stopSpeaking();
        idleSoon();
      }
      return !v;
    });
  }, [idleSoon]);

  // Watchdog: โหมดเสียงต้องไม่ "เงียบหาย" (เช่น TTS ของเบราว์เซอร์ไม่ยิง onend) → เริ่มฟังใหม่เองถ้าค้างนานผิดปกติ
  useEffect(() => {
    if (!voiceMode) return;
    const id = setInterval(() => {
      if (!voiceOnRef.current || stopListenRef.current || relistenTimer.current || live.current.busy) return;
      if (isTTSSupported() && speechSynthesis.speaking) {
        holdSince.current = Date.now();
        return;
      }
      if (hold.current && Date.now() - holdSince.current < HOLD_TIMEOUT_MS) return;
      relisten(0);
    }, 3000);
    return () => clearInterval(id);
  }, [voiceMode, relisten]);

  useEffect(
    () => () => {
      voiceOnRef.current = false;
      clearTimeout(relistenTimer.current);
      clearTimeout(awakeTimer.current);
      stopSpeaking();
      stopListenRef.current?.(true);
      meter.current.stop();
      setActivity('idle');
      setEmotion('HAPPY');
    },
    [],
  );

  return {
    messages, mode, setMode, role, setRole, busy, listening, interim, speaking, ttsOn, notice,
    voiceMode, awake, standby, voiceSupported: isSTTSupported(),
    ask, say, startMic, stopListening, toggleMic, toggleTts, clear, setNotice,
    enableVoice, toggleVoice, disableVoice, wake, sleep,
  };
}
