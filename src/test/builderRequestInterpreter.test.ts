import { describe, expect, it, vi } from 'vitest';

const interpreterMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: interpreterMocks.invoke } },
}));
import {
  buildEnvelopeHints,
  heuristicEnvelope,
  normalizeEnvelope,
  requiresRenderableUiPatch,
} from '@/types/builderRequestEnvelope';
import { interpretBuilderRequest } from '@/services/builderRequestInterpreter';

describe('Builder request UI patch routing', () => {
  it('keeps cart wiring in the source path even when interpreted as backend-only', () => {
    const prompt = 'wire add to cart so items update live in bag, and at checkout';
    const envelope = heuristicEnvelope('Configure the commerce backend', { hasExistingTemplate: true });
    envelope.requestKinds = ['backend_configuration'];
    envelope.scope.level = 'backend';
    expect(requiresRenderableUiPatch(envelope, prompt)).toBe(true);
  });

  it('classifies moving selected copy as a source-to-destination operation', () => {
    const envelope = heuristicEnvelope('move this text to the section below', {
      hasExistingTemplate: true,
      hasSelectedElement: true,
    });

    expect(envelope.editorOperations).toContain('copy.move');
    expect(envelope.scope.relation).toBe('source_destination');
    expect(envelope.scope.level).toBe('section');
    expect(envelope.domains).toEqual(expect.arrayContaining(['copy', 'content_structure']));
  });

  it('classifies footer links to a new page as page creation plus multi-target routing', () => {
    const envelope = heuristicEnvelope('Make these footer links route to a new page', {
      hasExistingTemplate: true,
      hasSelectedElement: true,
    });

    expect(envelope.editorOperations).toEqual(expect.arrayContaining(['page.create', 'navigation.update', 'route.bind']));
    expect(envelope.scope.relation).toBe('multi_target');
    expect(envelope.scope.level).toBe('page');
    expect(envelope.domains).toEqual(expect.arrayContaining(['navigation', 'pages']));
  });

  it('preserves explicit element scope when the requested operation spans pages', () => {
    const hints = buildEnvelopeHints('Make these footer links route to a new page', {
      hasExistingTemplate: true,
      hasSelectedElement: true,
      selectedScope: 'element',
      selectedScopeExplicit: true,
    });

    expect(hints.scope).toMatchObject({ level: 'element', relation: 'multi_target' });
  });

  it('widens auto scope only to the minimum page scope required by page routing', () => {
    const hints = buildEnvelopeHints('Make these footer links route to a new page', {
      hasExistingTemplate: true,
      hasSelectedElement: true,
      selectedScope: 'element',
      selectedScopeExplicit: false,
    });

    expect(hints.scope).toMatchObject({ level: 'page', relation: 'multi_target' });
  });

  it('normalizes operation scope without treating unknown operations as capabilities', () => {
    const envelope = normalizeEnvelope({
      requestKinds: ['edit'],
      domains: ['copy', 'navigation'],
      scope: {
        level: 'site',
        targets: ['/services'],
        relation: 'source_destination',
        sourceTarget: 'hero heading',
        destinationTarget: 'services section',
      },
      editorOperations: ['copy.move', 'custom.mutate'],
      requestedBusinessCapabilities: [],
    });

    expect(envelope.editorOperations).toEqual(['copy.move']);
    expect(envelope.scope).toMatchObject({
      level: 'site', relation: 'source_destination',
      sourceTarget: 'hero heading', destinationTarget: 'services section',
    });
    expect(envelope.ambiguities).toContain('Unclassified editor operation: custom.mutate');
    expect(envelope.requestedBusinessCapabilities).toEqual([]);
  });

  it('sends the canonical page manifest and selected target to the interpreter', async () => {
    interpreterMocks.invoke.mockResolvedValue({
      data: { envelope: { summary: 'Move copy', requestKinds: ['edit'], domains: ['copy'], confidence: 0.9 } },
      error: null,
    });

    await interpretBuilderRequest('move this text to the section below', {
      currentPageId: 'page-home',
      currentPagePath: '/',
      pageTargets: [{ pageId: 'page-home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx', isHome: true }],
      selectedElement: {
        selector: '[data-ut-slot="hero.headline"]',
        text: 'Original heading',
        tagName: 'h1',
        pageId: 'page-home',
        pagePath: '/',
        sectionId: 'hero',
        sectionType: 'hero',
        sourceLocator: '/src/pages/Home.tsx:12:4',
      },
      selectedEditScope: { scopeType: 'page', targetId: 'page-home', selection: 'explicit' },
      hasExistingTemplate: true,
    });

    expect(interpreterMocks.invoke).toHaveBeenCalledWith('builder-request-interpreter', expect.objectContaining({
      body: expect.objectContaining({
        context: expect.objectContaining({
        currentPageId: 'page-home',
        currentPagePath: '/',
        pageTargets: [{ pageId: 'page-home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx', isHome: true }],
        selectedElement: expect.objectContaining({
          sectionId: 'hero', sectionType: 'hero', pagePath: '/', sourceLocator: '/src/pages/Home.tsx:12:4',
        }),
        selectedEditScope: { scopeType: 'page', targetId: 'page-home', selection: 'explicit' },
        }),
      }),
    }));
  });

  it('keeps an explicit checkout page request in the renderable UI path', () => {
    const prompt = 'Create the checkout page for confirmed bookings';
    const envelope = heuristicEnvelope(prompt, { hasExistingTemplate: true });

    expect(envelope.scope.level).toBe('page');
    expect(requiresRenderableUiPatch(envelope, prompt)).toBe(true);
  });

  it('does not treat a backend-only configuration request as a UI patch', () => {
    const prompt = 'Configure the booking backend and availability tables';
    const envelope = heuristicEnvelope(prompt, { hasExistingTemplate: true });

    expect(requiresRenderableUiPatch(envelope, prompt)).toBe(false);
  });
});
