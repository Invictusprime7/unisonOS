/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from '..';
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
