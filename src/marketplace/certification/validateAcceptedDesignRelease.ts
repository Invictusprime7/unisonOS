import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';
import {
  loadAcceptedRevisionEvidence,
  type AcceptedRevisionEvidenceReader,
} from '@/marketplace/certification/acceptedRevisionEvidence';
import {
  validateDesignRelease,
  type DesignReleaseValidationResult,
} from '@/marketplace/certification/validateDesignRelease';
import {
  validateRedistribution,
  type AssetRedistributionReview,
  type RedistributionValidationResult,
} from '@/marketplace/certification/validateRedistribution';
import { scanReleaseSource, type ReleaseSourceScanResult } from '@/marketplace/certification/scanReleaseSource';

export interface ValidateAcceptedDesignReleaseInput {
  manifest: DesignReleaseManifestV1;
  projectId: string;
  acceptedRevisionId: string;
  assetReviews: readonly AssetRedistributionReview[];
  privateValues: readonly string[];
}

export interface AcceptedDesignReleaseValidation {
  checksPassed: boolean;
  publicationEligible: false;
  design: DesignReleaseValidationResult;
  redistribution: RedistributionValidationResult;
  sourceScan: ReleaseSourceScanResult;
  snapshotSha256: string;
}

export async function validateAcceptedDesignRelease(
  input: ValidateAcceptedDesignReleaseInput,
  reader?: AcceptedRevisionEvidenceReader,
): Promise<AcceptedDesignReleaseValidation> {
  const evidence = await loadAcceptedRevisionEvidence({
    projectId: input.projectId,
    revisionId: input.acceptedRevisionId,
  }, reader);

  const design = validateDesignRelease(input.manifest, {
    revisionId: evidence.revisionId,
    snapshotSha256: evidence.snapshotSha256,
  });
  const redistribution = validateRedistribution(input.manifest, input.assetReviews);
  const sourceScan = scanReleaseSource(evidence.snapshot, input.privateValues);

  return {
    checksPassed: design.passed && redistribution.passed && sourceScan.passed,
    publicationEligible: false,
    design,
    redistribution,
    sourceScan,
    snapshotSha256: evidence.snapshotSha256,
  };
}