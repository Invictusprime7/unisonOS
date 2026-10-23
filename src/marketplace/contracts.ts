export type MarketplaceProductType =
  | 'site_template'
  | 'brand_ui_kit'
  | 'industry_launch_kit'
  | 'section_pack';

export type MarketplaceListingStatus =
  | 'draft'
  | 'in_review'
  | 'published'
  | 'suspended'
  | 'retired';

export type MarketplaceLicenseTier = 'personal' | 'commercial' | 'agency';

export interface PublicMarketplaceListing {
  id: string;
  slug: string;
  productType: MarketplaceProductType;
  title: string;
  industryKey: string;
  summary: string;
  priceCents: number;
  currency: string;
  currentReleaseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignReleaseManifestV1 {
  schemaVersion: 'marketplace-design-release/1';
  productType: MarketplaceProductType;
  industryKey: string;
  pageRoles: string[];
  source: {
    acceptedRevisionId: string;
    snapshotSha256: string;
    generationSeed?: string;
    designPlanSignature?: string;
  };
  design: {
    artDirectionPackId: string;
    themePresetId?: string;
    implementationIds: string[];
    registrySignature: string;
    designContractFingerprint?: string;
  };
  requirements: {
    runtimeMode: 'design-only' | 'requires-provisioning';
    capabilityIds: string[];
    requiredResourceKeys: string[];
    optionalIntegrations: string[];
  };
  assets: Array<{
    path: string;
    sha256: string;
    licenseClass: 'owned' | 'redistributable' | 'buyer-supplied' | 'reference-only';
  }>;
  export: {
    formats: Array<'unison-project' | 'vite-react-zip'>;
    licenseTier: MarketplaceLicenseTier;
  };
}