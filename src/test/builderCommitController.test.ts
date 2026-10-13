import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildCommitIdentity,
  buildCommitCurrent,
  buildCommitOptions,
  buildCommitInput,
  filterRedundantPresentationOps,
  commitAdoptionRecord,
  shouldSkipNoopFilePatch,
} from '@/services/builder/builderCommitController';
import type { SiteBundleSnapshot } from '@/platform/core';

const snapshot = {
  industry: 'salon',
  themeTokens: { '--primary': '340 60% 50%' },
  meta: {
    themePresetId: 'salon-premium',
    designIntervention: { activeVariants: { 'section-hero': 'hero:centered' } },
  },
} as unknown as SiteBundleSnapshot;

const context = {
  activePagePath: '/src/pages/Home.tsx',
  playground: { pageRegistry: { pages: [] }, creatorData: { a: 1 }, bindings: [], calendars: [], popups: [] },
};

describe('builder commit controller', () => {
  it('refuses an identity when the workspace is not bound to a site', () => {
    expect(buildCommitIdentity(null)).toBeNull();
    expect(buildCommitIdentity({ userId: 'u1', draftId: 'd1' })).toBeNull();
    expect(buildCommitIdentity({ userId: 'u1', businessId: 'b1' })).toBeNull();
  });

  it('falls back to the draft id when no durable project id is resolved', () => {
    expect(buildCommitIdentity({ userId: 'u1', businessId: 'b1', draftId: 'd1' })).toEqual({
      userId: 'u1',
      businessId: 'b1',
      projectId: 'd1',
      draftId: 'd1',
      revisionId: '',
      sessionId: 'web-builder:d1',
    });
    expect(buildCommitIdentity({ userId: 'u1', businessId: 'b1', draftId: 'd1', projectId: 'p1', revisionId: 'r1' })?.projectId)
      .toBe('p1');
  });

  it('always sends a complete canonical current state', () => {
    const current = buildCommitCurrent(context, { '/src/App.tsx': 'x' }, snapshot);
    expect(current.vfsFiles).toEqual({ '/src/App.tsx': 'x' });
    expect(current.siteBundleSnapshot).toBe(snapshot);
    expect(current.activePagePath).toBe('/src/pages/Home.tsx');
    expect(current.playground).toMatchObject({ pageRegistry: { pages: [] }, creatorData: { a: 1 } });
  });

  it('carries industry and theme identity without re-running the launch gates', () => {
    expect(buildCommitOptions(snapshot)).toEqual({
      requirePreviewPass: false,
      requireReadinessPass: false,
      industry: 'salon',
      themePresetId: 'salon-premium',
      themeTokens: { '--primary': '340 60% 50%' },
    });
    expect(buildCommitOptions(null)).toEqual({
      requirePreviewPass: false,
      requireReadinessPass: false,
      industry: undefined,
      themePresetId: undefined,
      themeTokens: undefined,
    });
  });

  it('assembles one canonical envelope for a builder mutation', () => {
    const identity = buildCommitIdentity({ userId: 'u1', businessId: 'b1', draftId: 'd1' })!;
    const input = buildCommitInput({
      source: 'playground-edit',
      identity,
      context,
      vfsFiles: {},
      snapshot,
      patch: { summary: 's', fileOps: [], presentationOps: [] } as never,
    });
    expect(input.source).toBe('playground-edit');
    expect(input.identity).toBe(identity);
    expect(input.options?.industry).toBe('salon');
  });

  it('drops variant selections the snapshot already holds', () => {
    const ops = [
      { type: 'setVariant', sectionId: 'section-hero', variantId: 'hero:centered' },
      { type: 'setVariant', sectionId: 'section-hero', variantId: 'hero:collage' },
      { type: 'reorderSections', pagePath: '/', order: ['a'] },
    ] as never[];
    const kept = filterRedundantPresentationOps(snapshot, ops);
    expect(kept).toHaveLength(2);
    expect(filterRedundantPresentationOps(null, ops)).toHaveLength(3);
  });

  it('marks an adoption as an accepted canonical revision', () => {
    expect(commitAdoptionRecord({ source: 'ai-builder', vfsHash: 'h', persistedRevisionId: 'r' } as never)).toEqual({
      source: 'ai-builder',
      vfsHash: 'h',
      revisionId: 'r',
    });
  });

  it('does not mistake an optimistic toolbar write for a durable no-op', () => {
    const currentFiles = { '/src/pages/Home.tsx': 'export default function Home(){return <h1>Edited</h1>}' };
    expect(shouldSkipNoopFilePatch('preview-toolbar', currentFiles, currentFiles)).toBe(false);
    expect(shouldSkipNoopFilePatch('playground-edit', currentFiles, currentFiles)).toBe(true);
    expect(shouldSkipNoopFilePatch('playground-edit', { '/src/pages/Home.tsx': 'old' }, currentFiles)).toBe(false);
  });

  it('leaves no hand-rolled commit envelope in the builder', () => {
    const builder = readFileSync('src/components/creatives/WebBuilder.tsx', 'utf8');
    expect(builder).not.toMatch(/sessionId: `web-builder:\$\{currentDraftId\}`/);
    expect(builder).not.toMatch(/requirePreviewPass: false,\s*\n\s*requireReadinessPass: false,/);
  });
});
