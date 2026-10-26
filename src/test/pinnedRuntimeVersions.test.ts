import { describe, expect, it } from 'vitest';

import { extractDependencies } from '@/utils/dependencyExtractor';
import {
  PINNED_RUNTIME_PACKAGE_VERSIONS,
  resolvePinnedRuntimeVersion,
} from '@/utils/sandpackDependencies';
import { emitCompositionEnhancements } from '@/sections/compositionEnhancements';
import type { CompositionActivation } from '@/sections/compositionEnhancements';

const EXPERIENCE_PINS = ['three', '@react-three/fiber', '@react-three/drei'] as const;
const LOCKFILE_RESOLVED_RUNTIME_PINS = {
  zustand: '5.0.16',
  '@tanstack/react-table': '9.3.1',
  'react-scroll': '1.9.3',
} as const;

describe('pinned runtime package versions', () => {
  it('pins the three.js experience capability against the React 19 profile', () => {
    for (const pkg of EXPERIENCE_PINS) {
      const pinned = resolvePinnedRuntimeVersion(pkg);
      expect(pinned, pkg).toBeTruthy();
      expect(pinned, pkg).not.toBe('latest');
    }
    expect(PINNED_RUNTIME_PACKAGE_VERSIONS['@react-three/fiber']).toMatch(/^\^?9\./);
  });

  it('pins additional runtime packages to exact resolved versions', () => {
    for (const [pkg, version] of Object.entries(LOCKFILE_RESOLVED_RUNTIME_PINS)) {
      expect(resolvePinnedRuntimeVersion(pkg), pkg).toBe(version);
    }
  });

  it('extractDependencies heals a stale package.json that recorded latest', () => {
    const files = {
      '/src/main.tsx': "import '@react-three/fiber'; import 'three'; import '@react-three/drei';",
      '/package.json': JSON.stringify({
        dependencies: {
          '@react-three/fiber': 'latest',
          three: 'latest',
          '@react-three/drei': 'latest',
          react: '^19.2.0',
          'react-dom': '^19.2.0',
        },
      }),
    };
    const { dependencies } = extractDependencies(files);
    for (const pkg of EXPERIENCE_PINS) {
      expect(dependencies[pkg]).toBe(PINNED_RUNTIME_PACKAGE_VERSIONS[pkg]);
    }
  });

  it('still honors a deliberate non-floating package.json pin for other packages', () => {
    const files = {
      '/src/main.tsx': "import 'recharts';",
      '/package.json': JSON.stringify({ dependencies: { recharts: '2.15.0' } }),
    };
    const { dependencies } = extractDependencies(files);
    expect(dependencies['recharts']).toBe('2.15.0');
  });
});

describe('composition enhancement guards', () => {
  const activation: CompositionActivation = {
    policy: 'maximum-compatible' as const,
    version: '1.0' as const,
    canvasRoots: 1,
    decisions: [
      { recipeId: 'immersive-hero' as const, sectionId: 's-hero', implementationId: 'impl-hero', reason: 'selected' as const },
      { recipeId: 'scene-backdrop' as const, sectionId: 's-feature', implementationId: 'impl-scene', reason: 'selected' as const },
      { recipeId: 'depth-gallery' as const, sectionId: 's-gallery', implementationId: 'impl-depth', reason: 'selected' as const },
      { recipeId: 'editorial-reveal' as const, sectionId: 's-about', implementationId: 'impl-reveal', reason: 'selected' as const },
    ],
  };

  it('emits typeof guards so a failed experience module degrades instead of crashing', () => {
    const { source } = emitCompositionEnhancements(activation);
    expect(source).toContain("typeof ImmersiveHero === 'function'");
    expect(source).toContain("typeof SceneBackground === 'function'");
    expect(source).toContain("typeof DepthGallery === 'function'");
    expect(source).toContain("typeof Reveal === 'function'");
    expect(source).toContain('ExperienceTabs.Content');
  });
});
