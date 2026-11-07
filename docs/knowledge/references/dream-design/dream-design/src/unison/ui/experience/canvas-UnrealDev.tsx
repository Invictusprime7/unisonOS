/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from '..';
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
