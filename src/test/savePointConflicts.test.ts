import { afterEach, describe, expect, it } from 'vitest';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import {
  absorbPendingVfsOperations,
  clearPendingVfsOperations,
  getPendingVfsOperations,
  getPendingVfsSequenceWatermark,
  projectSnapshotVfsFiles,
  recordPendingVfsMutation,
  resolvePendingVfsConflicts,
} from '@/services/snapshotProjector';
import { rebaseTextEdit } from '@/services/builder/textEditRebase';
import {
  getHeldEdits,
  holdEditUntilAiIdle,
  onAiIdleWithHeldEdits,
  setAiGenerationActive,
  takeHeldEdits,
} from '@/services/builder/builderMutationCoordinator';
import { describeRunOutcome } from '@/components/creatives/web-builder/ai-chat/activityOutcome';
import { isPreviewPipelineError } from '@/services/previewPipelineError';

function snapshotWith(files: Record<string, string>): SiteBundleSnapshot {
  return {
    snapshotId: 'save-points', businessName: 'B', industry: 'restaurant',
    pageRegistry: { pages: {} } as SiteBundleSnapshot['pageRegistry'],
    vfsFiles: files, routerFile: { path: '/src/App.tsx', content: files['/src/App.tsx'] || '' },
    manifest: {} as SiteBundleSnapshot['manifest'], bindings: {}, calendars: {}, popups: {},
    creatorData: {} as SiteBundleSnapshot['creatorData'], componentInstances: {},
    routes: ['/'], homeRoute: '/', createdAt: '2026-10-17T00:00:00.000Z',
    meta: {
      source: 'wizard', systemId: 'booking', industry: 'restaurant', verticalContractId: 'booking',
      themePresetId: 'restaurant-warm', templateId: 'restaurant-premium',
      themeInjection: { version: '1.0', stage: '4b', presetId: 'restaurant-warm', cssPath: '/src/index.css' },
      seal: { version: '1.0', sealedAt: '2026-10-17T00:00:00.000Z', sealedBy: 'wizard-launch', compileArtifactId: 'c', fileCount: Object.keys(files).length },
    },
  };
}

const project = (files: Record<string, string>, scope: string, revision: string) =>
  projectSnapshotVfsFiles(files, {
    snapshot: snapshotWith(files), isWizardDraft: true, themePresetId: 'restaurant-warm',
    projectionScope: scope, acceptedRevisionId: revision,
  });

const R1 = { '/src/App.tsx': 'router', '/src/index.css': ':root{--primary:1}', '/src/pages/Home.tsx': '<h1>Hello</h1><p>Old</p>' };

afterEach(() => {
  clearPendingVfsOperations();
  takeHeldEdits();
});

describe('save points never raise the conflict block', () => {
  it('shared code editor save, then typing, projects cleanly', () => {
    const scope = 'shared-editor';
    // The editor save produced R2; the autosave baseline still holds R1 bytes.
    const R2 = { ...R1, '/src/pages/Home.tsx': '<h1>Hello</h1><p>Editor</p>' };
    absorbPendingVfsOperations(scope, { throughSequence: getPendingVfsSequenceWatermark() });
    recordPendingVfsMutation({
      scope, baseRevisionId: 'R2', beforeFiles: R1,
      afterFiles: { ...R2, '/src/pages/Home.tsx': '<h1>Hi</h1><p>Editor</p>' },
    });
    expect(project(R2, scope, 'R2')['/src/pages/Home.tsx']).toBe('<h1>Hi</h1><p>Editor</p>');
  });

  it('theme save absorbs typing recorded before it and accepts typing after it', () => {
    const scope = 'theme-save';
    recordPendingVfsMutation({
      scope, baseRevisionId: 'R1', beforeFiles: R1,
      afterFiles: { ...R1, '/src/pages/Home.tsx': '<h1>Typed</h1><p>Old</p>' },
    });
    const watermark = getPendingVfsSequenceWatermark();
    const R2 = { ...R1, '/src/index.css': ':root{--primary:2}', '/src/pages/Home.tsx': '<h1>Typed</h1><p>Old</p>' };
    absorbPendingVfsOperations(scope, { throughSequence: watermark });
    expect(getPendingVfsOperations(scope)).toHaveLength(0);
    recordPendingVfsMutation({
      scope, baseRevisionId: 'R2', beforeFiles: R1,
      afterFiles: { ...R2, '/src/pages/Home.tsx': '<h1>Typed again</h1><p>Old</p>' },
    });
    const projected = project(R2, scope, 'R2');
    expect(projected['/src/index.css']).toBe(':root{--primary:2}');
    expect(projected['/src/pages/Home.tsx']).toBe('<h1>Typed again</h1><p>Old</p>');
  });

  it('style change save from the toolbar, then typing, projects cleanly', () => {
    const scope = 'style-save';
    const R2 = { ...R1, '/src/pages/Home.tsx': '<h1 className="text-primary">Hello</h1><p>Old</p>' };
    absorbPendingVfsOperations(scope);
    recordPendingVfsMutation({
      scope, baseRevisionId: 'R2', beforeFiles: R1,
      afterFiles: { ...R2, '/src/pages/Home.tsx': '<h1 className="text-primary">Hey</h1><p>Old</p>' },
    });
    expect(() => project(R2, scope, 'R2')).not.toThrow();
  });
});

describe('real conflict recovery', () => {
  const setup = (scope: string) => {
    recordPendingVfsMutation({
      scope, baseRevisionId: 'R1', beforeFiles: R1,
      afterFiles: { ...R1, '/src/pages/Home.tsx': '<h1>Mine</h1><p>Old</p>' },
    });
    const R9 = { ...R1, '/src/pages/Home.tsx': '<h1>Hello</h1><p>Theirs</p>' };
    let thrown: unknown;
    try { project(R9, scope, 'R9'); } catch (err) { thrown = err; }
    return { R9, thrown };
  };

  it('reports the conflict with a recovery target', () => {
    const { thrown } = setup('conflict-detail');
    expect(isPreviewPipelineError(thrown) && thrown.details.pendingConflict).toEqual({ scope: 'conflict-detail', acceptedRevisionId: 'R9' });
  });

  it('keep replays my edit on the latest version', () => {
    const { R9 } = setup('conflict-keep');
    resolvePendingVfsConflicts('conflict-keep', 'R9', 'keep');
    expect(project(R9, 'conflict-keep', 'R9')['/src/pages/Home.tsx']).toBe('<h1>Mine</h1><p>Theirs</p>');
  });

  it('discard drops my edit and shows the latest version', () => {
    const { R9 } = setup('conflict-discard');
    resolvePendingVfsConflicts('conflict-discard', 'R9', 'discard');
    expect(project(R9, 'conflict-discard', 'R9')['/src/pages/Home.tsx']).toBe('<h1>Hello</h1><p>Theirs</p>');
  });
});

describe('typing during an AI save', () => {
  it('replays the typed text on top of the AI change', () => {
    const before = '<h1>Hello</h1><p>Body</p>';
    const typed = '<h1>Hello there</h1><p>Body</p>';
    const ai = '<nav>Floating</nav><h1>Hello</h1><p>Body</p>';
    expect(rebaseTextEdit(before, typed, ai)).toEqual({ status: 'applied', code: '<nav>Floating</nav><h1>Hello there</h1><p>Body</p>' });
  });

  it('reports a conflict when the AI rewrote the same text', () => {
    expect(rebaseTextEdit('<h1>Hello</h1>', '<h1>Hi</h1>', '<h1>Welcome</h1>').status).toBe('conflict');
  });

  it('holds edits until the AI is idle, collapsing repeats per page', () => {
    let fired = 0;
    const off = onAiIdleWithHeldEdits(() => { fired += 1; });
    setAiGenerationActive(true);
    holdEditUntilAiIdle({ path: '/src/pages/Home.tsx', before: 'a', after: 'ab', summary: 'text 1' });
    holdEditUntilAiIdle({ path: '/src/pages/Home.tsx', before: 'ab', after: 'abc', summary: 'text 2' });
    expect(fired).toBe(0);
    expect(getHeldEdits()).toMatchObject([{ before: 'a', after: 'abc' }]);
    setAiGenerationActive(false);
    expect(fired).toBe(1);
    off();
  });
});

describe('AI progress reporting', () => {
  it('never claims a save when the run stopped before saving', () => {
    expect(describeRunOutcome({ active: false, saved: false, preview: 'updated' })).toBe('Stopped before saving · nothing changed');
  });
  it('claims the preview only after it showed the saved change', () => {
    expect(describeRunOutcome({ active: false, saved: true, preview: 'updated' })).toBe('Saved · shown in preview');
    expect(describeRunOutcome({ active: false, saved: true, preview: 'waiting' })).toBe('Saved · preview not confirmed');
  });
});
