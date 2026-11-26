import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mascotBus } from '../lib/mascotBus';

/**
 * โหลดโมเดลน้องลิ้นจี่แบบ .glb / .vrm จาก VITE_MASCOT_MODEL_URL
 *  - .vrm  : ใช้ @pixiv/three-vrm ควบคุม expression (aa / happy / sad / surprised / relaxed)
 *  - .glb  : ค้นหา morph target ชื่อ mouthOpen / jawOpen / viseme_aa / aa เพื่อขยับปาก
 * ถ้าโหลดไม่สำเร็จจะเรียก onError เพื่อสลับไปใช้โมเดล Procedural
 */
interface Props {
  url: string;
  onError: () => void;
}

const MOUTH_KEYS = ['mouthopen', 'jawopen', 'viseme_aa', 'aa', 'mouth_open'];

export function ExternalModel({ url, onError }: Props) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const vrmRef = useRef<any>(null);
  const morphs = useRef<{ mesh: THREE.Mesh; index: number }[]>([]);
  const group = useRef<THREE.Group>(null);
  const t = useRef(0);

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();
    const isVrm = /\.vrm(\?.*)?$/i.test(url);

    (async () => {
      let VRMUtils: any;
      if (isVrm) {
        const mod = await import('@pixiv/three-vrm');
        VRMUtils = mod.VRMUtils;
        loader.register((parser) => new mod.VRMLoaderPlugin(parser));
      }
      loader.load(
        url,
        (gltf) => {
          if (disposed) return;
          const vrm = gltf.userData.vrm;
          const scene: THREE.Object3D = vrm ? vrm.scene : gltf.scene;
          if (vrm && VRMUtils?.rotateVRM0) VRMUtils.rotateVRM0(vrm);
          vrmRef.current = vrm ?? null;

          // ปรับขนาดให้สูง ~2.4 หน่วย และวางเท้าที่ y=0
          const box = new THREE.Box3().setFromObject(scene);
          const size = box.getSize(new THREE.Vector3());
          const k = size.y > 0 ? 2.4 / size.y : 1;
          scene.scale.multiplyScalar(k);
          const box2 = new THREE.Box3().setFromObject(scene);
          scene.position.y -= box2.min.y;
          scene.position.x -= (box2.min.x + box2.max.x) / 2;

          const found: { mesh: THREE.Mesh; index: number }[] = [];
          scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh && m.morphTargetDictionary) {
              for (const [name, idx] of Object.entries(m.morphTargetDictionary)) {
                if (MOUTH_KEYS.includes(name.toLowerCase())) found.push({ mesh: m, index: idx });
              }
            }
          });
          morphs.current = found;
          setObject(scene);
        },
        undefined,
        (err) => {
          console.warn('โหลดโมเดล 3D ไม่สำเร็จ ใช้โมเดล Procedural แทน', err);
          if (!disposed) onError();
        },
      );
    })().catch(() => !disposed && onError());

    return () => {
      disposed = true;
    };
  }, [url, onError]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    t.current += d;
    const bus = mascotBus;
    let level = 0;
    if (bus.activity === 'speaking') {
      bus.pulse = Math.max(0, bus.pulse - d * 4.5);
      level = Math.min(1, 0.22 + 0.25 * Math.abs(Math.sin(t.current * 9.5)) + bus.pulse * 0.45);
    } else if (bus.activity === 'listening') level = bus.micLevel * 0.9;

    if (group.current) {
      group.current.position.y = Math.sin(t.current * 2) * 0.03 + (bus.emotion === 'EXCITED' ? Math.abs(Math.sin(t.current * 6)) * 0.12 : 0);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, state.pointer.x * 0.3, 4, d);
    }
    for (const m of morphs.current) m.mesh.morphTargetInfluences![m.index] = level;

    const vrm = vrmRef.current;
    if (vrm?.expressionManager) {
      const em = vrm.expressionManager;
      em.setValue('aa', level);
      em.setValue('happy', bus.emotion === 'HAPPY' || bus.emotion === 'EXCITED' || bus.emotion === 'WAVE' ? 0.7 : 0);
      em.setValue('sad', bus.emotion === 'SAD' ? 0.8 : 0);
      em.setValue('surprised', bus.emotion === 'SURPRISED' ? 0.9 : 0);
      em.setValue('relaxed', bus.emotion === 'THINKING' ? 0.5 : 0);
      vrm.update(d);
    }
  });

  return <group ref={group}>{object && <primitive object={object} />}</group>;
}
