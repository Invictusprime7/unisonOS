import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  GENERATED_UI_CATALOG_ENTRIES,
  GENERATED_UI_CATALOG_IMPORTS,
  GENERATED_UI_CATALOG_PATHS,
  GENERATED_UI_CATALOG_PROMPT_LINES,
  GENERATED_UI_CATALOG_ROOT,
  GENERATED_UI_CATALOG_RUNTIME_PACKAGES,
  GENERATED_UI_EXISTING_ROUTES,
  buildGeneratedUiCatalogFiles,
  radixRouteFor,
} from '@/platform/core/generatedUiCatalog';
import {
  REQUIRED_GENERATED_UI_FOUNDATION_PATHS,
  buildGeneratedUiFoundation,
  buildGeneratedUiFoundationDirective,
} from '@/platform/core/generatedUiFoundation';
import {
  SANDPACK_DEPENDENCIES,
  resolvePinnedRuntimeVersion,
} from '@/utils/sandpackDependencies';

const MARKER = 'UNISON GENERATED UI FOUNDATION';

/**
 * `.21st/design.json` is the record of what the project actually installed.
 * Every installed component must have exactly one canonical route a generated
 * page is allowed to import, or the wizard can never reach it.
 */
function installedComponentIds(): string[] {
  const raw = readFileSync(resolve(process.cwd(), '.21st/design.json'), 'utf8');
  const parsed = JSON.parse(raw) as { components?: { installed?: unknown } };
  const installed = parsed.components?.installed;
  const ids = Array.isArray(installed) ? installed : [];
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** Radix-derived ids are reachable as a class at "@/unison/ui/radix/<id>". */
const RADIX_ROUTED = new Set([
  'accordion', 'alert-dialog', 'aspect-ratio', 'avatar', 'checkbox', 'collapsible',
  'context-menu', 'dialog', 'dropdown-menu', 'hover-card', 'label', 'menubar',
  'navigation-menu', 'popover', 'progress', 'radio-group', 'scroll-area', 'select',
  'separator', 'slider', 'switch', 'tabs', 'toast', 'toggle', 'toggle-group', 'tooltip',
]);

function routeFor(id: string): string | null {
  const catalog = GENERATED_UI_CATALOG_ENTRIES.find((entry) => entry.id === id);
  if (catalog) return catalog.importPath;
  const existing = GENERATED_UI_EXISTING_ROUTES.find((entry) => entry.id === id);
  if (existing) return existing.importPath;
  if (RADIX_ROUTED.has(id)) return radixRouteFor(id).importPath;
  return null;
}

describe('generated UI component catalog', () => {
  const installed = installedComponentIds();

  it('reads a non-trivial installed component list from .21st/design.json', () => {
    expect(installed.length).toBeGreaterThanOrEqual(40);
  });

  it('gives every installed component exactly one canonical import route', () => {
    const unreachable = installed.filter((id) => routeFor(id) === null);
    expect(unreachable, `installed components with no canonical import route: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('never routes the same component through two different paths', () => {
    const seen = new Map<string, string>();
    for (const entry of [...GENERATED_UI_CATALOG_ENTRIES, ...GENERATED_UI_EXISTING_ROUTES]) {
      const previous = seen.get(entry.id);
      expect(previous === undefined || previous === entry.importPath, `duplicate route for ${entry.id}`).toBe(true);
      seen.set(entry.id, entry.importPath);
    }
  });

  it('keeps every catalog import under the catalog root', () => {
    for (const importPath of GENERATED_UI_CATALOG_IMPORTS) {
      expect(importPath === GENERATED_UI_CATALOG_ROOT || importPath.startsWith(`${GENERATED_UI_CATALOG_ROOT}/`)).toBe(true);
    }
    expect(GENERATED_UI_CATALOG_IMPORTS).toContain(GENERATED_UI_CATALOG_ROOT);
  });

  it('emits a real module for every declared catalog path plus the barrel', () => {
    const files = buildGeneratedUiCatalogFiles(MARKER);
    for (const path of GENERATED_UI_CATALOG_PATHS) {
      expect(Object.keys(files), `missing emitted catalog file ${path}`).toContain(path);
      expect(files[path]).toContain(MARKER);
      expect(files[path].trim().length).toBeGreaterThan(60);
    }
    expect(files['/src/unison/ui/catalog/index.ts']).toBeTruthy();
  });

  it('exports from each module the names its entry advertises', () => {
    const files = buildGeneratedUiCatalogFiles(MARKER);
    for (const entry of GENERATED_UI_CATALOG_ENTRIES) {
      const path = `/src/unison/ui/catalog/${entry.id}.tsx`;
      const source = files[path];
      expect(source, `no source for ${entry.id}`).toBeTruthy();
      for (const exported of entry.exports) {
        expect(source, `${entry.id} should export ${exported}`).toMatch(
          new RegExp(`export (?:const|function|type) ${exported}\\b|export \\{[^}]*\\b${exported}\\b`),
        );
      }
    }
  });

  it('styles catalog modules with tokens instead of hardcoded colors', () => {
    const files = buildGeneratedUiCatalogFiles(MARKER);
    for (const path of GENERATED_UI_CATALOG_PATHS) {
      expect(files[path], `${path} must not hardcode hex colors`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(files[path], `${path} must not hardcode white/black utilities`).not.toMatch(/\b(?:bg|text)-(?:white|black)\b/);
    }
  });

  it('is wired into the foundation contract the AI lanes read', () => {
    const foundation = buildGeneratedUiFoundation({ themePresetId: 'modern' });
    for (const path of GENERATED_UI_CATALOG_PATHS) {
      expect(REQUIRED_GENERATED_UI_FOUNDATION_PATHS).toContain(path);
      expect(Object.keys(foundation.files), `foundation should emit ${path}`).toContain(path);
    }
    for (const importPath of GENERATED_UI_CATALOG_IMPORTS) {
      expect(foundation.manifest.primitiveImports).toContain(importPath);
    }
    const directive = buildGeneratedUiFoundationDirective(foundation.manifest);
    for (const line of GENERATED_UI_CATALOG_PROMPT_LINES) {
      expect(directive).toContain(line);
    }
  });

  it('mirrors the catalog into the edge orchestrator prompt', () => {
    const serverPrompt = readFileSync(
      resolve(process.cwd(), 'supabase/functions/ai-code-assistant/orchestrator.ts'),
      'utf8',
    );
    for (const entry of GENERATED_UI_CATALOG_ENTRIES) {
      expect(serverPrompt, `server prompt should mention ${entry.importPath}`).toContain(entry.importPath);
    }
  });

  it('pins every runtime package the catalog depends on', () => {
    // recharts is deliberately left unpinned: projects may declare their own
    // chart version in package.json and that explicit pin must keep winning.
    for (const pkg of GENERATED_UI_CATALOG_RUNTIME_PACKAGES.filter((name) => name !== 'recharts')) {
      expect(Object.keys(SANDPACK_DEPENDENCIES), `${pkg} must be installable in preview`).toContain(pkg);
      expect(resolvePinnedRuntimeVersion(pkg) ?? 'latest', `${pkg} must be pinned, not floating`).not.toBe('latest');
    }
  });
});
