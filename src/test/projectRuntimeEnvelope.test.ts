import { describe, expect, it } from 'vitest';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import {
  buildProjectRuntimeEnvelope,
  projectRuntimeProjectionFromRows,
  resolveHydratedBusinessId,
  resolveProjectActivePagePath,
} from '@/services/projectRuntimeEnvelope';
import type { LoadedRevision } from '@/services/vfsCommitService';
import {
  InvalidProjectRuntimeEnvelopeError,
  assertProjectRuntimeEnvelope,
} from '@/types/projectRuntimeEnvelope';

const identity = {
  workspaceId: 'workspace-1',
  businessId: 'business-1',
  projectId: 'project-1',
  draftId: 'draft-1',
};

function snapshot(): SiteBundleSnapshot {
  return {
    snapshotId: 'snapshot-1',
    businessName: 'Studio',
    industry: 'photography',
    pageRegistry: { pages: {}, routes: [], homePageId: '' },
    vfsFiles: { '/src/App.tsx': 'export default function App() { return null; }' },
    routerFile: { path: '/src/App.tsx', content: '' },
    manifest: { pages: [], navigation: [], routes: [] },
    bindings: {},
    calendars: {},
    popups: {},
    creatorData: { sections: {}, elements: {}, componentInstances: {} },
    componentInstances: {},
    routes: ['/'],
    homeRoute: '/',
    createdAt: '2026-08-12T00:00:00.000Z',
    appContext: {
      generatedAt: '2026-08-12T00:00:00.000Z',
      runtimeContext: {
        workspaceId: identity.workspaceId,
        businessId: identity.businessId,
        projectId: identity.projectId,
        websiteId: 'website-1',
        snapshotId: 'snapshot-1',
        environment: 'builder',
      },
    },
    businessSystem: {
      version: '1.0',
      requestedCapabilities: ['booking.appointments'],
      capabilities: [{
        id: 'booking',
        provides: ['booking.appointments'],
        status: 'provisioned',
        approval: { approvedBy: 'user-1', approvedAt: '2026-08-12T00:00:00.000Z' },
      }],
    },
    meta: { source: 'wizard', systemId: 'booking', industry: 'photography', verticalContractId: 'booking' },
  } as unknown as SiteBundleSnapshot;
}

function revision(siteBundleSnapshot = snapshot()): LoadedRevision {
  return {
    id: 'revision-1',
    projectId: identity.projectId,
    businessId: identity.businessId,
    draftId: identity.draftId,
    source: 'wizard-launch',
    status: 'committed',
    vfsFiles: siteBundleSnapshot.vfsFiles,
    siteBundleSnapshot,
    runtimeManifest: {},
    playground: null,
    readinessReport: {},
    diagnostics: [],
    publishReady: false,
    publishBlockers: [],
    vfsHash: null,
    candidateId: null,
    operationIds: ['operation-1'],
    fileProvenance: {},
    createdAt: '2026-08-12T00:00:00.000Z',
  };
}

describe('ProjectRuntimeEnvelope', () => {
  it('recovers business identity only from the matching accepted project and draft revision', () => {
    const loaded = revision();
    expect(resolveHydratedBusinessId(loaded, identity)).toBe(identity.businessId);
    expect(resolveHydratedBusinessId(loaded, { ...identity, projectId: 'other-project' })).toBeNull();
    expect(resolveHydratedBusinessId(loaded, { ...identity, draftId: 'other-draft' })).toBeNull();
    expect(resolveHydratedBusinessId(null, identity)).toBeNull();
  });

  it('assembles the durable identity, snapshot revision and capabilities from a persisted revision', () => {
    const envelope = buildProjectRuntimeEnvelope({
      workspaceId: identity.workspaceId,
      revision: revision(),
      activePagePath: '/src/App.tsx',
    });

    expect(envelope.identity).toEqual(identity);
    expect(envelope.snapshotVersion).toBe('snapshot-1');
    expect(envelope.revisionId).toBe('revision-1');
    expect(envelope.navigation.activePagePath).toBe('/src/App.tsx');
    expect(envelope.provisionedCapabilities).toEqual(['booking.appointments']);
    expect(envelope.persistence.status).toBe('persisted');
    expect(envelope.synchronization.status).toBe('synchronized');
  });

  it('restores published revision and selected page from durable projections', () => {
    const persistedSnapshot = snapshot();
    persistedSnapshot.vfsFiles['/src/pages/Contact.tsx'] = 'export default function Contact() { return null; }';
    const projection = projectRuntimeProjectionFromRows(
      { active_published_revision_id: 'revision-1' },
      { metadata: { activePagePath: '/src/pages/Contact.tsx' } },
    );

    const envelope = buildProjectRuntimeEnvelope({
      workspaceId: identity.workspaceId,
      revision: revision(persistedSnapshot),
      activePublishedRevisionId: projection.activePublishedRevisionId,
      activePagePath: projection.activePagePath,
      runtimeMode: projection.activePublishedRevisionId === 'revision-1' ? 'published' : 'draft',
    });

    expect(envelope.activePublishedRevisionId).toBe('revision-1');
    expect(envelope.navigation.activePagePath).toBe('/src/pages/Contact.tsx');
    expect(envelope.runtimeMode).toBe('published');
  });

  it('rejects snapshot identity drift', () => {
    const envelope = buildProjectRuntimeEnvelope({
      workspaceId: identity.workspaceId,
      revision: revision(),
      activePagePath: '/src/App.tsx',
    });
    envelope.identity.businessId = 'different-business';

    expect(() => assertProjectRuntimeEnvelope(envelope)).toThrow(InvalidProjectRuntimeEnvelopeError);
  });

  it('rejects published mode when the active pointer references another revision', () => {
    expect(() => buildProjectRuntimeEnvelope({
      workspaceId: identity.workspaceId,
      revision: revision(),
      activePublishedRevisionId: 'revision-2',
      activePagePath: '/src/App.tsx',
      runtimeMode: 'published',
    })).toThrow(InvalidProjectRuntimeEnvelopeError);
  });

  it('rejects missing persisted navigation instead of selecting a fallback', () => {
    expect(() => resolveProjectActivePagePath(snapshot(), null))
      .toThrow('missing persisted active page path');
  });

  it('rejects stale persisted navigation instead of selecting a fallback', () => {
    expect(() => resolveProjectActivePagePath(snapshot(), '/src/pages/Deleted.tsx'))
      .toThrow('persisted active page path is not present in snapshot.vfsFiles');
  });
});
