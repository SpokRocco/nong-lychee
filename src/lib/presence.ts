import { ENV } from './config';

/**
 * ตรวจจับคนเดินผ่าน/เข้าใกล้ป้าย Smart Kiosk "ในเบราว์เซอร์ทั้งหมด"
 *  - ใช้ MediaPipe Face Detector (@mediapipe/tasks-vision) ตรวจใบหน้า (ไม่ระบุตัวตน ไม่จดจำใบหน้า)
 *  - ถ้าโหลดโมเดลไม่ได้ (เช่น ออฟไลน์) จะสลับไปตรวจการเคลื่อนไหวด้วย frame difference ภาพเล็ก 64x48
 *  - ไม่บันทึก ไม่อัปโหลด ไม่แสดงภาพ: เฟรมถูกอ่านแล้วทิ้งทันที เก็บเพียงอาร์เรย์ความสว่างเฟรมก่อนหน้าในหน่วยความจำ
 */
export type PresenceMode = 'mediapipe' | 'motion';

export interface PresenceHandle {
  mode: PresenceMode;
  stop: () => void;
}

export interface PresenceOptions {
  onArrive: () => void;
  onLeave: () => void;
  onStatus?: (present: boolean) => void;
}

const SCAN_INTERVAL_MS = 200;
const ABSENT_AFTER_MS = 5000;

export async function startPresence(opts: PresenceOptions): Promise<PresenceHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
    audio: false,
  });
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  let detect: () => boolean;
  let mode: PresenceMode;

  try {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(ENV.mediapipeWasm);
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: ENV.mediapipeFaceModel, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.6,
      });
    let detector;
    try {
      detector = await make('GPU');
    } catch {
      detector = await make('CPU');
    }
    detect = () => detector.detectForVideo(video, performance.now()).detections.length > 0;
    mode = 'mediapipe';
  } catch (e) {
    console.warn('MediaPipe unavailable, using motion detection', e);
    const W = 64;
    const H = 48;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let prev: Uint8Array | null = null;
    detect = () => {
      ctx.drawImage(video, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const cur = new Uint8Array(W * H);
      for (let i = 0; i < cur.length; i++) cur[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
      let moved = false;
      if (prev) {
        let diff = 0;
        for (let i = 0; i < cur.length; i++) if (Math.abs(cur[i] - prev[i]) > 28) diff++;
        moved = diff / cur.length > 0.03;
      }
      prev = cur;
      return moved;
    };
    mode = 'motion';
  }

  let present = false;
  let lastSeen = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const loop = () => {
    if (stopped) return;
    const now = performance.now();
    try {
      if (video.readyState >= 2 && detect()) lastSeen = now;
    } catch (e) {
      console.warn('presence detect error', e);
    }
    const nowPresent = now - lastSeen < ABSENT_AFTER_MS && lastSeen > 0;
    if (nowPresent !== present) {
      present = nowPresent;
      opts.onStatus?.(present);
      if (present) opts.onArrive();
      else opts.onLeave();
    }
    timer = setTimeout(loop, SCAN_INTERVAL_MS);
  };
  loop();

  return {
    mode,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
