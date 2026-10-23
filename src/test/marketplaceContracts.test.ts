import { describe, expect, it } from 'vitest';
import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';

const designOnlyManifest = {
  schemaVersion: 'marketplace-design-release/1',
  productType: 'site_template',
  industryKey: 'salon',
  pageRoles: ['home', 'services', 'contact'],
  source: {
    acceptedRevisionId: 'revision-1',
    snapshotSha256: 'a'.repeat(64),
  },
  design: {
    artDirectionPackId: 'editorial-noir',
    implementationIds: ['hero:editorial'],
    registrySignature: 'registry-v1',
  },
  requirements: {
    runtimeMode: 'design-only',
    capabilityIds: [],
    requiredResourceKeys: [],
    optionalIntegrations: [],
  },
  assets: [
    {
      path: '/assets/hero.webp',
      sha256: 'b'.repeat(64),
      licenseClass: 'redistributable',
    },
  ],
  export: {
    formats: ['unison-project', 'vite-react-zip'],
    licenseTier: 'personal',
  },
} satisfies DesignReleaseManifestV1;

describe('marketplace design release contract', () => {
  it('captures a design-only release without implying live capabilities', () => {
    expect(designOnlyManifest.productType).toBe('site_template');
    expect(designOnlyManifest.requirements.runtimeMode).toBe('design-only');
    expect(designOnlyManifest.requirements.capabilityIds).toEqual([]);
  });

  it('records source, design, asset provenance, and export licensing', () => {
    expect(designOnlyManifest.source.snapshotSha256).toHaveLength(64);
    expect(designOnlyManifest.design.implementationIds).toEqual(['hero:editorial']);
    expect(designOnlyManifest.assets[0].licenseClass).toBe('redistributable');
    expect(designOnlyManifest.export.formats).toContain('vite-react-zip');
    expect(designOnlyManifest.export.licenseTier).toBe('personal');
  });
});