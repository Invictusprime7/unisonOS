import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';

export type ReleaseSourceIssueCode = 'credential-pattern' | 'private-value-present';

const SNAPSHOT_METADATA_PATH = '/.unison/site-bundle-snapshot.json';

export interface ReleaseSourceIssue {
  code: ReleaseSourceIssueCode;
  path: string;
}

export interface ReleaseSourceScanResult {
  passed: boolean;
  issues: ReleaseSourceIssue[];
}

const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{24,}/i,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*['"]?[A-Za-z0-9._~+/-]{20,}/i,
];

export function scanReleaseSource(
  snapshot: SiteBundleSnapshot,
  privateValues: readonly string[] = [],
): ReleaseSourceScanResult {
  const privateNeedles = [...new Set(privateValues
    .map((value) => value.trim())
    .filter((value) => value.length >= 4))];
  const issues: ReleaseSourceIssue[] = [];

  for (const [path, contents] of Object.entries(snapshot.vfsFiles)) {
    if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(contents))) {
      issues.push({ code: 'credential-pattern', path });
      continue;
    }

    const lowerContents = contents.toLocaleLowerCase();
    if (privateNeedles.some((needle) => lowerContents.includes(needle.toLocaleLowerCase()))) {
      issues.push({ code: 'private-value-present', path });
    }
  }

  const { vfsFiles: _vfsFiles, ...metadata } = snapshot;
  const metadataText = JSON.stringify(metadata);
  if (metadataText && CREDENTIAL_PATTERNS.some((pattern) => pattern.test(metadataText))) {
    issues.push({ code: 'credential-pattern', path: SNAPSHOT_METADATA_PATH });
  }
  if (
    metadataText
    && privateNeedles.some((needle) => metadataText.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))
  ) {
    issues.push({ code: 'private-value-present', path: SNAPSHOT_METADATA_PATH });
  }

  return { passed: issues.length === 0, issues };
}