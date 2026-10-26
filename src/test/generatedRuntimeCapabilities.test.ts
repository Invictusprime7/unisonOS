import { describe, expect, it } from 'vitest';
import {
  GENERATED_RUNTIME_PROFILE,
  GENERATED_RUNTIME_CAPABILITY_DEPENDENCIES,
  THREE_D_CAPABILITY,
  findCapabilityForImport,
} from '@/platform/core/generatedRuntimeCapabilities';
import {
  SANDPACK_DEPENDENCIES,
  isSandpackAllowedImport,
} from '@/utils/sandpackDependencies';
import {
  GENERATED_UI_FOUNDATION_VERSION,
  buildGeneratedUiFoundation,
  readGeneratedUiManifest,
  validateGeneratedUiContract,
} from '@/platform/core/generatedUiFoundation';
import { runRuntimeCompatibilityPreflight } from '@/services/runtimeCompatibilityPreflight';
import { getDependenciesForSandpack } from '@/utils/dependencyExtractor';

const foundation = () => buildGeneratedUiFoundation({ themePresetId: 'obsidian', industry: 'ecommerce' });

describe('generated runtime profile', () => {
  it('pins one React runtime across every generated preview surface', () => {
    expect(GENERATED_RUNTIME_PROFILE.react.startsWith('^19')).toBe(true);
    expect(SANDPACK_DEPENDENCIES.react).toBe(GENERATED_RUNTIME_PROFILE.react);
    expect(SANDPACK_DEPENDENCIES['react-dom']).toBe(GENERATED_RUNTIME_PROFILE.reactDom);
  });

  it('derives sandpack 3D versions from the single capability source', () => {
    for (const [name, version] of Object.entries(GENERATED_RUNTIME_CAPABILITY_DEPENDENCIES)) {
      expect(SANDPACK_DEPENDENCIES[name]).toBe(version);
      expect(version).not.toBe('latest');
    }
    expect(findCapabilityForImport('@react-three/drei/core')?.id).toBe(THREE_D_CAPABILITY.id);
    expect(findCapabilityForImport('lucide-react')).toBeNull();
  });

  it('keeps unknown packages rejected', () => {
    expect(isSandpackAllowedImport('three')).toBe(true);
    expect(isSandpackAllowedImport('@totally/unknown-pkg')).toBe(false);
  });
});

describe('generated UI manifest migration', () => {
  it('writes the current version with experience capability metadata', () => {
    const { manifest } = foundation();
    expect(manifest.version).toBe(GENERATED_UI_FOUNDATION_VERSION);
    expect(manifest.runtimeProfile).toBe(GENERATED_RUNTIME_PROFILE.id);
    expect(manifest.experience.importRoot).toBe('@/unison/ui/experience');
    expect(manifest.experience.capabilities).toContain(THREE_D_CAPABILITY.id);
    expect(manifest.experience.budget.webglFallback).toBe(true);
    expect(manifest.primitiveImports).toContain('@/unison/ui/experience');
  });

  it('hydrates a legacy 1.1 manifest through migration', () => {
    const legacy = {
      version: '1.1',
      importRoot: '@/unison/ui',
      primitiveImports: ['@/unison/ui', '@/unison/ui/button'],
      iconLibrary: 'lucide-react',
      layoutRecipes: [],
      interactions: [],
      requirements: [],
    };
    const files = { '/.unison/ui-manifest.json': JSON.stringify(legacy) };
    const original = JSON.stringify(files);
    const migrated = readGeneratedUiManifest(files);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(GENERATED_UI_FOUNDATION_VERSION);
    expect(migrated!.runtimeProfile).toBe('legacy-unspecified');
    expect(migrated!.experience.capabilities).toEqual([]);
    expect(migrated!.experience.runtimeDependencies).toEqual({});
    expect(migrated!.primitiveImports).toEqual(legacy.primitiveImports);
    expect(JSON.stringify(files)).toBe(original);
  });

  it('preserves declared historical runtime and experience metadata without mutating stored bytes', () => {
    const { manifest } = foundation();
    const legacy = {
      ...manifest, version: '1.2', runtimeProfile: 'react18-historical',
      experience: { ...manifest.experience, capabilities: [], runtimeDependencies: {}, budget: { ...manifest.experience.budget, maxCanvasRoots: 1 } },
    };
    const files = { '/.unison/ui-manifest.json': JSON.stringify(legacy) };
    const original = JSON.stringify(files);
    const migrated = readGeneratedUiManifest(files)!;
    expect(migrated.runtimeProfile).toBe('react18-historical');
    expect(migrated.experience.capabilities).toEqual([]);
    expect(migrated.experience.runtimeDependencies).toEqual({});
    expect(migrated.experience.budget.maxCanvasRoots).toBe(1);
    expect(JSON.stringify(files)).toBe(original);
  });
});

describe('Lane B contract', () => {
  it('accepts an approved experience facade import on the first pass', () => {
    const { manifest } = foundation();
    const result = validateGeneratedUiContract(
      {
        '/src/pages/Home.tsx':
          "import { ProductStage } from '@/unison/ui/experience';\nexport default function Home() { return <ProductStage alt=\"Chair\" />; }",
      },
      manifest,
    );
    expect(result.violations).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects a direct three/fiber import from a page', () => {
    const { manifest } = foundation();
    const result = validateGeneratedUiContract(
      { '/src/pages/Home.tsx': "import { Canvas } from '@react-three/fiber';\nexport default function Home() { return null; }" },
      manifest,
    );
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('@/unison/ui/experience');
  });

  it('rejects Lane B attempts to own foundation or theme files', () => {
    const { manifest } = foundation();
    const result = validateGeneratedUiContract(
      {
        '/src/unison/ui/experience/canvas.tsx': 'export const x = 1;',
        '/src/index.css': ':root {}',
      },
      manifest,
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(2);
  });
});

describe('runtime compatibility preflight', () => {
  const buildFiles = (page: string) => ({ ...foundation().files, '/src/pages/Home.tsx': page });

  it('passes a 3D page whose dependencies are installed', () => {
    const files = buildFiles(
      "import { ProductStage } from '@/unison/ui/experience';\nexport default function Home() { return <ProductStage alt=\"Chair\" />; }",
    );
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({ files, dependencies, approvedCapabilities: [THREE_D_CAPABILITY.id] });
    expect(report.blockers).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.capabilitiesUsed).toContain(THREE_D_CAPABILITY.id);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('blocks a mismatched React renderer profile', () => {
    const files = buildFiles(
      "import { ProductStage } from '@/unison/ui/experience';\nexport default function Home() { return <ProductStage alt=\"Chair\" />; }",
    );
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({
      files,
      dependencies: { ...dependencies, react: '^18.3.1' },
    });
    expect(report.reactRuntimeCompatible).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('rejects unapproved experience instances reached through the root UI facade', () => {
    const files = buildFiles(
      "import { ProductStage } from '@/unison/ui';\nexport default function Home() { return <ProductStage alt=\"Chair\" />; }",
    );
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({ files, dependencies, approvedCapabilities: [] });
    expect(report.importsApproved).toBe(false);
    expect(report.blockers.join(' ')).toContain('which this launch did not approve');
  });

  it('retains compatibility for existing facade sites without an approval declaration', () => {
    const files = buildFiles(
      "import { ProductStage } from '@/unison/ui/experience';\nexport default function Home() { return <ProductStage alt=\"Chair\" />; }",
    );
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({
      files,
      dependencies,
    });
    expect(report.ok).toBe(true);
  });

  it('accepts an unknown package after it is added to the resolved site dependency graph', () => {
    const files = buildFiles("import x from 'totally-unknown-pkg';\nexport default function Home() { return null; }");
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({ files, dependencies });
    expect(dependencies['totally-unknown-pkg']).toBe('latest');
    expect(report.importsApproved).toBe(true);
    expect(report.ok).toBe(true);
  });

  it.each([{ approved: [] }, { approved: ['commerce.catalog'] }])('reports no experience capability for an ordinary DOM page with approvals $approved', ({ approved }) => {
    const files = buildFiles("export default function Home() { return <main>Hi</main>; }");
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({
      files,
      dependencies,
      approvedCapabilities: approved,
    });
    expect(report.ok).toBe(true);
    expect(report.capabilitiesUsed).not.toContain(THREE_D_CAPABILITY.id);
  });

  it.each([{ approved: [] }, { approved: ['commerce.catalog'] }])('blocks an experience facade for approvals $approved', ({ approved }) => {
    const files = buildFiles(
      "import { ProductStage } from '@/unison/ui/experience';\nexport default function Home() { return <ProductStage alt=\"Chair\" />; }",
    );
    const { dependencies } = getDependenciesForSandpack(files, SANDPACK_DEPENDENCIES);
    const report = runRuntimeCompatibilityPreflight({
      files,
      dependencies,
      approvedCapabilities: approved,
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toEqual([
      '/src/pages/Home.tsx reaches capability "experience.three-d", which this launch did not approve.',
    ]);
  });
});
