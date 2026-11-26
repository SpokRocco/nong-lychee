import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mascotBus, type Emotion } from '../lib/mascotBus';

/**
 * Procedural 3D Fallback: น้องลิ้นจี่
 *  - สวมฮู้ดเปลือกลิ้นจี่สีแดงผิวขรุขระ (low-poly flat shading + แรงสุ่มบนจุดยอด) ประดับใบลิ้นจี่สีเขียว
 *  - ใบหน้าขาวใส แก้มชมพู ชุดนักเรียนประถม (เสื้อเชิ้ตขาว + กางเกง/กระโปรงน้ำเงิน + ผ้าพันคอ)
 *  - ขยับตาม mascotBus: emotion / activity / micLevel / pulse
 */

const SKIN = '#fff3ee';
const LYCHEE_RED = '#d42a47';
const LEAF_A = '#2f9e58';
const LEAF_B = '#237a45';
const NAVY = '#1f2f5c';

function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1000) / 1000; // 0..1
}

function bumpySphere(radius: number, phiStart: number, phiLen: number, thetaLen: number, bump: number) {
  const g = new THREE.SphereGeometry(radius, 30, 20, phiStart, phiLen, 0, thetaLen);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // ใช้ตำแหน่ง (ปัดเศษ) เป็นคีย์ เพื่อให้จุดซ้ำตรงรอยต่อได้ค่าเท่ากัน ไม่เกิดรอยแตก
    const n = hash3(Math.round(v.x * 1000), Math.round(v.y * 1000), Math.round(v.z * 1000));
    v.multiplyScalar(1 + (n - 0.35) * bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

interface Pose {
  mouthSmile: number; // 1 = ยิ้ม, -1 = เศร้า
  browL: number;
  browR: number;
  browY: number;
  blush: number;
  armR: number;
  armL: number;
  tilt: number;
  eyeUp: number;
  jump: number;
  baseOpen: number;
}

function poseFor(e: Emotion, t: number): Pose {
  const p: Pose = {
    mouthSmile: 1,
    browL: 0,
    browR: 0,
    browY: 0,
    blush: 0.55,
    armR: 0.18,
    armL: -0.18,
    tilt: 0,
    eyeUp: 0,
    jump: 0,
    baseOpen: 0,
  };
  switch (e) {
    case 'EXCITED':
      p.blush = 0.9;
      p.browY = 0.05;
      p.armR = 2.5 + Math.sin(t * 10) * 0.15;
      p.armL = -2.5 - Math.sin(t * 10 + 1) * 0.15;
      p.jump = Math.abs(Math.sin(t * 6)) * 0.14;
      p.baseOpen = 0.25;
      break;
    case 'THINKING':
      p.mouthSmile = 0.15;
      p.browR = 0.25;
      p.browL = -0.05;
      p.browY = 0.04;
      p.tilt = 0.18;
      p.eyeUp = 0.025;
      p.armR = 1.7; // มือเท้าคาง
      p.blush = 0.4;
      break;
    case 'SAD':
      p.mouthSmile = -1;
      p.browL = -0.35;
      p.browR = 0.35;
      p.blush = 0.2;
      p.tilt = -0.08;
      break;
    case 'SURPRISED':
      p.browY = 0.1;
      p.baseOpen = 0.55;
      p.blush = 0.7;
      p.jump = Math.max(0, Math.sin(t * 8)) * 0.05;
      break;
    case 'WAVE':
      p.armR = 2.55 + Math.sin(t * 9) * 0.35;
      p.blush = 0.75;
      p.browY = 0.03;
      break;
    default:
      break;
  }
  return p;
}

export function Mascot3D() {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const mouthOpen = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const cheekL = useRef<THREE.Mesh>(null);
  const cheekR = useRef<THREE.Mesh>(null);
  const leaves = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ t: 0, nextBlink: 2, blink: 0, level: 0, headY: 0, headX: 0 });

  const hoodGeo = useMemo(() => bumpySphere(0.84, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, Math.PI * 0.82, 0.16), []);
  const bumpGeo = useMemo(() => bumpySphere(0.5, 0, Math.PI * 2, Math.PI, 0.12), []);

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
      // envelope สำรอง + แรงกระตุ้นจาก boundary ของ speechSynthesis (ตามจังหวะคำที่พูดจริง)
      bus.pulse = Math.max(0, bus.pulse - d * 4.5);
      const env = 0.22 + 0.25 * Math.abs(Math.sin(t * 9.5)) * (0.6 + 0.4 * Math.sin(t * 3.1));
      target = Math.min(1, env + bus.pulse * 0.45);
    } else if (bus.activity === 'listening') {
      target = bus.micLevel * 0.9; // ตามระดับเสียงผู้พูดจาก AnalyserNode
    }
    s.level = THREE.MathUtils.damp(s.level, target, 18, d);
    const openAmt = Math.max(s.level, pose.baseOpen * (bus.activity === 'speaking' ? 0.6 : 1));

    // ---- ตัว / ลอย / กระโดด ----
    if (root.current) {
      root.current.position.y = Math.sin(t * 2) * 0.035 + pose.jump;
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, state.pointer.x * 0.25, 4, d);
    }

    // ---- หัวมองตามเมาส์ + เอียงตามอารมณ์ ----
    if (head.current) {
      const thinkingUp = bus.activity === 'thinking' ? -0.12 : 0;
      s.headY = THREE.MathUtils.damp(s.headY, state.pointer.x * 0.35, 5, d);
      s.headX = THREE.MathUtils.damp(s.headX, -state.pointer.y * 0.2 + thinkingUp, 5, d);
      head.current.rotation.y = s.headY;
      head.current.rotation.x = s.headX + (bus.activity === 'listening' ? Math.sin(t * 3) * 0.03 : 0);
      head.current.rotation.z = THREE.MathUtils.damp(head.current.rotation.z, pose.tilt + Math.sin(t * 1.3) * 0.02, 6, d);
    }

    // ---- กระพริบตา ----
    s.nextBlink -= d;
    if (s.nextBlink <= 0) {
      s.blink = 0.14;
      s.nextBlink = 2 + Math.random() * 3;
    }
    s.blink = Math.max(0, s.blink - d);
    const eyeScaleY = s.blink > 0 ? 0.08 : bus.emotion === 'SURPRISED' ? 1.25 : bus.emotion === 'EXCITED' ? 1.1 : 1;
    for (const e of [eyeL.current, eyeR.current]) {
      if (!e) continue;
      e.scale.y = THREE.MathUtils.damp(e.scale.y, eyeScaleY, 30, d);
      e.position.y = 0.05 + pose.eyeUp;
    }

    // ---- คิ้ว ----
    if (browL.current && browR.current) {
      browL.current.rotation.z = THREE.MathUtils.damp(browL.current.rotation.z, pose.browL, 10, d);
      browR.current.rotation.z = THREE.MathUtils.damp(browR.current.rotation.z, pose.browR, 10, d);
      browL.current.position.y = THREE.MathUtils.damp(browL.current.position.y, 0.24 + pose.browY, 10, d);
      browR.current.position.y = THREE.MathUtils.damp(browR.current.position.y, 0.24 + pose.browY + (pose.browR > 0.2 ? 0.03 : 0), 10, d);
    }

    // ---- ปาก ----
    const opened = openAmt > 0.06;
    if (mouthOpen.current) {
      mouthOpen.current.visible = opened;
      const w = bus.emotion === 'SURPRISED' ? 0.7 : 1;
      mouthOpen.current.scale.set(w, 0.15 + openAmt * 1.1, 0.45);
    }
    if (smile.current) {
      smile.current.visible = !opened;
      smile.current.rotation.z = pose.mouthSmile >= 0 ? Math.PI : 0;
      const k = 0.35 + Math.abs(pose.mouthSmile) * 0.65;
      smile.current.scale.set(k, k, 1);
      smile.current.position.y = pose.mouthSmile >= 0 ? 0.03 : -0.02;
    }

    // ---- แก้มชมพู ----
    for (const c of [cheekL.current, cheekR.current]) {
      if (c) (c.material as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.damp((c.material as THREE.MeshStandardMaterial).opacity, pose.blush, 6, d);
    }

    // ---- แขน ----
    if (armR.current) armR.current.rotation.z = THREE.MathUtils.damp(armR.current.rotation.z, pose.armR, 9, d);
    if (armL.current) armL.current.rotation.z = THREE.MathUtils.damp(armL.current.rotation.z, pose.armL, 9, d);

    // ---- ใบลิ้นจี่แกว่ง ----
    leaves.current.forEach((g, i) => {
      if (g) g.rotation.z = -0.5 + Math.sin(t * 1.8 + i * 1.7) * 0.07 + (bus.emotion === 'EXCITED' ? Math.sin(t * 12 + i) * 0.08 : 0);
    });
  });

  return (
    <group ref={root} position={[0, 0, 0]}>
      {/* ===== ขา / รองเท้า ===== */}
      {[-0.14, 0.14].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.2, 14]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.082, 0.09, 0.13, 14]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.035, 0.04]} scale={[1, 0.55, 1.5]}>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshStandardMaterial color="#222" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* ===== กางเกงนักเรียน ===== */}
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[0.3, 0.37, 0.26, 24]} />
        <meshStandardMaterial color={NAVY} roughness={0.85} />
      </mesh>

      {/* ===== เสื้อเชิ้ตขาว ===== */}
      <mesh position={[0, 0.72, 0]} scale={[0.33, 0.36, 0.27]}>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      {/* ผ้าพันคอ + กระเป๋าเสื้อ */}
      <mesh position={[0, 0.9, 0.04]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
        <torusGeometry args={[0.2, 0.045, 10, 28]} />
        <meshStandardMaterial color="#c8213f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.8, 0.27]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.2, 4]} />
        <meshStandardMaterial color="#c8213f" roughness={0.6} />
      </mesh>
      <mesh position={[0.14, 0.62, 0.245]}>
        <boxGeometry args={[0.1, 0.1, 0.02]} />
        <meshStandardMaterial color="#e9eef7" roughness={0.9} />
      </mesh>

      {/* ===== แขน ===== */}
      <group ref={armR} position={[0.34, 0.9, 0]}>
        <mesh position={[0, -0.14, 0]}>
          <capsuleGeometry args={[0.07, 0.16, 6, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.33, 0]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armL} position={[-0.34, 0.9, 0]}>
        <mesh position={[0, -0.14, 0]}>
          <capsuleGeometry args={[0.07, 0.16, 6, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.33, 0]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>

      {/* ===== ศีรษะ ===== */}
      <group ref={head} position={[0, 1.55, 0]}>
        {/* ใบหน้าขาวใส */}
        <mesh scale={[1.06, 0.97, 0.98]}>
          <sphereGeometry args={[0.62, 40, 32]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>

        {/* ตา */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.22, 0, 0.5]}>
            <mesh ref={side < 0 ? eyeL : eyeR} position={[0, 0.05, 0.03]} scale={[1, 1.15, 0.6]}>
              <sphereGeometry args={[0.095, 20, 16]} />
              <meshStandardMaterial color="#2b1b1b" roughness={0.2} />
            </mesh>
            <mesh position={[0.03, 0.1, 0.11]}>
              <sphereGeometry args={[0.028, 10, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* คิ้ว */}
            <mesh
              ref={side < 0 ? browL : browR}
              position={[0, 0.24, 0.02]}
              rotation={[0, 0, 0]}
            >
              <capsuleGeometry args={[0.014, 0.1, 4, 8]} />
              <meshStandardMaterial color="#6b3f35" roughness={0.8} />
            </mesh>
          </group>
        ))}

        {/* แก้มชมพู */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            ref={side < 0 ? cheekL : cheekR}
            position={[side * 0.38, -0.1, 0.43]}
            rotation={[0, side * 0.7, 0]}
            scale={[1, 0.7, 0.25]}
          >
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshStandardMaterial color="#ff8fa3" transparent opacity={0.55} roughness={1} depthWrite={false} />
          </mesh>
        ))}

        {/* จมูกเล็ก */}
        <mesh position={[0, -0.04, 0.6]} scale={[1, 0.8, 0.6]}>
          <sphereGeometry args={[0.025, 10, 8]} />
          <meshStandardMaterial color="#f3c9bd" />
        </mesh>

        {/* ปาก */}
        <group position={[0, -0.2, 0.58]}>
          <mesh ref={mouthOpen} visible={false}>
            <sphereGeometry args={[0.085, 18, 14]} />
            <meshStandardMaterial color="#7a1730" roughness={0.6} />
          </mesh>
          <mesh ref={smile} position={[0, 0.03, 0.01]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.07, 0.014, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#a6173a" roughness={0.6} />
          </mesh>
        </group>

        {/* ฮู้ดเปลือกลิ้นจี่สีแดงผิวขรุขระ (เปิดด้านหน้าให้เห็นใบหน้า) */}
        <mesh geometry={hoodGeo} position={[0, 0.03, -0.08]}>
          <meshStandardMaterial color={LYCHEE_RED} roughness={0.55} flatShading side={THREE.DoubleSide} />
        </mesh>
        {/* ปุ่มขรุขระเสริมบนฮู้ด */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const r = 0.8;
          const y = 0.1 + ((i * 37) % 10) / 14;
          const phi = a + 1.2;
          const rr = Math.sqrt(Math.max(0.05, r * r - y * y)) * 0.98;
          return (
            <mesh
              key={i}
              geometry={bumpGeo}
              position={[Math.cos(phi) * rr * 0.9, y + 0.03, -0.08 - Math.abs(Math.sin(phi)) * rr * 0.9 - 0.02]}
              scale={0.07 + ((i * 13) % 5) * 0.008}
            >
              <meshStandardMaterial color="#e23c58" roughness={0.5} flatShading />
            </mesh>
          );
        })}
        {/* ขอบฮู้ดด้านหน้า */}

        {/* ใบลิ้นจี่สีเขียว */}
        <group position={[0, 0.84, -0.06]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.12, 8]} />
            <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} position={[0, 0.07, 0]} rotation={[0, (i / 4) * Math.PI * 2 + 0.4, 0]}>
              <group
                ref={(g) => {
                  leaves.current[i] = g;
                }}
                rotation={[0, 0, -0.5]}
              >
                <mesh position={[0.2, 0.04, 0]} scale={[0.26, 0.035, 0.1]}>
                  <sphereGeometry args={[1, 18, 10]} />
                  <meshStandardMaterial color={i % 2 ? LEAF_B : LEAF_A} roughness={0.6} />
                </mesh>
                <mesh position={[0.2, 0.075, 0]} scale={[0.24, 0.006, 0.012]}>
                  <sphereGeometry args={[1, 8, 6]} />
                  <meshStandardMaterial color="#b6e8c4" roughness={0.7} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
