/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
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
  return /^[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(raw) ? `hsl(${raw})` : raw;
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
