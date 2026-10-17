/**
 * Preview-First milestone M0 — golden ownership fixture matrix.
 * For each industry fixture, every editable element type must resolve to
 * exactly one canonical owner lane, and executeEditorCommand must record one
 * telemetry event per command with a correlation ID.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const runtimeProtocol = vi.hoisted(() => ({ execute: vi.fn(), nextOperation: 0 }));

vi.mock('@/services/resources/resourceRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/resources/resourceRuntime')>();
  return {
    ...actual,
    applyResourceOp: vi.fn(async () => undefined),
    getResourceRecord: vi.fn(async () => ({ id: 'r1', name: 'Old name' })),
    queryResource: vi.fn(async () => [{ id: 'r1', name: 'Old name' }, { id: 'm1', name: 'Old name' }, { id: 'p1', name: 'Old name' }]),
  };
});

vi.mock('@/services/project-backend/runtimeProtocol', () => ({
  executeResourceCommandCompatible: (context: { projectId?: string | null; siteId?: string | null; businessId: string; mode: string }, command: unknown, legacy: () => Promise<unknown>) => {
    if (!context.projectId || !context.siteId || !context.businessId) return legacy();
    return runtimeProtocol.execute({
      protocolVersion: 2,
      projectId: context.projectId,
      siteId: context.siteId,
      businessId: context.businessId,
      operationId: `toolbar-operation-${++runtimeProtocol.nextOperation}`,
      actorKind: context.mode === 'builder' ? 'studio-user' : 'visitor',
    }, command);
  },
}));

import { applyResourceOp } from '@/services/resources/resourceRuntime';
import { registerContentTypes } from '@/services/resources/resourceRegistry';
import { executeEditorCommand, type LaneExecutor } from '@/services/editor/editorCommandService';
import { resolvePropertyOwner } from '@/services/editor/propertyOwnerResolver';
import { getEditorCommandEvents, resetEditorCommandEvents } from '@/services/editor/editorTelemetry';
import type { EditorCommand, EditorOwnerLane } from '@/services/editor/editorCommandTypes';
import { useToolbarCommands } from '@/components/creatives/web-builder/toolbarCommandAdapter';

const ctx = { source: 'inspector' as const, resource: { businessId: 'b1', projectId: 'p1', mode: 'builder' as const } };

interface FixtureCase {
  fixture: string;
  element: string;
  command: EditorCommand;
  expectedLane: EditorOwnerLane;
}

const mark = (resourceKey: string, recordId: string, field: string) => `${resourceKey}#${recordId}.${field}`;
const ref = (resourceKey: string, recordId: string, field: string) => ({
  resourceKey,
  kind: 'catalog' as const,
  recordId,
  field,
});

const assetRef = (projectId: string) => ({
  url: 'https://cdn.example.com/x.png',
  alt: '',
  assetId: 'a1',
  projectId,
  siteId: null,
  bucket: 'site-assets' as const,
  path: 'public/images/x.png',
});

const MATRIX: FixtureCase[] = [
  // Salon / service booking
  { fixture: 'salon', element: 'service name', command: { type: 'set-text', target: { resourceMark: mark('services', 's1', 'name') }, text: 'Cut & Blowdry' }, expectedLane: 'resource' },
  { fixture: 'salon', element: 'service price', command: { type: 'update-resource-field', target: { resourceMark: mark('services', 's1', 'price') }, ref: ref('services', 's1', 'price'), values: { price: 4500 } }, expectedLane: 'resource' },
  { fixture: 'salon', element: 'hero headline (static)', command: { type: 'set-text', target: { selector: '.hero h1' }, text: 'Hi' }, expectedLane: 'source' },
  // E-commerce
  { fixture: 'ecommerce', element: 'product name', command: { type: 'set-text', target: { resourceMark: mark('products', 'p1', 'name') }, text: 'Tee' }, expectedLane: 'resource' },
  { fixture: 'ecommerce', element: 'product image', command: { type: 'replace-asset', target: { resourceMark: mark('products', 'p1', 'image') }, url: 'https://cdn.example.com/x.png', assetRef: assetRef('p1') }, expectedLane: 'resource' },
  // Restaurant
  { fixture: 'restaurant', element: 'menu item price', command: { type: 'update-resource-field', target: { resourceMark: mark('menu_items', 'm1', 'price') }, ref: ref('menu_items', 'm1', 'price'), values: { price: 1200 } }, expectedLane: 'resource' },
  // Portfolio / case study
  { fixture: 'portfolio', element: 'project title', command: { type: 'set-text', target: { resourceMark: mark('projects', 'pr1', 'title') }, text: 'New title' }, expectedLane: 'resource' },
  { fixture: 'portfolio', element: 'article body', command: { type: 'set-text', target: { resourceMark: mark('content:articles', 'c1', 'body') }, text: 'Body' }, expectedLane: 'resource' },
  // Contractor
  { fixture: 'contractor', element: 'button link', command: { type: 'set-link', target: { selector: 'a.cta' }, href: '/contact' }, expectedLane: 'route' },
  // Static landing
  { fixture: 'landing', element: 'section spacing', command: { type: 'set-style', target: { selector: '.section' }, styles: { padding: '2rem' } }, expectedLane: 'presentation' },
  { fixture: 'landing', element: 'hide section', command: { type: 'set-visibility', target: { selector: '.section' }, visible: false }, expectedLane: 'presentation' },
  { fixture: 'landing', element: 'bind button intent', command: { type: 'bind-intent', target: { selector: 'button' }, intent: 'contact.submit' }, expectedLane: 'binding' },
];

describe('M0 ownership fixture matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEditorCommandEvents();
    runtimeProtocol.nextOperation = 0;
    registerContentTypes([{ id: 't-articles', slug: 'articles', name: 'Articles', field_schema: [{ key: 'title' }, { key: 'body', type: 'textarea' }] }]);
  });

  it('every editable element type resolves to exactly one canonical owner', () => {
    for (const c of MATRIX) {
      expect(resolvePropertyOwner(c.command), `${c.fixture} / ${c.element}`).toBe(c.expectedLane);
    }
  });

  it('a resource mark always wins over source for text edits', () => {
    expect(resolvePropertyOwner({ type: 'set-text', target: { resourceMark: mark('products', 'p1', 'name'), selector: '.card h3' }, text: 'x' })).toBe('resource');
  });

  it('keeps explicitly unbound selections read-only instead of guessing a source writer', async () => {
    const source = vi.fn(async (command: EditorCommand) => ({
      ok: true,
      command: command.type,
      lane: 'source' as const,
      savedTo: 'source',
      changedFields: ['text'],
    }));
    const result = await executeEditorCommand({
      type: 'set-text',
      target: { ownerKind: 'unbound', selector: '.unknown h1' },
      text: 'New copy',
    }, { ...ctx, executors: { source } });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('read-only');
    expect(source).not.toHaveBeenCalled();
  });

  it('preserves canonical slot metadata through the floating toolbar command adapter', async () => {
    const target = { selector: '[data-ut-slot="hero\\.headline"]', pagePath: '/src/pages/Home.tsx', slotId: 'hero.headline', sectionType: 'hero' };
    const onUpdateText = vi.fn(() => true);
    const { result } = renderHook(() => useToolbarCommands({
      onUpdateText,
      onUpdateStyles: vi.fn(),
      onUpdateAttributes: vi.fn(),
      onReplaceImage: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
    }, { businessId: 'b1', projectId: 'p1' }));
    let succeeded = false;

    await act(async () => {
      succeeded = (await result.current({ type: 'set-text', target, text: 'New headline' })).ok;
    });

    expect(succeeded).toBe(true);
    expect(onUpdateText).toHaveBeenCalledExactlyOnceWith(target.selector, 'New headline', target);
  });

  it('dispatches each matrix command to exactly one matching writer', async () => {
    const lanes = ['source', 'presentation', 'route', 'binding'] as const;
    const executors = Object.fromEntries(lanes.map((lane) => [lane, vi.fn<LaneExecutor>(async (command) => ({
      ok: true,
      command: command.type,
      lane,
      savedTo: `${lane} fixture writer`,
      changedFields: [command.type],
    }))])) as Record<(typeof lanes)[number], ReturnType<typeof vi.fn<LaneExecutor>>>;

    for (const c of MATRIX) {
      vi.clearAllMocks();
      const result = await executeEditorCommand(c.command, { ...ctx, executors });
      expect(result.ok, `${c.fixture} / ${c.element}`).toBe(true);
      expect(result.lane, `${c.fixture} / ${c.element}`).toBe(c.expectedLane);
      for (const lane of lanes) {
        expect(executors[lane], `${c.fixture} / ${c.element} / ${lane}`).toHaveBeenCalledTimes(
          lane === c.expectedLane ? 1 : 0,
        );
      }
      expect(vi.mocked(applyResourceOp), `${c.fixture} / ${c.element} / resource`).toHaveBeenCalledTimes(
        c.expectedLane === 'resource' ? 1 : 0,
      );
    }
  });

  it('resource commands execute through the resource lane and record telemetry', async () => {
    const c = MATRIX[0];
    const result = await executeEditorCommand(c.command, ctx);
    expect(result.ok).toBe(true);
    expect(result.lane).toBe('resource');
    expect(result.savedTo).toContain('Services');
    const events = getEditorCommandEvents();
    expect(events).toHaveLength(1);
    expect(events[0].correlationId).toMatch(/^ec_/);
    expect(events[0].lane).toBe('resource');
    expect(events[0].target.resourceMark).toBe(mark('services', 's1', 'name'));
    expect(events[0].ok).toBe(true);
  });

  it('uses V2 for fully scoped editor resource reads and writes', async () => {
    runtimeProtocol.execute.mockImplementation(async (context, command) => ({
      ok: true,
      operationId: context.operationId,
      data: command.kind === 'resource.get'
        ? { id: 's1', name: 'Old name' }
        : { id: 's1', name: 'Cut & Blowdry' },
    }));

    const result = await executeEditorCommand(MATRIX[0].command, {
      ...ctx,
      resource: { ...ctx.resource, siteId: 'site-1' },
    });

    expect(result).toMatchObject({ ok: true, lane: 'resource' });
    expect(runtimeProtocol.execute).toHaveBeenCalledTimes(2);
    const [readContext, readCommand] = runtimeProtocol.execute.mock.calls[0];
    const [writeContext, writeCommand] = runtimeProtocol.execute.mock.calls[1];
    expect(readContext).toMatchObject({
      protocolVersion: 2, projectId: 'p1', siteId: 'site-1', businessId: 'b1', actorKind: 'studio-user',
    });
    expect(readCommand).toEqual({ kind: 'resource.get', resourceKey: 'services', recordId: 's1' });
    expect(writeCommand).toEqual({
      kind: 'resource.mutate', resourceKey: 'services', action: 'update', recordId: 's1', values: { name: 'Cut & Blowdry' },
    });
    expect(readContext.operationId).not.toBe(writeContext.operationId);
    expect(applyResourceOp).not.toHaveBeenCalled();
  });

  it('lanes without a host executor fail explicitly and are still recorded', async () => {
    const c = MATRIX.find((m) => m.expectedLane === 'source')!;
    const result = await executeEditorCommand(c.command, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('can’t be saved from here');
    const events = getEditorCommandEvents();
    expect(events).toHaveLength(1);
    expect(events[0].ok).toBe(false);
    expect(events[0].lane).toBe('source');
  });

  it('an image owned by another site is rejected before any write', async () => {
    const result = await executeEditorCommand(
      { type: 'replace-asset', target: { resourceMark: mark('products', 'p1', 'image') }, url: 'https://cdn.example.com/x.png', assetRef: assetRef('other-site') },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain('another site');
  });
});
