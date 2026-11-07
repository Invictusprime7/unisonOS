/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
// Internal WebGL implementation module. NOTHING outside this folder may import
// it directly: every public primitive reaches it through a lazy dynamic import
// so a missing or slow 3D bundle degrades to DOM instead of blanking the page.
import * as React from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Bounds,
  ContactShadows,
  Float,
  OrbitControls,
  PointMaterial,
  Points,
  Scroll,
  ScrollControls,
  useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';
import { useExperienceMaterial } from './tokens';

export interface SceneHostProps {
  children: React.ReactNode;
  camera?: { position?: [number, number, number]; fov?: number };
  frameloop?: 'always' | 'demand';
  fallback?: React.ReactNode;
}

/** The single WebGL context factory: capped DPR, suspended assets. */
export function SceneHost({ children, camera, frameloop = 'always', fallback = null }: SceneHostProps) {
  return (
    <Canvas
      fallback={fallback}
      dpr={[1, 2]}
      frameloop={frameloop}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={camera || { position: [0, 0, 6], fov: 50 }}
    >
      <React.Suspense fallback={null}>{children}</React.Suspense>
    </Canvas>
  );
}

export type LightRigPreset = 'studio' | 'soft' | 'dramatic';

/** Lighting preset — composed inside a stage/viewer children slot. */
export function LightRig({ preset = 'studio' }: { preset?: LightRigPreset }) {
  const material = useExperienceMaterial();
  if (preset === 'dramatic') {
    return (
      <>
        <ambientLight intensity={0.15} />
        <spotLight position={[4, 6, 4]} angle={0.4} penumbra={0.9} intensity={2.4} color={material.accent} />
        <pointLight position={[-5, -2, -4]} intensity={1.2} color={material.primary} />
      </>
    );
  }
  if (preset === 'soft') {
    return (
      <>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 4]} intensity={0.9} />
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 5]} intensity={1.4} />
      <directionalLight position={[-4, -2, -6]} intensity={0.5} color={material.accent} />
    </>
  );
}

function DriftingShape({ intensity }: { intensity: number }) {
  const mesh = React.useRef<THREE.Mesh>(null);
  const material = useExperienceMaterial();
  useFrame((state, delta) => {
    if (!mesh.current) return;
    const responsiveness = Math.min(1, delta * 3.5);
    mesh.current.rotation.y += delta * 0.12 * intensity;
    mesh.current.rotation.y += (state.pointer.x * 0.55 - mesh.current.rotation.y * 0.08) * responsiveness;
    mesh.current.rotation.x += (state.pointer.y * 0.35 - mesh.current.rotation.x) * responsiveness;
    mesh.current.position.x += (state.pointer.x * 0.45 + 1.6 - mesh.current.position.x) * responsiveness;
    mesh.current.position.y += (state.pointer.y * 0.28 - mesh.current.position.y) * responsiveness;
  });
  return (
    <Float speed={intensity} rotationIntensity={0.4 * intensity} floatIntensity={0.6 * intensity}>
      <mesh ref={mesh} position={[1.6, 0, 0]}>
        <icosahedronGeometry args={[2.1, 3]} />
        <meshStandardMaterial color={material.primary} roughness={0.25} metalness={0.6} />
      </mesh>
    </Float>
  );
}

function ParticleCloud({ count }: { count: number }) {
  const material = useExperienceMaterial();
  const positions = React.useMemo(() => {
    const buffer = new Float32Array(count * 3);
    for (let index = 0; index < count * 3; index += 1) {
      buffer[index] = (Math.random() - 0.5) * 14;
    }
    return buffer;
  }, [count]);
  const points = React.useRef<THREE.Points>(null);
  useFrame((_state, delta) => {
    if (points.current) points.current.rotation.y += delta * 0.03;
  });
  return (
    <Points ref={points} positions={positions} stride={3} frustumCulled>
      <PointMaterial transparent size={0.045} sizeAttenuation depthWrite={false} color={material.accent} />
    </Points>
  );
}

/** Callback-based loading keeps a failed texture out of React's render/throw path. */
function ImagePlane({ url, scale, position, onFailure }: { url: string; scale: number; position?: [number, number, number]; onFailure: () => void }) {
  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
  React.useEffect(() => {
    let active = true;
    let loaded: THREE.Texture | undefined;
    setTexture(null);
    if (!url) { onFailure(); return; }
    const loader = new THREE.TextureLoader();
    loader.load(url, (asset) => {
      if (!active) { asset.dispose(); return; }
      loaded = asset;
      asset.colorSpace = THREE.SRGBColorSpace;
      setTexture(asset);
    }, undefined, () => { if (active) onFailure(); });
    return () => { active = false; loaded?.dispose(); };
  }, [url, onFailure]);
  if (!texture) return null;
  const aspect = texture.image?.width && texture.image?.height ? texture.image.width / texture.image.height : 1;
  return <mesh position={position} scale={[scale, scale / aspect, 1]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={texture} transparent toneMapped={false} /></mesh>;
}

function Spinner({ spin, children }: { spin: boolean; children: React.ReactNode }) {
  const group = React.useRef<THREE.Group>(null);
  useFrame((_state, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.35;
  });
  return <group ref={group}>{children}</group>;
}

function PlaceholderObject() {
  const material = useExperienceMaterial();
  return (
    <mesh castShadow>
      <torusKnotGeometry args={[1, 0.34, 160, 24]} />
      <meshStandardMaterial color={material.primary} roughness={0.2} metalness={0.75} />
    </mesh>
  );
}

function GltfObject({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  return <primitive object={scene} />;
}

/** Hero backdrop scene. */
export function HeroScene({ intensity = 1 }: { intensity?: number }) {
  return (
    <SceneHost>
      <LightRig preset="studio" />
      <DriftingShape intensity={intensity} />
    </SceneHost>
  );
}

/** Ambient particle scene. */
export function ParticleScene({ count = 1600 }: { count?: number }) {
  return (
    <SceneHost>
      <ParticleCloud count={count} />
    </SceneHost>
  );
}

/** Page-band background scene. */
function TunnelRings({ layers = 48, points = 96 }: { layers?: number; points?: number }) {
  const material = useExperienceMaterial();
  const positions = React.useMemo(() => {
    const buffer = new Float32Array(layers * points * 3);
    let o = 0;
    for (let l = 0; l < layers; l += 1) {
      const z = -l * 0.6;
      const wobbleX = 0.4 * Math.sin(l * 0.35);
      const wobbleY = 0.3 * Math.cos(l * 0.22);
      for (let p = 0; p < points; p += 1) {
        const a = (p / points) * Math.PI * 2;
        buffer[o++] = Math.cos(a) * 2.2 + wobbleX;
        buffer[o++] = Math.sin(a) * 2.2 + wobbleY;
        buffer[o++] = z;
      }
    }
    return buffer;
  }, [layers, points]);
  const group = React.useRef<THREE.Group>(null);
  useFrame((_state, delta) => {
    if (!group.current) return;
    group.current.position.z = (group.current.position.z + delta * 1.2) % 0.6;
    group.current.rotation.z += delta * 0.04;
  });
  return (
    <group ref={group}>
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial transparent size={0.035} sizeAttenuation depthWrite={false} color={material.accent} />
      </Points>
    </group>
  );
}

export function BackgroundScene({ variant = 'aurora' }: { variant?: 'aurora' | 'starfield' | 'mesh' | 'tunnel' }) {
  const material = useExperienceMaterial();
  if (variant === 'tunnel') {
    return (
      <SceneHost camera={{ position: [0, 0, 2], fov: 70 }}>
        <TunnelRings />
      </SceneHost>
    );
  }
  return (
    <SceneHost>
      <LightRig preset="soft" />
      {variant === 'starfield' ? (
        <ParticleCloud count={2400} />
      ) : (
        <Float speed={variant === 'mesh' ? 0.8 : 1.4} floatIntensity={1.2}>
          <mesh scale={variant === 'mesh' ? 5 : 6}>
            <sphereGeometry args={[1, 48, 48]} />
            <meshStandardMaterial
              color={variant === 'mesh' ? material.surface : material.primary}
              wireframe={variant === 'mesh'}
              roughness={0.4}
              metalness={0.35}
              transparent
              opacity={0.55}
            />
          </mesh>
        </Float>
      )}
    </SceneHost>
  );
}

/** Single floating image plane. */
export function FloatingMediaScene({ src, onFailure }: { src: string; onFailure: () => void }) {
  return (
    <SceneHost camera={{ position: [0, 0, 5], fov: 45 }}>
      <LightRig preset="soft" />
      <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.9}>
        <ImagePlane url={src} scale={3.2} onFailure={onFailure} />
      </Float>
    </SceneHost>
  );
}

/** Depth-staggered media wall. */
export function DepthGalleryScene({ items, onFailure }: { items: { src: string; alt: string }[]; onFailure: () => void }) {
  return (
    <SceneHost camera={{ position: [0, 0, 7], fov: 50 }}>
      <LightRig preset="soft" />
      <ScrollControls horizontal pages={Math.max(1, items.length / 3)} damping={0.2}>
        <Scroll>
          {items.map((item, index) => (
            <Float key={item.src} speed={0.9} floatIntensity={0.5}>
              <ImagePlane
                url={item.src}
                scale={2.4}
                onFailure={onFailure}
                position={[index * 2.8 - 2, index % 2 === 0 ? 0.4 : -0.4, -index * 0.35]}
              />
            </Float>
          ))}
        </Scroll>
      </ScrollControls>
    </SceneHost>
  );
}

/** Centred product/object stage. */
export function ProductScene({ src, spin = true }: { src?: string; spin?: boolean }) {
  return (
    <SceneHost camera={{ position: [0, 0.6, 5], fov: 45 }}>
      <LightRig preset="studio" />
      <Bounds fit clip observe margin={1.2}>
        <Spinner spin={spin}>{src ? <GltfObject src={src} /> : <PlaceholderObject />}</Spinner>
      </Bounds>
      <ContactShadows position={[0, -1.6, 0]} opacity={0.4} blur={2.6} far={4} />
    </SceneHost>
  );
}

/** Orbitable GLTF viewer scene. */
export function ModelScene({ src, spin = false }: { src: string; spin?: boolean }) {
  return (
    <SceneHost camera={{ position: [0, 0.5, 4.5], fov: 45 }}>
      <LightRig preset="studio" />
      <Bounds fit clip observe margin={1.25}>
        <Spinner spin={spin}>
          <GltfObject src={src} />
        </Spinner>
      </Bounds>
      <ContactShadows position={[0, -1.5, 0]} opacity={0.35} blur={2.4} far={4} />
      <OrbitControls makeDefault enablePan={false} enableZoom={false} minPolarAngle={0.8} maxPolarAngle={2.1} />
    </SceneHost>
  );
}
