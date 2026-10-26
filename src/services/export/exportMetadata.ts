import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { CAPABILITY_REGISTRY } from '@/platform/core/capabilityRegistry';
import type { RuntimeManifest } from '@/types/runtimeManifest';
import { computeSiteBundleSnapshotSha256 } from '@/marketplace/snapshotFingerprint';
import { readSealedArtDirection } from '@/sections/variants/resolvedArtDirection';

function sha256Hex(value: string): Promise<string> {
  return globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
}

function mediaType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    avif: 'image/avif', gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg',
    png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp', woff: 'font/woff',
    woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4',
    webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
  };
  return (extension && types[extension]) || 'application/octet-stream';
}

function isAssetPath(path: string): boolean {
  return /\.(?:avif|gif|jpe?g|png|svg|webp|woff2?|ttf|otf|mp4|webm|mp3|wav)$/i.test(path);
}

export async function buildAssetManifest(files: Record<string, string>) {
  const localAssets = await Promise.all(Object.entries(files)
    .filter(([path]) => isAssetPath(path))
    .map(async ([path, contents]) => ({
      path: path.replace(/^\//, ''),
      mediaType: mediaType(path),
      sha256: await sha256Hex(contents),
      licenseReviewStatus: 'unverified' as const,
    })));

  const externalBySource = new Map<string, Set<string>>();
  const urlPattern = /https?:\/\/([^/\s"'<>?#]+)(?:[^\s"'<>]*)/g;
  for (const [path, contents] of Object.entries(files)) {
    if (!/\.(?:tsx?|jsx?|mjs|cjs|css|html)$/i.test(path)) continue;
    for (const match of contents.matchAll(urlPattern)) {
      let host: string;
      try {
        host = new URL(match[0]).hostname;
      } catch {
        host = match[1].split(':')[0];
      }
      if (!host) continue;
      const sources = externalBySource.get(host) ?? new Set<string>();
      sources.add(path.replace(/^\//, ''));
      externalBySource.set(host, sources);
    }
  }

  return {
    schemaVersion: 'unison-asset-manifest/1',
    localAssets: localAssets.sort((a, b) => a.path.localeCompare(b.path)),
    externalReferences: [...externalBySource.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([host, sourcePaths]) => ({
        host,
        sourcePaths: [...sourcePaths].sort(),
        licenseReviewStatus: 'unverified' as const,
      })),
  };
}

export async function buildProjectExportMetadata(input: {
  projectName: string;
  entryPoint: string;
  files: Record<string, string>;
  snapshot: SiteBundleSnapshot | null;
  runtimeManifest?: RuntimeManifest;
  exportedAt?: string;
}) {
  const { projectName, entryPoint, files, snapshot, runtimeManifest } = input;
  const filePaths = Object.keys(files).map((path) => path.replace(/^\//, '')).sort();
  const snapshotSha256 = snapshot ? await computeSiteBundleSnapshotSha256(snapshot) : null;
  const resolvedArtDirection = snapshot ? readSealedArtDirection(snapshot.meta) : null;
  const design = snapshot ? {
    snapshotId: snapshot.snapshotId,
    industry: snapshot.industry,
    systemId: snapshot.meta.systemId,
    templateId: snapshot.meta.templateId ?? null,
    themePresetId: snapshot.meta.themePresetId ?? null,
    artDirectionPackId: resolvedArtDirection?.storagePackId ?? null,
    generationSeed: snapshot.meta.generationSeed ?? null,
    designPlanSignature: snapshot.meta.designPlanSignature ?? null,
    renderHash: snapshot.meta.renderHash ?? null,
    themeTokens: snapshot.themeTokens ?? null,
    pages: Object.values(snapshot.pageRegistry?.pages ?? {})
      .map((page) => ({
        pageId: page.pageId,
        path: page.path,
        filePath: page.filePath ?? null,
        pageType: page.pageType,
        pageRole: page.pageRole ?? null,
        isHome: page.isHome,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  } : null;

  const capabilityIds = new Set([
    ...(snapshot?.businessSystem?.capabilities ?? []).map((capability) => capability.id),
  ]);
  const backendCapabilities = [...capabilityIds].sort().map((id) => {
    const definition = CAPABILITY_REGISTRY[id as keyof typeof CAPABILITY_REGISTRY];
    if (!definition) return { id, registered: false };
    return {
      id,
      registered: true,
      requiredTables: [...definition.database.requiredTables],
      requiredColumns: [...definition.database.requiredColumns],
      rlsPolicies: [...definition.database.rlsPolicies],
      functions: [...definition.backend.functions],
      events: [...definition.backend.events],
      permissions: [...definition.backend.permissions],
      intents: [...definition.intents.provided],
    };
  });

  const safeRuntimeManifest = runtimeManifest ? {
    schemaVersion: 'unison-runtime-export/1',
    entryPoint,
    backendRequired: runtimeManifest.backendRequired,
    previewEngine: runtimeManifest.previewEngine,
    routes: [...runtimeManifest.routes],
    dependencies: { ...runtimeManifest.dependencies },
    envRequirements: [...runtimeManifest.envRequirements],
    industry: runtimeManifest.industry ?? null,
    brandName: runtimeManifest.brandName ?? null,
  } : {
    schemaVersion: 'unison-runtime-export/1',
    entryPoint,
    backendRequired: false,
    previewEngine: 'sandpack',
    routes: [],
    dependencies: {},
    envRequirements: [],
    industry: snapshot?.industry ?? null,
    brandName: projectName,
  };

  const assetManifest = await buildAssetManifest(files);
  const projectManifest = {
    schemaVersion: 'unison-project-manifest/1',
    projectName,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    entryPoint,
    snapshot: snapshot ? {
      id: snapshot.snapshotId,
      sha256: snapshotSha256,
    } : null,
    designContext: 'design-context.json',
    runtimeManifest: 'unison.runtime.json',
    backendCapabilities: 'backend-capabilities.json',
    assetManifest: 'asset-manifest.json',
    sourceFileCount: filePaths.length,
    filePaths,
  };

  return {
    projectManifest,
    designContext: design ? { schemaVersion: 'unison-design-context/1', ...design } : null,
    runtimeManifest: safeRuntimeManifest,
    backendCapabilities: {
      schemaVersion: 'unison-backend-capabilities/1',
      declared: backendCapabilities,
    },
    assetManifest,
  };
}