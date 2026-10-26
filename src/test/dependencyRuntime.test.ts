import { describe, expect, it } from 'vitest';
import { extractDependencies, getDependenciesForSandpack, resolveSiteDependencyRuntime } from '../utils/dependencyExtractor';
import {
  SANDPACK_DEPENDENCIES,
  WIZARD_PREVIEW_RUNTIME_DEPENDENCIES,
  WIZARD_RUNTIME_DEPENDENCY_GROUPS,
} from '../utils/sandpackDependencies';

describe('Wizard preview dependency runtime', () => {
  it('produces a stable site dependency graph fingerprint that changes with resolved versions', () => {
    const files = {
      '/src/App.tsx': "import Chart from '@scope/chart'; export default Chart;",
      '/package.json': JSON.stringify({ dependencies: { '@scope/chart': '1.2.3' } }),
    };
    const first = resolveSiteDependencyRuntime(files);
    const reordered = resolveSiteDependencyRuntime({
      '/package.json': files['/package.json'],
      '/src/App.tsx': files['/src/App.tsx'],
    });
    const upgraded = resolveSiteDependencyRuntime({
      ...files,
      '/package.json': JSON.stringify({ dependencies: { '@scope/chart': '1.2.4' } }),
    });

    expect(first.dependencies['@scope/chart']).toBe('1.2.3');
    expect(first.graphFingerprint).toMatch(/^site-deps-v1-/);
    expect(reordered.graphFingerprint).toBe(first.graphFingerprint);
    expect(upgraded.graphFingerprint).not.toBe(first.graphFingerprint);
  });

  it('uses VFS package versions only for packages imported by the active preview', () => {
    const result = extractDependencies({
      '/package.json': JSON.stringify({
        dependencies: { bootstrap: '^5.3.3', '@stylexjs/stylex': '^0.8.0' },
        devDependencies: { vite: '^5.4.0' },
      }),
      '/src/App.tsx': "import 'bootstrap'; export default function App() { return <main />; }",
    });

    expect(result.dependencies.bootstrap).toBe('^5.3.3');
    expect(result.dependencies['@stylexjs/stylex']).toBeUndefined();
    expect(result.dependencies.vite).toBeUndefined();
  });

  it('resolves curated imports to the shared Sandpack catalog versions', () => {
    const curatedPackages = [
      '@babel/standalone',
      '@radix-ui/react-dialog',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'clsx',
      'react-scroll',
      'zustand',
    ];
    const source = curatedPackages.map((name) => `import '${name}';`).join('\n');
    const result = extractDependencies({ '/src/App.tsx': source });

    for (const name of curatedPackages) {
      expect(result.dependencies[name]).toBe(SANDPACK_DEPENDENCIES[name]);
    }
    expect(result.unresolved).toEqual([]);
  });

  it('excludes generated aliases and build tools from Sandpack dependencies', () => {
    const result = getDependenciesForSandpack({
      '/index.tsx': "import App from './App'; export default App;",
      '/App.tsx': "import { Check } from 'lucide-react'; import { Button } from '@/unison/ui/button'; export default () => <Button><Check /></Button>;",
      '/unison/ui/button.tsx': 'export const Button = ({ children }: { children: React.ReactNode }) => <button>{children}</button>;',
      '/package.json': JSON.stringify({
        dependencies: {
          'lucide-react': '^0.468.0',
          '@/unison': 'workspace:*',
          vite: '^6.0.0',
          '@vitejs/plugin-react-swc': '^3.7.0',
          path: '^0.12.7',
        },
      }),
    }, {}, { entryPoints: ['/index.tsx'] });

    expect(result.dependencies['lucide-react']).toBe('^0.468.0');
    expect(result.dependencies['@/unison']).toBeUndefined();
    expect(result.dependencies.vite).toBeUndefined();
    expect(result.dependencies['@vitejs/plugin-react-swc']).toBeUndefined();
    expect(result.dependencies.path).toBeUndefined();
  });

  it('does not install Vite tooling imported by exported config files', () => {
    const result = extractDependencies({
      '/src/App.tsx': "import React from 'react'; export default () => <main />;",
      '/vite.config.ts': "import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react-swc'; export default defineConfig({ plugins: [react()] });",
    });

    expect(result.dependencies.vite).toBeUndefined();
    expect(result.dependencies['@vitejs/plugin-react-swc']).toBeUndefined();
  });

  it('resolves experience packages from the generated runtime capability registry', () => {
    const result = extractDependencies({
      '/src/unison/ui/experience/canvas.tsx': [
        "import { Canvas } from '@react-three/fiber';",
        "import { Environment } from '@react-three/drei';",
        "import * as THREE from 'three';",
      ].join('\n'),
    });

    expect(result.dependencies['@react-three/fiber']).toBe('^9.3.0');
    expect(result.dependencies['@react-three/drei']).toBe('^10.7.0');
    expect(result.dependencies.three).toBe('^0.180.0');
    expect(result.unresolved).toEqual([]);
  });

  it('exports the same Babel, Radix, Bootstrap, StyleX, and Tailwind groups used at runtime', () => {
    expect(WIZARD_RUNTIME_DEPENDENCY_GROUPS.react['@swc/helpers']).toBe('0.5.23');
    expect(WIZARD_RUNTIME_DEPENDENCY_GROUPS.babel['@babel/standalone']).toBeTruthy();
    expect(WIZARD_RUNTIME_DEPENDENCY_GROUPS.radix['@radix-ui/react-dialog']).toBeTruthy();
    expect(WIZARD_RUNTIME_DEPENDENCY_GROUPS.styling.bootstrap).toBeTruthy();
    expect(WIZARD_RUNTIME_DEPENDENCY_GROUPS.styling['@stylexjs/stylex']).toBeTruthy();
    expect(WIZARD_RUNTIME_DEPENDENCY_GROUPS.styling.tailwindcss).toBeTruthy();
    expect(WIZARD_PREVIEW_RUNTIME_DEPENDENCIES['@babel/standalone']).toBeTruthy();
  });

  it('installs only packages reached through the active VFS entry graph', () => {
    const result = getDependenciesForSandpack({
      '/index.tsx': "import App from './App'; export default App;",
      '/App.tsx': "import { Button } from './unison/ui/button'; export default () => <Button />;",
      '/unison/ui/button.tsx': "import { Slot } from './radix/slot'; import { cva } from 'class-variance-authority'; import { cn } from './cn'; export const Button = () => <Slot className={cn(cva(''), '')} />;",
      '/unison/ui/cn.ts': "import { clsx } from 'clsx'; import { twMerge } from 'tailwind-merge'; export const cn = (...value: unknown[]) => twMerge(clsx(value));",
      '/unison/ui/radix/slot.ts': "export * from '@radix-ui/react-slot';",
      '/unison/ui/radix/dialog.ts': "export * from '@radix-ui/react-dialog';",
    }, {}, { entryPoints: ['/index.tsx'] });

    expect(result.dependencies['@radix-ui/react-slot']).toBeTruthy();
    expect(result.dependencies['class-variance-authority']).toBeTruthy();
    expect(result.dependencies['clsx']).toBeTruthy();
    expect(result.dependencies['tailwind-merge']).toBeTruthy();
    expect(result.dependencies['@radix-ui/react-dialog']).toBeUndefined();
  });

  it.each([['accordion', '1.2.12'], ['dialog', '1.1.15']])('keeps the real %s dependency in the Sandpack install graph', async (primitive, version) => {
    const { prepareSandpackFiles } = await import('../utils/sandpackFilePrep');
    const prepared = prepareSandpackFiles({
      '/src/App.tsx': `import * as Primitive from './unison/ui/radix/${primitive}'; export default function App(){ return <main>{Object.keys(Primitive).join(',')}</main>; }`,
      [`/src/unison/ui/radix/${primitive}.ts`]: `export * from '@radix-ui/react-${primitive}';`,
      '/src/index.css': ':root { --primary: 0 0% 10%; }',
    }, { strict: true, entryPoint: '/src/App.tsx' });
    const result = getDependenciesForSandpack(prepared, {}, { entryPoints: ['/index.tsx'] });

    expect(prepared[`/unison/ui/radix/${primitive}.ts`]).toContain(`export * from '@radix-ui/react-${primitive}';`);
    expect(result.dependencies[`@radix-ui/react-${primitive}`]).toBe(version);
    expect(result.dependencies['@swc/helpers']).toBeUndefined();
  }, 20000);


  it('adds Sandpack-only nested runtime packages for active Radix and Motion imports', () => {
    const result = getDependenciesForSandpack({
      '/index.tsx': "import { Slot } from '@radix-ui/react-slot'; import { motion } from 'framer-motion'; export default () => <Slot><motion.div /></Slot>;",
    }, {}, { entryPoints: ['/index.tsx'] });

    expect(result.dependencies['@radix-ui/react-slot']).toBeTruthy();
    expect(result.dependencies['@radix-ui/react-slot']).toBe('1.2.4');
    expect(result.dependencies['@radix-ui/react-compose-refs']).toBe('1.1.2');
    expect(result.dependencies['@radix-ui/react-use-controllable-state']).toBe('1.2.2');
    expect(result.dependencies['motion-dom']).toBe('12.29.2');
    expect(result.dependencies['motion-utils']).toBe('12.29.2');
  });
});
