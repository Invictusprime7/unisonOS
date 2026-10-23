import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';
import { getDesignImplementation } from '@/services/designImplementationRegistry';
import { explainImplementationExclusion } from '@/services/designImplementationEligibility';

export interface AcceptedDesignRevisionEvidence {
  revisionId: string;
  snapshotSha256: string;
}

export type DesignReleaseIssueCode =
  | 'accepted-revision-mismatch'
  | 'invalid-snapshot-hash'
  | 'no-implementations'
  | 'duplicate-implementation'
  | 'implementation-unregistered'
  | 'implementation-ineligible'
  | 'asset-not-redistributable';

export interface DesignReleaseIssue {
  code: DesignReleaseIssueCode;
  message: string;
  implementationId?: string;
  assetPath?: string;
}

export interface DesignReleaseValidationResult {
  passed: boolean;
  issues: DesignReleaseIssue[];
}

export function validateDesignRelease(
  manifest: DesignReleaseManifestV1,
  acceptedRevision: AcceptedDesignRevisionEvidence,
): DesignReleaseValidationResult {
  const issues: DesignReleaseIssue[] = [];

  if (
    manifest.source.acceptedRevisionId !== acceptedRevision.revisionId
    || manifest.source.snapshotSha256 !== acceptedRevision.snapshotSha256
  ) {
    issues.push({
      code: 'accepted-revision-mismatch',
      message: 'The release source does not match the supplied accepted revision evidence.',
    });
  }

  if (!/^[a-f0-9]{64}$/i.test(manifest.source.snapshotSha256)) {
    issues.push({
      code: 'invalid-snapshot-hash',
      message: 'The source snapshot hash must be a 64-character SHA-256 hex digest.',
    });
  }

  if (manifest.design.implementationIds.length === 0) {
    issues.push({
      code: 'no-implementations',
      message: 'A release must declare at least one canonical design implementation.',
    });
  }

  const seenImplementations = new Set<string>();
  for (const implementationId of manifest.design.implementationIds) {
    if (seenImplementations.has(implementationId)) {
      issues.push({
        code: 'duplicate-implementation',
        message: `Implementation ${implementationId} is declared more than once.`,
        implementationId,
      });
      continue;
    }
    seenImplementations.add(implementationId);

    const implementation = getDesignImplementation(implementationId);
    if (!implementation) {
      issues.push({
        code: 'implementation-unregistered',
        message: `Implementation ${implementationId} is not in the canonical design registry.`,
        implementationId,
      });
      continue;
    }

    const exclusion = explainImplementationExclusion(implementationId, {
      sectionType: implementation.sectionType,
      industry: manifest.industryKey,
      artDirectionPackId: manifest.design.artDirectionPackId,
      themePresetId: manifest.design.themePresetId,
      availableCapabilities: [],
    });
    const declaredProvisioningRequirement = exclusion?.startsWith('capability:')
      && manifest.requirements.runtimeMode === 'requires-provisioning'
      && manifest.requirements.capabilityIds.includes(exclusion.slice('capability:'.length));
    if (exclusion && !declaredProvisioningRequirement) {
      issues.push({
        code: 'implementation-ineligible',
        message: `Implementation ${implementationId} is not eligible: ${exclusion}.`,
        implementationId,
      });
    }
  }

  for (const asset of manifest.assets) {
    if (asset.licenseClass === 'reference-only') {
      issues.push({
        code: 'asset-not-redistributable',
        message: `Reference-only asset ${asset.path} cannot be included in a distributable release.`,
        assetPath: asset.path,
      });
    }
  }

  return { passed: issues.length === 0, issues };
}