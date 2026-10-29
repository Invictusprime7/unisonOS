import {
  buildUnisonContextDirective,
  resolveBuilderInstruction,
  resolveReasoningEffort,
  resolveUnisonComplexity,
} from './unisonContext.ts';
import { buildPlannedChatCompletionRequest } from '../_shared/aiProviderLoop.ts';
import { preprocessPrompt } from '../_shared/promptPreprocessor.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test('project context does not inflate the user instruction complexity', () => {
  const instruction = 'build navigation redirect pages';
  const enriched = instruction + '\n' + 'Implement API integration, routing, authentication and database migrations. '.repeat(100);
  const selected = resolveBuilderInstruction(enriched, instruction);
  assertEquals(preprocessPrompt(selected).complexity.tier, preprocessPrompt(instruction).complexity.tier);
  assertEquals(selected.includes('database migrations'), false);
  assertEquals(resolveBuilderInstruction(enriched, ''), enriched);
});

const context = {
  route: 'builder.edit',
  primaryIntent: 'Improve checkout',
  secondaryIntents: ['intent.bind'],
  targetScope: 'page',
  requestedOutcome: 'Validated checkout interaction',
  constraints: ['Preserve theme'],
  entities: { pageTitle: 'Checkout' },
  targetFiles: ['/src/pages/Checkout.tsx'],
  targetPageIds: ['checkout'],
  targetSections: ['payment'],
  confidence: 0.94,
  estimatedComplexity: 13,
  requiresClarification: false,
  requiresUserConfirmation: false,
  steps: [{
    type: 'patch',
    description: 'Patch checkout form',
    targets: ['/src/pages/Checkout.tsx'],
    dependsOn: [],
    complexity: 4,
  }],
};

Deno.test('Unison complexity can escalate server model routing', () => {
  assertEquals(resolveUnisonComplexity('simple', context), 'advanced');
  assertEquals(resolveUnisonComplexity('advanced', { ...context, estimatedComplexity: 1 }), 'advanced');
});

Deno.test('reasoning effort defaults by complexity and preserves explicit choices', () => {
  assertEquals(resolveReasoningEffort(undefined, 'advanced'), 'high');
  assertEquals(resolveReasoningEffort(undefined, 'complex'), 'medium');
  assertEquals(resolveReasoningEffort('none', 'advanced'), 'none');
});

Deno.test('Unison directive contains targets, constraints, and ordered work', () => {
  const directive = buildUnisonContextDirective(context);
  assertEquals(directive.includes('Primary intent: Improve checkout'), true);
  assertEquals(directive.includes('Preserve theme'), true);
  assertEquals(directive.includes('/src/pages/Checkout.tsx'), true);
  assertEquals(directive.includes('1. patch: Patch checkout form'), true);
});

Deno.test('provider requests use documented reasoning effort parameters', () => {
  for (const id of ['google/gemini-3-flash-preview']) {
    const request = buildPlannedChatCompletionRequest({
      model: { id, label: id, maxTokens: 40_000 },
      aiMessages: [{ role: 'user', content: 'Fix the checkout flow' }],
      reasoningEffort: 'high',
    });

    assertEquals(request.reasoning_effort, 'high');
    assertEquals('reasoning' in request, false);
  }
});
