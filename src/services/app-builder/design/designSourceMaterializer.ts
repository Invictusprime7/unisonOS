/** System-owned materialization of resolved design sources into a candidate workspace. */

import type { DesignSourceBundle } from './DesignSourceBundle';
import { DESIGN_SOURCE_BUNDLE_VERSION } from './DesignSourceBundle';
import { compilePortableRecipes, DESIGN_SOURCE_ROOT, type MaterializedDesignModule } from './portableRecipeCompiler';
import { compilerOwnershipHash } from '@/platform/core/resolvedComposition';
import { getVariantById, type VariantId } from '@/sections/variants';

export const DESIGN_SOURCE_MANIFEST_PATH = '/.unison/design-source-manifest.json';

export interface DesignSourceManifest {
  version: typeof DESIGN_SOURCE_BUNDLE_VERSION;
  root: string;
  modules: MaterializedDesignModule[];
  implementations: Record<string, { modulePath: string; sectionType: string; certification: string; exportName?: string; props?: string }>;
  unresolved: string[];
}

export interface DesignSourceMaterialization {
  files: Record<string, string>;
  manifest: DesignSourceManifest;
}

/** Live compiler-owned bytes, not a second registry or inferred export names. */
export function readMaterializedDesignSources(files?: Readonly<Record<string, string>>): DesignSourceManifest['implementations'] {
  const raw = files?.[DESIGN_SOURCE_MANIFEST_PATH];
  if (!raw || !files) return {};
  try {
    const manifest = JSON.parse(raw) as DesignSourceManifest;
    if (manifest.version !== DESIGN_SOURCE_BUNDLE_VERSION || manifest.root !== DESIGN_SOURCE_ROOT || !Array.isArray(manifest.modules)) return {};
    const verified = new Set(manifest.modules.filter(module =>
      module.path.startsWith(DESIGN_SOURCE_ROOT + '/') && typeof files[module.path] === 'string'
      && compilerOwnershipHash(files[module.path]) === module.hash,
    ).map(module => module.path));
    return Object.fromEntries(Object.entries(manifest.implementations ?? {}).filter(([id, entry]) => {
      const variant = getVariantById(id as VariantId);
      return variant?.vfs?.mode === 'portable-recipe' && variant.vfs.certification === 'approved'
        && variant.sectionType === entry.sectionType && entry.certification === 'approved'
        && verified.has(entry.modulePath) && verified.has(entry.modulePath.replace(/\/([^/]+)\.tsx$/, '/recipes/$1.ts'))
        && typeof entry.exportName === 'string'
        && files[entry.modulePath].includes('export const ' + entry.exportName + ' =')
        && files[entry.modulePath].includes('variantId=' + JSON.stringify(id));
    }));
  } catch { return {}; }
}

export function materializeDesignSources(bundle: DesignSourceBundle): DesignSourceMaterialization {
  const compiled = compilePortableRecipes(bundle);
  const implementations: DesignSourceManifest['implementations'] = {};
  for (const impl of bundle.implementations) {
    const modulePath = compiled.implementationModules[impl.implementationId];
    if (modulePath) implementations[impl.implementationId] = { modulePath, sectionType: impl.sectionType, certification: impl.certification, exportName: compiled.exportNames[impl.implementationId], props: compiled.propHints[impl.implementationId] };
  }
  const manifest: DesignSourceManifest = {
    version: DESIGN_SOURCE_BUNDLE_VERSION,
    root: DESIGN_SOURCE_ROOT,
    modules: compiled.modules,
    implementations,
    unresolved: compiled.unresolved,
  };
  return { files: { ...compiled.files, [DESIGN_SOURCE_MANIFEST_PATH]: `${JSON.stringify(manifest, null, 2)}\n` }, manifest };
}

/** Rewrites system-owned design-source paths over a workspace; everything else is untouched. */
export function applyDesignSources(base: Readonly<Record<string, string>>, materialization: DesignSourceMaterialization): Record<string, string> {
  const next = { ...base };
  for (const path of Object.keys(next)) {
    if (path.startsWith(`${DESIGN_SOURCE_ROOT}/`)) delete next[path];
  }
  return { ...next, ...materialization.files };
}
