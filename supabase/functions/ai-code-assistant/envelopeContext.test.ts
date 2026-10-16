import { buildEnvelopeDirective } from './envelopeContext.ts';

Deno.test('injects page creation and multi-target route operations into the AI prompt', () => {
  const directive = buildEnvelopeDirective({
    summary: 'Create a new page and route footer links to it',
    requestKinds: ['create', 'edit'],
    domains: ['pages', 'navigation'],
    scope: {
      level: 'page',
      targets: ['footer links', 'new page'],
      relation: 'multi_target',
      destinationTarget: 'new page',
    },
    editorOperations: ['page.create', 'navigation.update', 'route.bind'],
    requestedBusinessCapabilities: [],
  });

  if (!directive.includes('Editor operations: page.create, navigation.update, route.bind')) {
    throw new Error('Expected the full editor operation plan in the prompt.');
  }
  if (!directive.includes('Target relationship: multi_target') || !directive.includes('Destination target: new page')) {
    throw new Error('Expected multi-target route context in the prompt.');
  }
  if (directive.includes('Business capabilities:')) {
    throw new Error('Editor operations must not be projected into business capabilities.');
  }
});

Deno.test('injects both ends of a content relocation operation', () => {
  const directive = buildEnvelopeDirective({
    summary: 'Move this text below the Services section',
    requestKinds: ['edit'],
    domains: ['copy', 'content_structure'],
    scope: {
      level: 'element',
      targets: ['selected heading', 'Services section'],
      relation: 'source_destination',
      sourceTarget: 'selected heading',
      destinationTarget: 'below Services section',
    },
    editorOperations: ['copy.move', 'section.reorder'],
    requestedBusinessCapabilities: [],
  });

  if (!directive.includes('Target relationship: source_destination')
    || !directive.includes('Source target: selected heading')
    || !directive.includes('Destination target: below Services section')) {
    throw new Error('Expected source and destination targets in the prompt.');
  }
});
