/**
 * Unison Experience Layer — canonical 3D/immersive primitives.
 *
 * These modules are emitted into the generated VFS by the canonical pipeline
 * (never authored by Lane B) and live under `/src/unison/ui/experience`. They are
 * the ONLY sanctioned way a generated page may reach React Three Fiber:
 * Lane B composes them, Stage 4b themes them through CSS material tokens, and
 * the experience preflight gate budgets them.
 */

import {
  EXPERIENCE_CAPABILITY_ID,
  EXPERIENCE_PERFORMANCE_BUDGET,
  THREE_D_CAPABILITY,
} from '@/platform/core/generatedRuntimeCapabilities';

export const EXPERIENCE_FOUNDATION_VERSION = '1.3' as const;

/** The runtime capability that backs this layer (single source of truth). */
export const EXPERIENCE_CAPABILITY = THREE_D_CAPABILITY;
export { EXPERIENCE_CAPABILITY_ID, EXPERIENCE_PERFORMANCE_BUDGET };

export const EXPERIENCE_IMPORT_ROOT = '@/unison/ui/experience' as const;

/** The 8 premium experience primitives Lane B may compose. */
export const EXPERIENCE_PRIMITIVES = [
  'ImmersiveHero',
  'ProductStage',
  'FloatingMedia',
  'ParticleField',
  'DepthGallery',
  'ModelViewer',
  'SceneBackground',
  'LightRig',
] as const;

export type ExperiencePrimitive = (typeof EXPERIENCE_PRIMITIVES)[number];

/** Primitives that mount their own WebGL context (budgeted by the gate). */
export const EXPERIENCE_HEAVY_PRIMITIVES: ReadonlySet<ExperiencePrimitive> = new Set([
  'ImmersiveHero',
  'ProductStage',
  'DepthGallery',
  'ModelViewer',
  'SceneBackground',
]);

export const EXPERIENCE_BARREL_EXPORTS: ReadonlySet<string> = new Set([
  ...EXPERIENCE_PRIMITIVES,
  'ExperienceCanvas',
  'useExperienceMaterial',
  'useExperienceEnabled',
]);

export const EXPERIENCE_FOUNDATION_PATHS = [
  '/src/unison/ui/experience/index.ts',
  '/src/unison/ui/experience/canvas.tsx',
  '/src/unison/ui/experience/lazy.tsx',
  '/src/unison/ui/experience/webgl.tsx',
  '/src/unison/ui/experience/tokens.ts',
  '/src/unison/ui/experience/scene.tsx',
  '/src/unison/ui/experience/media.tsx',
  '/src/unison/ui/experience/stage.tsx',
] as const;

export const EXPERIENCE_IMPORT_PATHS = [
  '@/unison/ui/experience',
  '@/unison/ui/experience/canvas',
  '@/unison/ui/experience/lazy',
  '@/unison/ui/experience/webgl',
  '@/unison/ui/experience/tokens',
  '@/unison/ui/experience/scene',
  '@/unison/ui/experience/media',
  '@/unison/ui/experience/stage',
] as const;

/** npm packages the experience layer is allowed to reach (foundation only). */
export const EXPERIENCE_RUNTIME_PACKAGES: readonly string[] = THREE_D_CAPABILITY.imports;

export const EXPERIENCE_VOCABULARY_DIRECTIVE = [
  '── EXPERIENCE VOCABULARY (3D / immersive — optional, budgeted) ──',
  'Immersive WebGL is available ONLY through "@/unison/ui/experience". Never import "three", "@react-three/fiber", or "@react-three/drei" directly in a page — those imports are rejected by the experience preflight gate.',
  '  - <ImmersiveHero eyebrow? title lead? actions? intensity="subtle|balanced|cinematic"> — full-bleed hero band with a themed 3D backdrop; DOM copy stays selectable and accessible.',
  '  - <ProductStage src? alt? caption? spin?={boolean}> — centred product/object stage with soft studio lighting and contact shadow.',
  '  - <FloatingMedia src alt caption?> — a single image plane with gentle parallax float.',
  '  - <DepthGallery items={[{ src, alt, caption? }]}> — depth-staggered media wall.',
  '  - <ModelViewer src="/models/thing.glb" alt spin?={boolean}> — GLTF viewer with orbit + bounds. Only use when a real .glb asset exists.',
  '  - <ParticleField density="low|medium|high" /> and <SceneBackground variant="aurora|starfield|mesh" /> — ambient background layers; place at most one per page band.',
  '  - <LightRig preset="studio|soft|dramatic" /> — lighting preset, only inside a <ProductStage>/<ModelViewer> children slot.',
  'Budget: at most ONE heavy experience primitive (ImmersiveHero, ProductStage, DepthGallery, ModelViewer, SceneBackground) per page band and at most TWO per page. Every experience primitive already ships a non-WebGL fallback, respects prefers-reduced-motion, and takes its colours from Stage 4b material tokens — never pass colour or size literals to them.',
].join('\n');

const heavyList = [...EXPERIENCE_HEAVY_PRIMITIVES].join(', ');

/** Emits the experience foundation module set for the generated VFS. */
export function buildExperienceFoundationFiles(marker: string): Record<string, string> {
  return {
    '/src/unison/ui/experience/tokens.ts': `${marker}
import * as React from 'react';

/**
 * Reads Stage 4b material tokens off the document root so every 3D surface
 * inherits the selected style card instead of hardcoding colours.
 */
export interface ExperienceMaterial {
  primary: string;
  accent: string;
  surface: string;
  background: string;
}

const FALLBACK: ExperienceMaterial = {
  primary: '#6366f1',
  accent: '#22d3ee',
  surface: '#1f2937',
  background: '#0b0f19',
};

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  // Tokens are stored as bare HSL triplets (e.g. "222 47% 11%").
  return /^[\\d.]+\\s+[\\d.]+%\\s+[\\d.]+%$/.test(raw) ? \`hsl(\${raw})\` : raw;
}

export function useExperienceMaterial(): ExperienceMaterial {
  const [material, setMaterial] = React.useState<ExperienceMaterial>(FALLBACK);
  React.useEffect(() => {
    setMaterial({
      primary: readToken('--primary', FALLBACK.primary),
      accent: readToken('--accent', FALLBACK.accent),
      surface: readToken('--card', FALLBACK.surface),
      background: readToken('--background', FALLBACK.background),
    });
  }, []);
  return material;
}

/** WebGL availability + reduced-motion gate shared by every primitive. */
export function useExperienceEnabled(): boolean {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setEnabled(false);
      return;
    }
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      setEnabled(Boolean(gl));
    } catch {
      setEnabled(false);
    }
  }, []);
  return enabled;
}
`,

    '/src/unison/ui/experience/webgl.tsx': `${marker}
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
`,

    '/src/unison/ui/experience/lazy.tsx': `${marker}
import * as React from 'react';
import { cn } from '@/unison/ui';
import { useExperienceEnabled } from './tokens';

const loadWebgl = () => import('./webgl');

const CACHE = new Map<string, React.ComponentType<Record<string, unknown>>>();

/** Lazily resolves one export of the internal WebGL module. */
export function lazyExperienceComponent(name: string): React.ComponentType<Record<string, unknown>> {
  const cached = CACHE.get(name);
  if (cached) return cached;
  const component = React.lazy(async () => {
    const mod = (await loadWebgl()) as Record<string, unknown>;
    const resolved = mod[name];
    if (typeof resolved !== 'function') throw new Error('Experience scene "' + name + '" is unavailable.');
    return { default: resolved as React.ComponentType<Record<string, unknown>> };
  }) as unknown as React.ComponentType<Record<string, unknown>>;
  CACHE.set(name, component);
  return component;
}

export class ExperienceBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn('[Experience] Using DOM fallback:', error.message); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export interface WebglLayerProps {
  /** Export name inside the internal WebGL module. */
  scene: string;
  sceneProps?: Record<string, unknown>;
  /** Rendered until (or unless) the WebGL scene mounts. */
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * Mounts a WebGL scene only when the device supports it AND the 3D bundle
 * resolves. Any failure — no WebGL, reduced motion, missing/failed module,
 * render error — leaves the DOM fallback on screen instead of a blank page.
 */
export function WebglLayer({ scene, sceneProps, fallback = null, className }: WebglLayerProps) {
  const enabled = useExperienceEnabled();
  const Scene = React.useMemo(() => (enabled ? lazyExperienceComponent(scene) : null), [enabled, scene]);
  if (!enabled || !Scene) {
    return <div className={cn('absolute inset-0', className)} aria-hidden="true">{fallback}</div>;
  }
  return (
    <div className={cn('absolute inset-0', className)} aria-hidden="true">
      <ExperienceBoundary fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <Scene {...(sceneProps || {})} />
        </React.Suspense>
      </ExperienceBoundary>
    </div>
  );
}
`,

    '/src/unison/ui/experience/canvas.tsx': `${marker}
import * as React from 'react';
import { cn } from '@/unison/ui';
import { useExperienceEnabled } from './tokens';
import { ExperienceBoundary, lazyExperienceComponent } from './lazy';

export interface ExperienceCanvasProps {
  children: React.ReactNode;
  /** Rendered whenever WebGL is unavailable, reduced, or the 3D bundle fails. */
  fallback?: React.ReactNode;
  className?: string;
  camera?: { position?: [number, number, number]; fov?: number };
  /** Keeps ambient layers cheap; interactive stages opt into 'always'. */
  frameloop?: 'always' | 'demand';
}

/**
 * The single WebGL entry point of the generated runtime. The renderer itself is
 * loaded lazily, so a missing 3D bundle degrades to the DOM fallback instead of
 * failing the whole page module.
 */
export function ExperienceCanvas({
  children,
  fallback = null,
  className,
  camera = { position: [0, 0, 6], fov: 50 },
  frameloop = 'always',
}: ExperienceCanvasProps) {
  const enabled = useExperienceEnabled();
  const Host = React.useMemo(() => (enabled ? lazyExperienceComponent('SceneHost') : null), [enabled]);
  if (!enabled || !Host) {
    return <div className={cn('absolute inset-0', className)} aria-hidden="true">{fallback}</div>;
  }
  return (
    <div className={cn('absolute inset-0', className)} aria-hidden="true">
      <ExperienceBoundary fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <Host camera={camera} frameloop={frameloop} fallback={fallback}>{children}</Host>
        </React.Suspense>
      </ExperienceBoundary>
    </div>
  );
}
`,

    '/src/unison/ui/experience/scene.tsx': `${marker}
import * as React from 'react';
import { cn } from '@/unison/ui';
import { WebglLayer, lazyExperienceComponent } from './lazy';

export type LightRigPreset = 'studio' | 'soft' | 'dramatic';

/** Lighting preset — composed inside a stage/viewer children slot. */
export const LightRig = lazyExperienceComponent('LightRig') as React.ComponentType<{ preset?: LightRigPreset }>;

export type ExperienceIntensity = 'subtle' | 'balanced' | 'cinematic';

const INTENSITY: Record<ExperienceIntensity, number> = {
  subtle: 0.5,
  balanced: 1,
  cinematic: 1.6,
};

export interface ImmersiveHeroProps {
  children?: React.ReactNode;
  intensity?: ExperienceIntensity;
  className?: string;
}

/** Full-bleed hero band with a themed 3D backdrop behind selectable DOM copy. */
export function ImmersiveHero({ children, intensity = 'balanced', className }: ImmersiveHeroProps) {
  return (
    <div
      data-ut-component="immersive-hero"
      data-ut-editable="intensity,children"
      className={cn(
        'relative isolate overflow-hidden rounded-[var(--ut-media-radius)] bg-background min-h-[var(--ut-hero-block)]',
        className,
      )}
    >
      <WebglLayer
        scene="HeroScene"
        sceneProps={{ intensity: INTENSITY[intensity] }}
        fallback={<div className="size-full bg-gradient-to-br from-primary/25 via-background to-accent/20" />}
      />
      <div className="relative z-10 flex size-full flex-col justify-center">{children}</div>
    </div>
  );
}

export type ParticleDensity = 'low' | 'medium' | 'high';

const DENSITY: Record<ParticleDensity, number> = { low: 600, medium: 1600, high: 3200 };

/** Ambient particle layer. Cheap, decorative, never interactive. */
export function ParticleField({ density = 'medium', className }: { density?: ParticleDensity; className?: string }) {
  return (
    <div
      data-ut-component="particle-field"
      data-ut-editable="density"
      className={cn('pointer-events-none absolute inset-0', className)}
    >
      <WebglLayer scene="ParticleScene" sceneProps={{ count: DENSITY[density] }} fallback={null} />
    </div>
  );
}

export type SceneBackgroundVariant = 'aurora' | 'starfield' | 'mesh' | 'tunnel';

/** Page-band background layer; place at most one per band. */
export function SceneBackground({
  variant = 'aurora',
  className,
}: { variant?: SceneBackgroundVariant; className?: string }) {
  return (
    <div
      data-ut-component="scene-background"
      data-ut-editable="variant"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      <WebglLayer
        scene="BackgroundScene"
        sceneProps={{ variant }}
        fallback={<div className="size-full bg-gradient-to-b from-background via-primary/10 to-background" />}
      />
    </div>
  );
}
`,

    '/src/unison/ui/experience/media.tsx': `${marker}
import * as React from 'react';
import { Image as SiteImage } from '../media';
import { cn } from '@/unison/ui';
import { WebglLayer } from './lazy';

export interface FloatingMediaProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}

/** Single image plane with gentle parallax float and a DOM image fallback. */
export function FloatingMedia({ src, alt, caption, className }: FloatingMediaProps) {
  const [failedSource, setFailedSource] = React.useState<string | null>(null);
  const onFailure = React.useCallback(() => setFailedSource(src), [src]);
  const domImage = <SiteImage src={src} alt={alt} loading="lazy" className="size-full object-cover" />;
  return (
    <figure
      data-ut-component="floating-media"
      data-ut-editable="src,alt,caption"
      className={cn('relative overflow-hidden rounded-[var(--ut-media-radius)]', className)}
    >
      <div className="relative min-h-[var(--ut-media-block)]">
        {failedSource === src ? domImage : (
          <WebglLayer scene="FloatingMediaScene" sceneProps={{ src, onFailure }} fallback={domImage} />
        )}
        <span className="sr-only">{alt}</span>
      </div>
      {caption ? <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

export interface DepthGalleryItem {
  src: string;
  alt: string;
  caption?: string;
}

/** Depth-staggered media wall. Falls back to a responsive image grid. */
export function DepthGallery({ items, className }: { items: DepthGalleryItem[]; className?: string }) {
  const planes = items.slice(0, 8);
  const sourceKey = JSON.stringify(planes.map(item => item.src));
  const [failedSources, setFailedSources] = React.useState<string | null>(null);
  const onFailure = React.useCallback(() => setFailedSources(sourceKey), [sourceKey]);
  const fallback = <div className="grid size-full grid-cols-2 gap-3 md:grid-cols-3">{planes.map((item, index) => <SiteImage key={item.src + index} src={item.src} alt={item.alt} className="size-full object-cover" />)}</div>;
  return (
    <div
      data-ut-component="depth-gallery"
      data-ut-editable="items"
      className={cn('relative overflow-hidden rounded-[var(--ut-media-radius)]', className)}
    >
      <div className="relative min-h-[var(--ut-media-block-lg)]">
        {failedSources === sourceKey ? fallback : (
          <WebglLayer scene="DepthGalleryScene" sceneProps={{ items: planes, onFailure }} fallback={fallback} />
        )}
      </div>
      <ul className="sr-only">
        {planes.map((item) => (
          <li key={item.src}>{item.caption || item.alt}</li>
        ))}
      </ul>
    </div>
  );
}
`,

    '/src/unison/ui/experience/stage.tsx': `${marker}
import * as React from 'react';
import { cn } from '@/unison/ui';
import { WebglLayer } from './lazy';

export interface ProductStageProps {
  /** Optional .glb model. Without one the stage renders a themed object. */
  src?: string;
  alt: string;
  caption?: string;
  spin?: boolean;
  className?: string;
}

/** Centred product/object stage with studio lighting and a contact shadow. */
export function ProductStage({ src, alt, caption, spin = true, className }: ProductStageProps) {
  return (
    <figure
      data-ut-component="product-stage"
      data-ut-editable="src,alt,caption,spin"
      className={cn('relative overflow-hidden rounded-[var(--ut-media-radius)] bg-card', className)}
    >
      <div className="relative min-h-[var(--ut-media-block-lg)]">
        <WebglLayer
          scene="ProductScene"
          sceneProps={{ src, spin }}
          fallback={<div className="size-full bg-gradient-to-b from-card to-muted" />}
        />
        <span className="sr-only">{alt}</span>
      </div>
      {caption ? <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

export interface ModelViewerProps {
  src: string;
  alt: string;
  spin?: boolean;
  className?: string;
}

/** Orbitable GLTF viewer. Only use with a real .glb asset in the project. */
export function ModelViewer({ src, alt, spin = false, className }: ModelViewerProps) {
  return (
    <div
      data-ut-component="model-viewer"
      data-ut-editable="src,alt,spin"
      className={cn('relative overflow-hidden rounded-[var(--ut-media-radius)] bg-card', className)}
      role="img"
      aria-label={alt}
    >
      <div className="relative min-h-[var(--ut-media-block-lg)]">
        <WebglLayer
          scene="ModelScene"
          sceneProps={{ src, spin }}
          fallback={<div className="size-full bg-gradient-to-b from-card to-muted" />}
        />
      </div>
    </div>
  );
}
`,

    '/src/unison/ui/experience/index.ts': `${marker}
// Experience layer barrel — the ONLY sanctioned WebGL surface for generated
// pages. Heavy primitives (${heavyList}) are budgeted by the preflight gate.
// The WebGL renderer itself is loaded lazily from './webgl'; every primitive
// renders its DOM fallback until (or unless) that bundle resolves.
export { ExperienceCanvas, type ExperienceCanvasProps } from './canvas';
export { WebglLayer, ExperienceBoundary, lazyExperienceComponent, type WebglLayerProps } from './lazy';
export { useExperienceMaterial, useExperienceEnabled, type ExperienceMaterial } from './tokens';
export {
  ImmersiveHero,
  ParticleField,
  SceneBackground,
  LightRig,
  type ImmersiveHeroProps,
  type ExperienceIntensity,
  type ParticleDensity,
  type SceneBackgroundVariant,
  type LightRigPreset,
} from './scene';
export { FloatingMedia, DepthGallery, type FloatingMediaProps, type DepthGalleryItem } from './media';
export { ProductStage, ModelViewer, type ProductStageProps, type ModelViewerProps } from './stage';
`,
  };
}
