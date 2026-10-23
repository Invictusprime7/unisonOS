// Pure helpers for trusted release staging. Kept identical to
// src/marketplace/snapshotFingerprint.ts so client and server hashes agree.

export function stableJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((e) => e === undefined ? 'null' : stableJson(e)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((k) => record[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(record[k])}`).join(',')}}`;
  }
  throw new TypeError(`Snapshot contains a non-JSON value: ${typeof value}.`);
}

export async function sha256StableJson(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['stripe-secret-key', /\bsk_(live|test)_[A-Za-z0-9]{16,}/],
  ['service-role-jwt', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ['private-key', /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
  ['resend-key', /\bre_[A-Za-z0-9]{20,}/],
  ['openai-key', /\bsk-[A-Za-z0-9]{32,}/],
];

export function scanSnapshotForSecrets(files: Record<string, unknown>): Array<{ path: string; kind: string }> {
  const findings: Array<{ path: string; kind: string }> = [];
  for (const [path, contents] of Object.entries(files)) {
    if (typeof contents !== 'string') continue;
    for (const [kind, pattern] of SECRET_PATTERNS) {
      if (pattern.test(contents)) findings.push({ path, kind });
    }
  }
  return findings;
}

export function slugifyListing(name: string, projectId: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'template';
  return `${base}-${projectId.slice(0, 8)}`;
}

export function buildDesignOnlyManifest(input: {
  revisionId: string;
  snapshotSha256: string;
  industryKey: string;
  meta: Record<string, any>;
}) {
  const contract = input.meta?.templateDesignContract ?? {};
  const pages = Array.isArray(input.meta?.pages) ? input.meta.pages : [];
  return {
    schemaVersion: 'marketplace-design-release/1',
    productType: 'site_template',
    industryKey: input.industryKey,
    pageRoles: pages.map((p: any) => String(p?.archetype ?? p?.slug ?? '')).filter(Boolean),
    source: {
      acceptedRevisionId: input.revisionId,
      snapshotSha256: input.snapshotSha256,
      ...(typeof contract.seed === 'string' ? { generationSeed: contract.seed } : {}),
      ...(typeof contract.contractSignature === 'string' ? { designPlanSignature: contract.contractSignature } : {}),
    },
    design: {
      artDirectionPackId: String(input.meta?.artDirectionPackId ?? input.meta?.themeContract?.artDirectionPackId ?? 'unresolved'),
      implementationIds: typeof contract.implementationId === 'string' ? [contract.implementationId] : [],
      registrySignature: String(contract.registrySignature ?? 'unrecorded'),
      ...(typeof contract.layoutSignature === 'string' ? { designContractFingerprint: contract.layoutSignature } : {}),
    },
    requirements: { runtimeMode: 'design-only', capabilityIds: [], requiredResourceKeys: [], optionalIntegrations: [] },
    assets: [],
    export: { formats: ['unison-project', 'vite-react-zip'], licenseTier: 'personal' },
  };
}
