/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from '..';
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
