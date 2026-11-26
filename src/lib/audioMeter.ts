import { mascotBus } from './mascotBus';

/**
 * ตรวจจับระดับเสียงไมโครโฟนด้วย Web Audio API (AnalyserNode)
 * ค่า RMS ถูกเขียนลง mascotBus.micLevel เพื่อให้น้องลิ้นจี่ "ตั้งใจฟัง" ขยับตามเสียงผู้พูดจริง
 *
 * ข้อจำกัดของเบราว์เซอร์: เสียงจาก speechSynthesis ไม่สามารถส่งเข้า AnalyserNode ได้
 * ตอนน้องพูดจึงใช้ boundary event + envelope สำรองใน Mascot3D แทน
 */
export class MicMeter {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private running = false;

  async start(): Promise<boolean> {
    if (this.running) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      return false;
    }
    const AC: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
    this.ctx = new AC();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const target = Math.min(1, rms * 5);
      mascotBus.micLevel += (target - mascotBus.micLevel) * 0.35;
      this.raf = requestAnimationFrame(tick);
    };
    tick();
    return true;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    mascotBus.micLevel = 0;
  }
}
