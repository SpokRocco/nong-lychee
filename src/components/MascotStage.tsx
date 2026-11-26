import { Component, Suspense, useCallback, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Mascot3D } from './Mascot3D';
import { ExternalModel } from './ExternalModel';
import { ENV } from '../lib/config';

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  className?: string;
  /** ตำแหน่งกล้อง: 'full' เห็นทั้งตัว, 'close' ใกล้ใบหน้า */
  framing?: 'full' | 'close';
}

export function MascotStage({ className = '', framing = 'full' }: Props) {
  const [useFallback, setUseFallback] = useState(!ENV.modelUrl);
  const onModelError = useCallback(() => setUseFallback(true), []);
  const cam: [number, number, number] = framing === 'close' ? [0, 1.7, 4.2] : [0, 1.5, 6.2];

  return (
    <div className={className} aria-label="น้องลิ้นจี่ มาสคอต 3 มิติ" role="img">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: cam, fov: 34 }}
        gl={{ alpha: true, antialias: true }}
        shadows={false}
      >
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#fff4ee', '#e8b3bd', 0.7]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#ffd3da" />
        <Suspense fallback={null}>
          <Boundary fallback={<Mascot3D />}>
            {useFallback ? <Mascot3D /> : <ExternalModel url={ENV.modelUrl} onError={onModelError} />}
          </Boundary>
        </Suspense>
        <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={5} blur={2.4} far={2} />
        <OrbitControls
          target={[0, framing === 'close' ? 1.5 : 1.3, 0]}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 1.9}
          minAzimuthAngle={-0.9}
          maxAzimuthAngle={0.9}
        />
      </Canvas>
    </div>
  );
}
