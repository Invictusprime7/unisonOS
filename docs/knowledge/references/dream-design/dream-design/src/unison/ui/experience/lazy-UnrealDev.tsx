/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from '..';
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
