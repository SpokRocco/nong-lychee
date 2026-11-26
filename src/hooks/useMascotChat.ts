import { useCallback, useEffect, useRef, useState } from 'react';
import { askMascot, type ChatTurn } from '../lib/ai';
import type { Channel, Mode, UserRole } from '../lib/config';
import { mascotBus, setActivity, setEmotion, type Emotion } from '../lib/mascotBus';
import { MicMeter } from '../lib/audioMeter';
import { isSTTSupported, isTTSSupported, speakThai, startListening, stopSpeaking } from '../lib/speech';

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  emotion?: Emotion;
  topic?: string;
  via?: string;
  sources?: string[];
}

interface Options {
  channel: Channel;
  initialMode?: Mode;
}

let seq = 1;

export function useMascotChat({ channel, initialMode = 'SCHOOL_INFO' }: Options) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<UserRole>('ทั่วไป');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [ttsOn, setTtsOn] = useState(true);
  const [notice, setNotice] = useState('');

  const stopListenRef = useRef<(() => void) | null>(null);
  const meter = useRef(new MicMeter());
  const live = useRef({ messages, mode, role, ttsOn, busy });
  live.current = { messages, mode, role, ttsOn, busy };

  const idleSoon = useCallback(() => {
    setSpeaking(false);
    setActivity('idle');
    setEmotion('HAPPY');
  }, []);

  const say = useCallback(
    (text: string, emotion: Emotion, onDone?: () => void) => {
      setEmotion(emotion);
      if (!live.current.ttsOn || !isTTSSupported()) {
        setActivity('idle');
        onDone?.();
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
          onDone?.();
        },
      });
    },
    [idleSoon],
  );

  const stopListening = useCallback(() => {
    stopListenRef.current?.();
    stopListenRef.current = null;
    meter.current.stop();
    setListening(false);
    setInterim('');
    if (mascotBus.activity === 'listening') setActivity('idle');
  }, []);

  const ask = useCallback(
    async (text: string, after?: () => void) => {
      const q = text.trim();
      if (!q || live.current.busy) return;
      stopSpeaking();
      stopListening();
      setNotice('');
      const history: ChatTurn[] = live.current.messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
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
    [channel, say, stopListening],
  );

  const startMic = useCallback(
    async (after?: () => void) => {
      if (!isSTTSupported()) {
        setNotice('เบราว์เซอร์นี้ยังไม่รองรับการรับเสียงพูด แนะนำให้ใช้ Google Chrome หรือ Edge');
        return;
      }
      stopSpeaking();
      setNotice('');
      setListening(true);
      setActivity('listening');
      setEmotion('HAPPY');
      void meter.current.start(); // Web Audio AnalyserNode: ระดับเสียงจริง -> ท่าทางน้อง
      stopListenRef.current = startListening({
        onInterim: setInterim,
        onFinal: (t) => void ask(t, after),
        onEnd: () => {
          stopListenRef.current = null;
          meter.current.stop();
          setListening(false);
          setInterim('');
          if (mascotBus.activity === 'listening') setActivity('idle');
        },
        onError: (code) => {
          if (code === 'not-allowed' || code === 'service-not-allowed') setNotice('กรุณาอนุญาตการใช้ไมโครโฟนในเบราว์เซอร์');
          else if (code === 'no-speech') setNotice('น้องลิ้นจี่ไม่ได้ยินเสียง ลองพูดอีกครั้งนะคะ');
          else if (code === 'network') setNotice('บริการรับเสียงต้องใช้อินเทอร์เน็ต ตรวจสอบการเชื่อมต่อด้วยนะคะ');
        },
      });
    },
    [ask],
  );

  const toggleMic = useCallback(() => {
    if (listening) stopListening();
    else void startMic();
  }, [listening, startMic, stopListening]);

  const toggleTts = useCallback(() => {
    setTtsOn((v) => {
      if (v) {
        stopSpeaking();
        idleSoon();
      }
      return !v;
    });
  }, [idleSoon]);

  const clear = useCallback(() => {
    stopSpeaking();
    stopListening();
    idleSoon();
    setMessages([]);
  }, [idleSoon, stopListening]);

  useEffect(
    () => () => {
      stopSpeaking();
      stopListenRef.current?.();
      meter.current.stop();
      setActivity('idle');
      setEmotion('HAPPY');
    },
    [],
  );

  return {
    messages, mode, setMode, role, setRole, busy, listening, interim, speaking, ttsOn, notice,
    ask, say, startMic, stopListening, toggleMic, toggleTts, clear, setNotice,
  };
}
