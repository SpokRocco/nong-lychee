import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SCHOOL } from '../lib/config';
import { mascotBus, type Emotion } from '../lib/mascotBus';

/**
 * Procedural 3D Mascot: น้องลิ้นจี่ (โรงเรียนบ้านหาดเค็ด)
 *  - ฮู้ดเปลือกลิ้นจี่สีแดงอมชมพูประดับหนามแหลมรอบใบหน้า กิ๊บติดผมสีเขียว ขั้วก้านพร้อมลูกเล็กและใบลิ้นจี่
 *  - ใบหน้าขาวใส ดวงตาสีน้ำตาลอำพันเป็นประกาย ขนตาโค้ง แก้มอมชมพูละมุน
 *  - ชุดนักเรียนประถมหญิง: เสื้อเชิ้ตขาว โบว์สีกรมท่า กระโปรงจีบสีกรมท่า ถุงเท้าขาว รองเท้าคัทชูดำ
 *    * อกด้านขวาของน้อง (ซ้ายของผู้ชม): ป้ายชื่อปัก "น้องลิ้นจี่" บรรทัดแรก และ "โรงเรียนบ้านหาดเค็ด" บรรทัดที่ 2
 *    * อกด้านซ้ายของน้อง (ขวาของผู้ชม): กระเป๋าเสื้อพร้อมโลโก้โรงเรียนบ้านหาดเค็ด
 *  - ขยับตาม mascotBus: emotion / activity / micLevel / pulse
 */

const SKIN = '#fff3ec';
const LYCHEE_CORAL = '#f04c55';
const LEAF_GREEN = '#64c243';
const LEAF_VEIN = '#b8eb8e';
const NAVY = '#283e74';
const NAVY_DARK = '#1b2b57';

function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1000) / 1000;
}

// โปรไฟล์ครึ่งซีกขวาของตัวเสื้อ (y ตั้งแต่ชายเสื้อ 0.54 ถึงคอเสื้อ 0.99)
const TORSO_Y_MIN = 0.54;
const TORSO_Y_MAX = 0.99;
const TORSO_SCALE_X = 1.15;
const TORSO_SCALE_Z = 0.82;

function torsoRadius(y: number): number {
  const u = THREE.MathUtils.clamp((y - TORSO_Y_MIN) / (TORSO_Y_MAX - TORSO_Y_MIN), 0, 1);
  // ขยายเล็กน้อยที่ชายเสื้อ คอดเอวนุ่มๆ แล้วผายรับช่วงอก ก่อนโค้งเข้าคอเสื้อ
  if (u < 0.26) {
    const t = u / 0.26;
    return THREE.MathUtils.lerp(0.335, 0.312, t * t * (3 - 2 * t));
  }
  if (u < 0.62) {
    const t = (u - 0.26) / 0.36;
    return THREE.MathUtils.lerp(0.312, 0.328, t * t * (3 - 2 * t));
  }
  if (u < 0.84) {
    const t = (u - 0.62) / 0.22;
    return THREE.MathUtils.lerp(0.328, 0.278, t * t);
  }
  const t = (u - 0.84) / 0.16;
  return THREE.MathUtils.lerp(0.278, 0.145, t);
}

/** คำนวณจุดและเวกเตอร์แนวฉากบนผิวด้านหน้าของเสื้อ เพื่อให้ป้ายชื่อและโลโก้แนบสนิทตามความโค้ง */
function torsoFrontPointAndNormal(x: number, y: number, outOffset: number) {
  const r = torsoRadius(y);
  const rx = r * TORSO_SCALE_X;
  const rz = r * TORSO_SCALE_Z;
  const clampedX = THREE.MathUtils.clamp(x, -rx * 0.94, rx * 0.94);
  const z = rz * Math.sqrt(Math.max(0.01, 1 - (clampedX / rx) ** 2));

  const eps = 0.005;
  const rUp = torsoRadius(Math.min(TORSO_Y_MAX, y + eps));
  const rDn = torsoRadius(Math.max(TORSO_Y_MIN, y - eps));
  const drdy = (rUp - rDn) / (2 * eps);

  const nx = clampedX / (rx * rx);
  const nz = z / (rz * rz);
  const ny = -drdy * TORSO_SCALE_Z * (z / (rz * rz)) * 0.45;
  const n = new THREE.Vector3(nx, ny, nz).normalize();

  return {
    pos: new THREE.Vector3(clampedX + n.x * outOffset, y + n.y * outOffset, z + n.z * outOffset),
    normal: n,
  };
}

function buildCurvedTorsoPatchGeo(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  offset: number,
  segX = 14,
  segY = 6,
) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const { pos: p } = torsoFrontPointAndNormal(centerX + lx, centerY + ly, offset);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildShirtGeometry() {
  const pts: THREE.Vector2[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const y = THREE.MathUtils.lerp(TORSO_Y_MIN, TORSO_Y_MAX, i / steps);
    pts.push(new THREE.Vector2(torsoRadius(y), y));
  }
  const geo = new THREE.LatheGeometry(pts, 44);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * TORSO_SCALE_X);
    pos.setZ(i, pos.getZ(i) * TORSO_SCALE_Z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildPleatedSkirtGeometry() {
  const height = 0.31;
  const rTop = 0.295;
  const rBottom = 0.415;
  const radialSegs = 112;
  const heightSegs = 8;
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, radialSegs, heightSegs, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const pleats = 16;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rXZ = Math.hypot(x, z);
    if (rXZ < 0.001) continue;

    // t: 0 ที่ขอบเอวบน, 1 ที่ชายกระโปรงล่าง
    const t = THREE.MathUtils.clamp((height / 2 - y) / height, 0, 1);
    const angle = Math.atan2(z, x);
    // จีบแบบกระโปรงนักเรียน (คลื่นคมขึ้นด้วย harmonic ผสม)
    const wave = Math.sin(angle * pleats) * 0.78 + Math.sin(angle * pleats * 2 - Math.PI / 2) * 0.22;
    const pleatDepth = wave * 0.022 * Math.pow(t, 0.85);
    const rxScale = 1.13;
    const rzScale = 0.88;
    const newR = rXZ + pleatDepth;
    pos.setX(i, (x / rXZ) * newR * rxScale);
    pos.setZ(i, (z / rXZ) * newR * rzScale);
  }
  geo.computeVertexNormals();
  return geo;
}

interface SpikeData {
  matrix: THREE.Matrix4;
  color: THREE.Color;
}

const HAIRCLIP_POS = new THREE.Vector3(-0.31, 0.495, 0.355);

function buildLycheeSpikes(): SpikeData[] {
  const count = 250;
  const hoodCenter = new THREE.Vector3(0, 0.02, -0.12);
  const hoodRx = 0.74;
  const hoodRy = 0.71;
  const hoodRz = 0.71;

  const faceCenter = new THREE.Vector3(0, -0.02, 0.14);
  const faceRx = 0.59;
  const faceRy = 0.54;
  const faceRz = 0.55;

  const golden = Math.PI * (3 - Math.sqrt(5));
  const up = new THREE.Vector3(0, 1, 0);
  const results: SpikeData[] = [];

  for (let i = 0; i < count; i++) {
    const ty = 1 - ((i + 0.5) / count) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - ty * ty));
    const theta = golden * i + (hash3(i, 11, 29) - 0.5) * 0.16;
    const ny = ty + (hash3(i, 37, 13) - 0.5) * 0.05;
    const nx = Math.cos(theta) * rad;
    const nz = Math.sin(theta) * rad;

    const dir = new THREE.Vector3(nx, ny, nz).normalize();
    const px = hoodCenter.x + dir.x * hoodRx;
    const py = hoodCenter.y + dir.y * hoodRy;
    const pz = hoodCenter.z + dir.z * hoodRz;

    // ไม่ปักหนามลงบนบริเวณใบหน้า ด้านล่างคอ หรือจุดติดกิ๊บผมสีเขียว
    const faceDist = Math.hypot(
      (px - faceCenter.x) / faceRx,
      (py - faceCenter.y) / faceRy,
      (pz - faceCenter.z) / faceRz,
    );
    if (faceDist < 1.07) continue;
    if (py < -0.54) continue;
    if (Math.hypot(px - HAIRCLIP_POS.x, py - HAIRCLIP_POS.y, pz - HAIRCLIP_POS.z) < 0.14) continue;
    if (dir.y > 0.96 && Math.hypot(px, pz + 0.06) < 0.14) continue;

    const normal = new THREE.Vector3(
      (px - hoodCenter.x) / (hoodRx * hoodRx),
      (py - hoodCenter.y) / (hoodRy * hoodRy),
      (pz - hoodCenter.z) / (hoodRz * hoodRz),
    ).normalize();

    const s = 0.85 + hash3(i, 53, 71) * 0.35;
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    const pos = new THREE.Vector3(px, py, pz).addScaledVector(normal, 0.015);
    const mat = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(s, s * (0.9 + hash3(i, 7, 19) * 0.25), s));

    const tone = hash3(i, 91, 41);
    const color = new THREE.Color('#f24c56').lerp(new THREE.Color('#da3443'), tone * 0.42);
    results.push({ matrix: mat, color });
  }
  return results;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawNameBadgeCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // เงาอ่อนด้านล่างขวาให้ป้ายผ้าเด่นบนเสื้อขาว
  drawRoundedRect(ctx, 10, 12, w - 18, h - 18, 28);
  ctx.fillStyle = 'rgba(25, 42, 86, 0.16)';
  ctx.fill();

  // พื้นป้ายผ้าขาวสะอาด
  drawRoundedRect(ctx, 6, 4, w - 18, h - 18, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#d3dce8';
  ctx.stroke();

  // กรอบเย็บสีกรมท่าด้านใน
  drawRoundedRect(ctx, 18, 16, w - 42, h - 42, 16);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1d346e';
  ctx.stroke();

  const fontStack = '"Prompt", "Loma", "Noto Sans Thai", "Sarabun", "Tahoma", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // บรรทัดแรก: "น้องลิ้นจี่"
  const line1 = SCHOOL.mascotName;
  ctx.fillStyle = '#132452';
  ctx.font = `700 94px ${fontStack}`;
  ctx.fillText(line1, w / 2 - 2, h * 0.35, w - 68);

  // บรรทัดที่ 2: "โรงเรียนบ้านหาดเค็ด"
  const line2 = SCHOOL.name;
  ctx.fillStyle = '#1e3878';
  ctx.font = `700 55px ${fontStack}`;
  ctx.fillText(line2, w / 2 - 2, h * 0.69, w - 58);
}

function createBlushTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 50);
    grad.addColorStop(0, 'rgba(255, 118, 132, 0.9)');
    grad.addColorStop(0.55, 'rgba(255, 138, 150, 0.4)');
    grad.addColorStop(0.88, 'rgba(255, 165, 174, 0)');
    grad.addColorStop(1, 'rgba(255, 165, 174, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPocketTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 280);
    // ทรงกระเป๋าเสื้อนักเรียนมีเส้นขอบเย็บอ่อนๆ
    ctx.beginPath();
    ctx.moveTo(16, 12);
    ctx.lineTo(240, 12);
    ctx.lineTo(240, 185);
    ctx.quadraticCurveTo(232, 240, 128, 266);
    ctx.quadraticCurveTo(24, 240, 16, 185);
    ctx.closePath();
    ctx.fillStyle = '#f6f8fc';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#cfd9e8';
    ctx.stroke();

    // เส้นพับขอบบนกระเป๋า
    ctx.beginPath();
    ctx.moveTo(22, 42);
    ctx.lineTo(234, 42);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = '#d8e1ee';
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildHairClipGeometry() {
  const outer = new THREE.Shape();
  outer.absellipse(0, 0, 0.095, 0.039, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.06, 0.017, 0, Math.PI * 2, true, 0);
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, { depth: 0.014, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 2 });
}

interface Pose {
  mouthSmile: number;
  happyOpenSmile: boolean;
  browL: number;
  browR: number;
  browY: number;
  blush: number;
  armRightZ: number;
  armRightX: number;
  armLeftZ: number;
  armLeftX: number;
  tilt: number;
  eyeUp: number;
  jump: number;
  baseOpen: number;
}

function poseFor(e: Emotion, t: number): Pose {
  const p: Pose = {
    mouthSmile: 1,
    happyOpenSmile: true,
    browL: 0,
    browR: 0,
    browY: 0,
    blush: 0.68,
    armRightZ: -0.14,
    armRightX: 0,
    armLeftZ: 0.14,
    armLeftX: 0,
    tilt: 0,
    eyeUp: 0,
    jump: 0,
    baseOpen: 0,
  };
  switch (e) {
    case 'EXCITED':
      p.blush = 0.88;
      p.browY = 0.03;
      p.armRightZ = -1.95 - Math.sin(t * 9) * 0.18;
      p.armLeftZ = 1.95 + Math.sin(t * 9 + 1) * 0.18;
      p.armRightX = -0.2;
      p.armLeftX = -0.2;
      p.jump = Math.abs(Math.sin(t * 6)) * 0.12;
      break;
    case 'THINKING':
      p.mouthSmile = 0.18;
      p.happyOpenSmile = false;
      p.browR = -0.06;
      p.browL = 0.16;
      p.browY = 0.025;
      p.tilt = -0.13;
      p.eyeUp = 0.022;
      p.armRightZ = 0.65;
      p.armRightX = -1.92;
      p.blush = 0.5;
      break;
    case 'SAD':
      p.mouthSmile = -1;
      p.happyOpenSmile = false;
      p.browL = 0.3;
      p.browR = -0.3;
      p.blush = 0.3;
      p.tilt = -0.07;
      p.armRightZ = -0.06;
      p.armLeftZ = 0.06;
      break;
    case 'SURPRISED':
      p.happyOpenSmile = false;
      p.browY = 0.065;
      p.baseOpen = 0.62;
      p.blush = 0.72;
      p.armRightZ = -1.15;
      p.armRightX = -0.55;
      p.jump = Math.max(0, Math.sin(t * 8)) * 0.04;
      break;
    case 'WAVE':
      p.armRightZ = -1.92 + Math.sin(t * 8) * 0.28;
      p.armRightX = -0.22;
      p.blush = 0.78;
      p.browY = 0.02;
      break;
    default:
      break;
  }
  return p;
}

export function Mascot3D() {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armRight = useRef<THREE.Group>(null);
  const armLeft = useRef<THREE.Group>(null);
  const eyeRight = useRef<THREE.Group>(null);
  const eyeLeft = useRef<THREE.Group>(null);
  const browRight = useRef<THREE.Group>(null);
  const browLeft = useRef<THREE.Group>(null);
  const mouthOpen = useRef<THREE.Group>(null);
  const happySmile = useRef<THREE.Group>(null);
  const smileLine = useRef<THREE.Mesh>(null);
  const cheekRight = useRef<THREE.Mesh>(null);
  const cheekLeft = useRef<THREE.Mesh>(null);
  const leafGroup = useRef<THREE.Group>(null);
  const spikesRef = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ t: 0, nextBlink: 2.2, blink: 0, level: 0, headY: 0, headX: 0 });

  const shirtGeo = useMemo(() => buildShirtGeometry(), []);
  const skirtGeo = useMemo(() => buildPleatedSkirtGeometry(), []);
  const spikes = useMemo(() => buildLycheeSpikes(), []);
  const spikeGeo = useMemo(() => new THREE.CylinderGeometry(0.008, 0.064, 0.115, 5), []);
  const hairClipGeo = useMemo(() => buildHairClipGeometry(), []);
  const blushTex = useMemo(() => createBlushTexture(), []);
  const pocketTex = useMemo(() => createPocketTexture(), []);

  // ป้ายชื่ออกด้านขวาของน้อง (ฝั่งซ้ายเมื่อมองหน้าตรง): บรรทัดแรก "น้องลิ้นจี่", บรรทัดที่ 2 "โรงเรียนบ้านหาดเค็ด"
  const badge = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 264;
    drawNameBadgeCanvas(canvas);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = buildCurvedTorsoPatchGeo(-0.185, 0.76, 0.224, 0.092, 0.011);
    return { canvas, tex, geo };
  }, []);

  // กระเป๋าเสื้อ + โลโก้โรงเรียนอกด้านซ้ายของน้อง (ฝั่งขวาเมื่อมองหน้าตรง)
  const leftChest = useMemo(() => {
    const pocketGeo = buildCurvedTorsoPatchGeo(0.185, 0.735, 0.16, 0.175, 0.007);
    const logoGeo = buildCurvedTorsoPatchGeo(0.185, 0.745, 0.138, 0.138, 0.013);
    const logoTex = new THREE.TextureLoader().load('/logo-hadket-2026.png');
    logoTex.colorSpace = THREE.SRGBColorSpace;
    logoTex.anisotropy = 8;
    return { pocketGeo, logoGeo, logoTex };
  }, []);

  // วาดป้ายชื่อซ้ำเมื่อฟอนต์ Prompt โหลดเสร็จ และทำความสะอาด resource ตอน unmount
  useEffect(() => {
    let active = true;
    document.fonts?.ready.then(() => {
      if (!active) return;
      drawNameBadgeCanvas(badge.canvas);
      badge.tex.needsUpdate = true;
    });
    return () => {
      active = false;
    };
  }, [badge]);

  useEffect(() => {
    return () => {
      shirtGeo.dispose();
      skirtGeo.dispose();
      spikeGeo.dispose();
      hairClipGeo.dispose();
      blushTex.dispose();
      pocketTex.dispose();
      badge.geo.dispose();
      badge.tex.dispose();
      leftChest.pocketGeo.dispose();
      leftChest.logoGeo.dispose();
      leftChest.logoTex.dispose();
    };
  }, [shirtGeo, skirtGeo, spikeGeo, hairClipGeo, blushTex, pocketTex, badge, leftChest]);

  // ตั้งเมทริกซ์และเฉดสีหนามลิ้นจี่ใน InstancedMesh ครั้งเดียว
  useEffect(() => {
    const mesh = spikesRef.current;
    if (!mesh) return;
    spikes.forEach((sp, i) => {
      mesh.setMatrixAt(i, sp.matrix);
      mesh.setColorAt(i, sp.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spikes]);

  useFrame((state, dt) => {
    const s = st.current;
    const d = Math.min(dt, 0.05);
    s.t += d;
    const t = s.t;
    const bus = mascotBus;
    const pose = poseFor(bus.emotion, t);

    // ---- ระดับการอ้าปาก (lip-sync) ----
    let target = 0;
    if (bus.activity === 'speaking') {
      bus.pulse = Math.max(0, bus.pulse - d * 4.5);
      const env = 0.22 + 0.25 * Math.abs(Math.sin(t * 9.5)) * (0.6 + 0.4 * Math.sin(t * 3.1));
      target = Math.min(1, env + bus.pulse * 0.45);
    } else if (bus.activity === 'listening') {
      target = bus.micLevel * 0.9;
    }
    s.level = THREE.MathUtils.damp(s.level, target, 18, d);
    const openAmt = Math.max(s.level, pose.baseOpen * (bus.activity === 'speaking' ? 0.6 : 1));

    // ---- ตัว / ลอย / กระโดด ----
    if (root.current) {
      root.current.position.y = Math.sin(t * 2) * 0.025 + pose.jump;
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, state.pointer.x * 0.25, 4, d);
    }

    // ---- หัวมองตามเมาส์ + เอียงตามอารมณ์ ----
    if (head.current) {
      const thinkingUp = bus.activity === 'thinking' ? -0.12 : 0;
      s.headY = THREE.MathUtils.damp(s.headY, state.pointer.x * 0.35, 5, d);
      s.headX = THREE.MathUtils.damp(s.headX, -state.pointer.y * 0.2 + thinkingUp, 5, d);
      head.current.rotation.y = s.headY;
      head.current.rotation.x = s.headX + (bus.activity === 'listening' ? Math.sin(t * 3) * 0.03 : 0);
      head.current.rotation.z = THREE.MathUtils.damp(head.current.rotation.z, pose.tilt + Math.sin(t * 1.3) * 0.018, 6, d);
    }

    // ---- กระพริบตา ----
    s.nextBlink -= d;
    if (s.nextBlink <= 0) {
      s.blink = 0.13;
      s.nextBlink = 2.2 + Math.random() * 2.8;
    }
    s.blink = Math.max(0, s.blink - d);
    const eyeScaleY = s.blink > 0 ? 0.08 : bus.emotion === 'SURPRISED' ? 1.15 : bus.emotion === 'EXCITED' ? 1.06 : 1;
    for (const e of [eyeRight.current, eyeLeft.current]) {
      if (!e) continue;
      e.scale.y = THREE.MathUtils.damp(e.scale.y, eyeScaleY, 32, d);
      e.position.y = 0.035 + pose.eyeUp;
    }

    // ---- คิ้ว ----
    if (browRight.current && browLeft.current) {
      browRight.current.rotation.z = THREE.MathUtils.damp(browRight.current.rotation.z, pose.browR, 10, d);
      browLeft.current.rotation.z = THREE.MathUtils.damp(browLeft.current.rotation.z, pose.browL, 10, d);
      browRight.current.position.y = THREE.MathUtils.damp(browRight.current.position.y, 0.205 + pose.browY, 10, d);
      browLeft.current.position.y = THREE.MathUtils.damp(browLeft.current.position.y, 0.205 + pose.browY, 10, d);
    }

    // ---- ปาก ----
    const speakingOrSurprised = openAmt > 0.08;
    if (mouthOpen.current) {
      mouthOpen.current.visible = speakingOrSurprised;
      const w = bus.emotion === 'SURPRISED' ? 0.68 : 1;
      mouthOpen.current.scale.set(w, 0.22 + openAmt * 0.95, 0.65);
    }
    if (happySmile.current) {
      happySmile.current.visible = !speakingOrSurprised && pose.happyOpenSmile;
    }
    if (smileLine.current) {
      smileLine.current.visible = !speakingOrSurprised && !pose.happyOpenSmile;
      smileLine.current.rotation.z = pose.mouthSmile >= 0 ? Math.PI : 0;
      const k = 0.4 + Math.abs(pose.mouthSmile) * 0.55;
      smileLine.current.scale.set(k, k, 1);
      smileLine.current.position.y = pose.mouthSmile >= 0 ? 0.02 : -0.02;
    }

    // ---- แก้มชมพู ----
    for (const c of [cheekRight.current, cheekLeft.current]) {
      if (c) {
        (c.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.damp(
          (c.material as THREE.MeshBasicMaterial).opacity,
          pose.blush,
          6,
          d,
        );
      }
    }

    // ---- แขน ----
    if (armRight.current) {
      armRight.current.rotation.z = THREE.MathUtils.damp(armRight.current.rotation.z, pose.armRightZ, 9, d);
      armRight.current.rotation.x = THREE.MathUtils.damp(armRight.current.rotation.x, pose.armRightX, 9, d);
    }
    if (armLeft.current) {
      armLeft.current.rotation.z = THREE.MathUtils.damp(armLeft.current.rotation.z, pose.armLeftZ, 9, d);
      armLeft.current.rotation.x = THREE.MathUtils.damp(armLeft.current.rotation.x, pose.armLeftX, 9, d);
    }

    // ---- ใบลิ้นจี่ด้านบนแกว่งเบาๆ ----
    if (leafGroup.current) {
      leafGroup.current.rotation.z = -0.18 + Math.sin(t * 2.1) * 0.06 + (bus.emotion === 'EXCITED' ? Math.sin(t * 11) * 0.07 : 0);
    }
  });

  // จุดกึ่งกลางผิวเสื้อสำหรับโบว์และกระดุม
  const bowMount = useMemo(() => torsoFrontPointAndNormal(0, 0.89, 0.018), []);
  const btn1Mount = useMemo(() => torsoFrontPointAndNormal(0, 0.775, 0.009), []);
  const btn2Mount = useMemo(() => torsoFrontPointAndNormal(0, 0.67, 0.009), []);
  const placketGeo = useMemo(() => buildCurvedTorsoPatchGeo(0, 0.74, 0.044, 0.34, 0.006, 8, 8), []);

  useEffect(() => {
    return () => placketGeo.dispose();
  }, [placketGeo]);

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* ===== ขา / ถุงเท้าขาว / รองเท้าคัทชูนักเรียนหญิง ===== */}
      {[-0.135, 0.135].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.076, 0.072, 0.22, 16]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
          </mesh>
          <mesh position={[0, 0.115, 0]}>
            <cylinderGeometry args={[0.08, 0.085, 0.13, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.178, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.078, 0.014, 8, 20]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.04, 0.036]} scale={[1, 0.56, 1.48]}>
            <sphereGeometry args={[0.098, 20, 14]} />
            <meshStandardMaterial color="#232328" roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.072, 0.025]} rotation={[0.45, 0, 0]} scale={[1.02, 0.55, 0.45]}>
            <torusGeometry args={[0.084, 0.015, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#18181c" roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ===== กระโปรงจีบสีกรมท่า ===== */}
      <mesh geometry={skirtGeo} position={[0, 0.425, 0]}>
        <meshStandardMaterial color={NAVY} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.565, 0]} scale={[1.13, 1, 0.88]}>
        <cylinderGeometry args={[0.295, 0.298, 0.055, 36]} />
        <meshStandardMaterial color={NAVY_DARK} roughness={0.8} />
      </mesh>

      {/* ===== เสื้อนักเรียนหญิงสีขาว ===== */}
      <mesh geometry={shirtGeo}>
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>
      <mesh geometry={placketGeo}>
        <meshStandardMaterial color="#f2f6fc" roughness={0.85} />
      </mesh>
      {[btn1Mount, btn2Mount].map((m, idx) => (
        <mesh key={idx} position={[m.pos.x, m.pos.y, m.pos.z]} scale={[1, 1, 0.45]}>
          <sphereGeometry args={[0.013, 12, 10]} />
          <meshStandardMaterial color="#e8eef6" roughness={0.35} />
        </mesh>
      ))}

      {/* คอ + ปกเสื้อสีขาว */}
      <mesh position={[0, 1.03, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.16, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.11, 0.96, 0.14]}
          rotation={[0.42, side * -0.4, side * -0.25]}
          scale={[1.15, 0.72, 0.26]}
        >
          <sphereGeometry args={[0.095, 18, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.78} />
        </mesh>
      ))}

      {/* ===== โบว์นักเรียนสีกรมท่าตรงกลางคอเสื้อ ===== */}
      <group position={[bowMount.pos.x, bowMount.pos.y, bowMount.pos.z]} rotation={[0.08, 0, 0]} scale={1.15}>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.048, 0.006, 0]}
            rotation={[0, side * -0.18, side * 0.22]}
            scale={[1.45, 0.85, 0.5]}
          >
            <sphereGeometry args={[0.036, 16, 12]} />
            <meshStandardMaterial color={NAVY_DARK} roughness={0.6} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`tail-${side}`} position={[side * 0.032, -0.048, -0.003]} rotation={[0.08, 0, side * 0.24]} scale={[1, 1, 0.45]}>
            <boxGeometry args={[0.028, 0.09, 0.018]} />
            <meshStandardMaterial color={NAVY_DARK} roughness={0.6} />
          </mesh>
        ))}
        <mesh scale={[1.05, 0.92, 0.8]}>
          <sphereGeometry args={[0.021, 14, 10]} />
          <meshStandardMaterial color="#213467" roughness={0.55} />
        </mesh>
      </group>

      {/* ===== อกด้านขวาของน้อง (ซ้ายผู้ชม): ป้ายชื่อ "น้องลิ้นจี่ / โรงเรียนบ้านหาดเค็ด" ===== */}
      <mesh geometry={badge.geo}>
        <meshStandardMaterial
          map={badge.tex}
          emissiveMap={badge.tex}
          emissive="#ffffff"
          emissiveIntensity={0.25}
          roughness={0.6}
          transparent
        />
      </mesh>

      {/* ===== อกด้านซ้ายของน้อง (ขวาผู้ชม): กระเป๋าเสื้อ + โลโก้โรงเรียนบ้านหาดเค็ด ===== */}
      <mesh geometry={leftChest.pocketGeo}>
        <meshStandardMaterial map={pocketTex} roughness={0.8} transparent />
      </mesh>
      <mesh geometry={leftChest.logoGeo}>
        <meshStandardMaterial map={leftChest.logoTex} roughness={0.5} transparent alphaTest={0.05} />
      </mesh>

      {/* ===== แขนขวา (อยู่ฝั่งซ้ายผู้ชม: ใช้โบกมือและเท้าคาง) ===== */}
      <group ref={armRight} position={[-0.365, 0.895, 0.01]}>
        <mesh position={[-0.004, 0.0, 0]} scale={[1, 0.88, 1]}>
          <sphereGeometry args={[0.084, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        <mesh position={[-0.02, -0.075, 0]} rotation={[0, 0, -0.22]}>
          <cylinderGeometry args={[0.082, 0.108, 0.175, 18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        <mesh position={[-0.04, -0.22, 0]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.064, 0.15, 8, 14]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
        </mesh>
        <mesh position={[-0.055, -0.34, 0.008]} scale={[1.04, 1.0, 0.9]}>
          <sphereGeometry args={[0.074, 16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
        </mesh>
        <mesh position={[0.005, -0.315, 0.04]} rotation={[0, 0, -0.5]} scale={[0.9, 1.15, 0.85]}>
          <sphereGeometry args={[0.026, 10, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
        </mesh>
      </group>

      {/* ===== แขนซ้าย (อยู่ฝั่งขวาผู้ชม) ===== */}
      <group ref={armLeft} position={[0.365, 0.895, 0.01]}>
        <mesh position={[0.004, 0.0, 0]} scale={[1, 0.88, 1]}>
          <sphereGeometry args={[0.084, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        <mesh position={[0.02, -0.075, 0]} rotation={[0, 0, 0.22]}>
          <cylinderGeometry args={[0.082, 0.108, 0.175, 18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        <mesh position={[0.04, -0.22, 0]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.064, 0.15, 8, 14]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
        </mesh>
        <mesh position={[0.055, -0.34, 0.008]} scale={[1.04, 1.0, 0.9]}>
          <sphereGeometry args={[0.074, 16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
        </mesh>
        <mesh position={[-0.005, -0.315, 0.04]} rotation={[0, 0, 0.5]} scale={[0.9, 1.15, 0.85]}>
          <sphereGeometry args={[0.026, 10, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffccb8" emissiveIntensity={0.14} />
        </mesh>
      </group>

      {/* ===== ศีรษะและฮู้ดลิ้นจี่ ===== */}
      <group ref={head} position={[0, 1.61, 0]}>
        {/* ใบหน้าขาวใสโทนอุ่น */}
        <mesh position={[0, -0.02, 0.14]} scale={[1.07, 0.96, 0.98]}>
          <sphereGeometry args={[0.55, 44, 36]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} emissive="#ffcab8" emissiveIntensity={0.14} />
        </mesh>

        {/* ดวงตาทั้ง 2 ข้าง */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.21, 0, 0.605]} rotation={[0, side * 0.18, 0]}>
            <group ref={side < 0 ? eyeRight : eyeLeft} position={[0, 0.035, 0]}>
              {/* ตาขาวเล็กน้อยรอบม่านตา */}
              <mesh position={[0, 0, -0.008]} scale={[1.14, 1.02, 0.32]}>
                <sphereGeometry args={[0.095, 22, 16]} />
                <meshStandardMaterial color="#ffffff" roughness={0.3} emissive="#ffffff" emissiveIntensity={0.15} />
              </mesh>
              {/* ขอบตาบน + ขนตาโค้งสมมาตร */}
              <mesh position={[0, 0.015, 0.02]} rotation={[0, 0, Math.PI * 0.18 + side * -0.1]} scale={[1.12, 0.95, 0.5]}>
                <torusGeometry args={[0.094, 0.011, 8, 22, Math.PI * 0.64]} />
                <meshStandardMaterial color="#2b1712" roughness={0.4} />
              </mesh>
              {/* ขอบม่านตาเข้ม */}
              <mesh scale={[0.98, 1.06, 0.4]}>
                <sphereGeometry args={[0.094, 24, 18]} />
                <meshStandardMaterial color="#2b1610" roughness={0.22} />
              </mesh>
              {/* ม่านตาสีน้ำตาลอำพัน */}
              <mesh position={[0, -0.005, 0.018]} scale={[0.82, 0.9, 0.34]}>
                <sphereGeometry args={[0.094, 22, 16]} />
                <meshStandardMaterial color="#81411d" roughness={0.25} />
              </mesh>
              {/* รูม่านตา */}
              <mesh position={[0, -0.002, 0.033]} scale={[0.52, 0.58, 0.25]}>
                <sphereGeometry args={[0.094, 18, 14]} />
                <meshStandardMaterial color="#160b08" roughness={0.12} />
              </mesh>
              {/* แสงวิ้งในตา */}
              <mesh position={[-0.028, 0.036, 0.05]}>
                <sphereGeometry args={[0.025, 10, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0.026, -0.026, 0.048]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>

            {/* คิ้วโค้งสมมาตร */}
            <group ref={side < 0 ? browRight : browLeft} position={[0, 0.205, 0.02]}>
              <mesh rotation={[0, 0, Math.PI * 0.225]} scale={[1.1, 0.72, 0.75]}>
                <torusGeometry args={[0.072, 0.01, 8, 18, Math.PI * 0.55]} />
                <meshStandardMaterial color="#6e3b2d" roughness={0.75} />
              </mesh>
            </group>
          </group>
        ))}

        {/* แก้มชมพูระเรื่อ (ใช้ CircleGeometry และยกนอกผิวหน้าเล็กน้อยเพื่อไม่ให้มุมตัดใบหน้า) */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            ref={side < 0 ? cheekRight : cheekLeft}
            position={[side * 0.32, -0.105, 0.598]}
            rotation={[0.08, side * 0.48, 0]}
            scale={[1.25, 0.9, 1]}
          >
            <circleGeometry args={[0.105, 24]} />
            <meshBasicMaterial map={blushTex} transparent opacity={0.68} depthWrite={false} />
          </mesh>
        ))}

        {/* จมูกจิ๋ว */}
        <mesh position={[0, -0.045, 0.68]} scale={[1.15, 0.78, 0.6]}>
          <sphereGeometry args={[0.024, 12, 10]} />
          <meshStandardMaterial color="#f5c0b2" roughness={0.58} />
        </mesh>

        {/* ปาก 3 สถานะ (ยื่นพ้นผิวหน้าชัดเจน) */}
        <group position={[0, -0.185, 0.668]}>
          {/* ปากอ้าตอนพูด / ตกใจ */}
          <group ref={mouthOpen} visible={false}>
            <mesh>
              <sphereGeometry args={[0.066, 18, 14]} />
              <meshStandardMaterial color="#781828" roughness={0.55} />
            </mesh>
            <mesh position={[0, -0.026, 0.025]} scale={[0.75, 0.45, 0.55]}>
              <sphereGeometry args={[0.046, 12, 10]} />
              <meshStandardMaterial color="#f07282" roughness={0.5} />
            </mesh>
          </group>

          {/* ยิ้มกว้างรูปตัว D เห็นลิ้นสีชมพู (HAPPY / WAVE / EXCITED) */}
          <group ref={happySmile}>
            <mesh position={[0, 0.012, 0]}>
              <circleGeometry args={[0.064, 28, Math.PI, Math.PI]} />
              <meshBasicMaterial color="#761626" />
            </mesh>
            <mesh position={[0, 0.011, 0.002]} scale={[1, 0.18, 0.6]}>
              <torusGeometry args={[0.064, 0.008, 8, 20, Math.PI]} />
              <meshBasicMaterial color="#a82c3d" />
            </mesh>
            <mesh position={[0, -0.014, 0.003]} scale={[1.05, 0.68, 1]}>
              <circleGeometry args={[0.038, 20, Math.PI * 0.9, Math.PI * 1.2]} />
              <meshBasicMaterial color="#f47c8c" />
            </mesh>
          </group>

          {/* ปากยิ้มอ่อนๆ หรือ เศร้า */}
          <mesh ref={smileLine} visible={false} position={[0, 0.018, 0.005]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.048, 0.011, 8, 18, Math.PI]} />
            <meshStandardMaterial color="#a6233d" roughness={0.55} />
          </mesh>
        </group>

        {/* ฮู้ดเปลือกลิ้นจี่ */}
        <mesh position={[0, 0.02, -0.12]} scale={[0.74, 0.71, 0.71]}>
          <sphereGeometry args={[1, 44, 34]} />
          <meshStandardMaterial color={LYCHEE_CORAL} roughness={0.62} />
        </mesh>

        {/* หนามลิ้นจี่รอบฮู้ด (1 draw call ด้วย InstancedMesh) */}
        <instancedMesh ref={spikesRef} args={[spikeGeo, undefined, spikes.length]}>
          <meshStandardMaterial roughness={0.55} />
        </instancedMesh>

        {/* กิ๊บติดผมสีเขียวบนขอบฮู้ดด้านขวาของน้อง (บนซ้ายของผู้ชม) */}
        <mesh
          geometry={hairClipGeo}
          position={[HAIRCLIP_POS.x, HAIRCLIP_POS.y, HAIRCLIP_POS.z]}
          rotation={[0.42, -0.45, 0.45]}
          scale={1.15}
        >
          <meshStandardMaterial color="#5fc449" roughness={0.35} />
        </mesh>

        {/* ก้านไม้ ลูกจิ๋ว และใบลิ้นจี่ด้านบนสุด */}
        <group position={[0, 0.73, -0.05]}>
          <mesh position={[0, 0.05, 0]} rotation={[0, 0, -0.08]}>
            <cylinderGeometry args={[0.032, 0.042, 0.16, 12]} />
            <meshStandardMaterial color="#6e472f" roughness={0.85} />
          </mesh>
          {/* ลูกลิ้นจี่จิ๋วข้างก้าน */}
          <mesh position={[-0.025, 0.048, 0.052]} scale={[1.05, 0.95, 1]}>
            <sphereGeometry args={[0.048, 16, 12]} />
            <meshStandardMaterial color="#e02939" roughness={0.35} />
          </mesh>
          {/* ใบลิ้นจี่สีเขียวใบใหญ่ */}
          <group ref={leafGroup} position={[0.03, 0.095, 0]} rotation={[0.55, 0.08, -0.18]}>
            <mesh position={[0.165, 0.015, 0]} rotation={[0.25, 0, 0.1]} scale={[0.22, 0.024, 0.105]}>
              <sphereGeometry args={[1, 20, 12]} />
              <meshStandardMaterial color={LEAF_GREEN} roughness={0.52} />
            </mesh>
            <mesh position={[0.155, 0.036, 0]} rotation={[0.25, 0, 0.1]} scale={[0.18, 0.008, 0.011]}>
              <sphereGeometry args={[1, 10, 6]} />
              <meshStandardMaterial color={LEAF_VEIN} roughness={0.6} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
