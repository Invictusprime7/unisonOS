/**
 * Preview-First milestone M0 — golden ownership fixture matrix.
 * For each industry fixture, every editable element type must resolve to
 * exactly one canonical owner lane, and executeEditorCommand must record one
 * telemetry event per command with a correlation ID.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/resources/resourceRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/resources/resourceRuntime')>();
  return {
    ...actual,
    applyResourceOp: vi.fn(async () => undefined),
    getResourceRecord: vi.fn(async () => ({ id: 'r1', name: 'Old name' })),
  };
});

import { registerContentTypes } from '@/services/resources/resourceRegistry';
import { executeEditorCommand } from '@/services/editor/editorCommandService';
import { resolvePropertyOwner } from '@/services/editor/propertyOwnerResolver';
import { getEditorCommandEvents, resetEditorCommandEvents } from '@/services/editor/editorTelemetry';
import type { EditorCommand, EditorOwnerLane } from '@/services/editor/editorCommandTypes';

const ctx = { source: 'inspector' as const, resource: { businessId: 'b1', projectId: 'p1', mode: 'builder' as const } };

interface FixtureCase {
  fixture: string;
  element: string;
  command: EditorCommand;
  expectedLane: EditorOwnerLane;
}

const mark = (resourceKey: string, recordId: string, field: string) => `${resourceKey}#${recordId}.${field}`;

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
  { fixture: 'salon', element: 'service price', command: { type: 'update-resource-field', target: {}, values: { price: 4500 } }, expectedLane: 'resource' },
  { fixture: 'salon', element: 'hero headline (static)', command: { type: 'set-text', target: { selector: '.hero h1' }, text: 'Hi' }, expectedLane: 'source' },
  // E-commerce
  { fixture: 'ecommerce', element: 'product name', command: { type: 'set-text', target: { resourceMark: mark('products', 'p1', 'name') }, text: 'Tee' }, expectedLane: 'resource' },
  { fixture: 'ecommerce', element: 'product image', command: { type: 'replace-asset', target: { resourceMark: mark('products', 'p1', 'image') }, url: 'https://cdn.example.com/x.png', assetRef: assetRef('p1') }, expectedLane: 'resource' },
  // Restaurant
  { fixture: 'restaurant', element: 'menu item price', command: { type: 'update-resource-field', target: {}, values: { price: 1200 } }, expectedLane: 'resource' },
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
    resetEditorCommandEvents();
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
