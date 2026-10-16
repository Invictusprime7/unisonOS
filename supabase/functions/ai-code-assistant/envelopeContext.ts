/**
 * Milestone 2 — Goal-aware generation.
 *
 * The BuilderRequestEnvelope produced by `builder-request-interpreter` is the
 * authoritative interpretation of the user's request. Milestone 1 used it only
 * for routing. This module turns it into an explicit, non-negotiable directive
 * block injected into the final system prompt so generation itself is
 * goal-aware: every goal must be satisfied, every constraint respected, and the
 * declared scope must not be exceeded.
 */

import { filterBusinessCapabilityIds } from "../_shared/businessCapabilityVocabulary.ts";

export interface EnvelopeGoalShape {
  description?: string;
  priority?: string;
  acceptanceCriteria?: string[];
  [k: string]: unknown;
}

export interface EnvelopeShape {
  summary?: string;
  requestKinds?: string[];
  domains?: string[];
  scope?: {
    level?: string;
    targets?: string[];
    relation?: string;
    sourceTarget?: string;
    destinationTarget?: string;
    [k: string]: unknown;
  };
  goals?: EnvelopeGoalShape[];
  constraints?: string[];
  requestedCapabilities?: string[];
  requestedBusinessCapabilities?: string[];
  businessGoals?: string[];
  designTraits?: string[];
  experienceFeatures?: string[];
  editorOperations?: string[];
  ambiguities?: string[];
  complexity?: string;
  executionMode?: string;
  confidence?: number;
  needsExternalResearch?: boolean;
  requiresBackend?: boolean;
  source?: string;
  [k: string]: unknown;
}

const clean = (values: unknown): string[] =>
  Array.isArray(values)
    ? values
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0)
        .slice(0, 20)
    : [];

/**
 * Format the envelope as an authoritative directive block.
 * Returns '' when there is nothing meaningful to inject.
 */
export function buildEnvelopeDirective(envelope?: EnvelopeShape | null): string {
  if (!envelope) return '';

  const summary = typeof envelope.summary === 'string' ? envelope.summary.trim() : '';
  const kinds = clean(envelope.requestKinds);
  const domains = clean(envelope.domains);
  const constraints = clean(envelope.constraints);
  const capabilities = filterBusinessCapabilityIds([
    ...clean(envelope.requestedBusinessCapabilities),
    ...clean(envelope.requestedCapabilities),
  ]);
  const designTraits = clean(envelope.designTraits);
  const experienceFeatures = clean(envelope.experienceFeatures);
  const businessGoals = clean(envelope.businessGoals);
  const ambiguities = clean(envelope.ambiguities);
  const targets = clean(envelope.scope?.targets);
  const editorOperations = clean(envelope.editorOperations);
  const goals = Array.isArray(envelope.goals)
    ? envelope.goals
        .map((g) => ({
          description: typeof g?.description === 'string' ? g.description.trim() : '',
          priority: typeof g?.priority === 'string' ? g.priority.trim() : 'should',
          acceptance: clean(g?.acceptanceCriteria),
        }))
        .filter((g) => g.description.length > 0)
        .slice(0, 20)
    : [];

  if (!summary && !goals.length && !kinds.length && !domains.length) return '';

  const lines: string[] = [
    '',
    '',
    '[🎯 INTERPRETED REQUEST — AUTHORITATIVE]',
    'This block is the structured interpretation of the user request produced by the',
    'request interpreter. It outranks your own reading of the raw prompt. Satisfy EVERY',
    'goal below in a single response — never partially deliver a compound request.',
  ];

  if (summary) lines.push(`Summary: ${summary}`);
  if (kinds.length) lines.push(`Request kinds: ${kinds.join(', ')}`);
  if (domains.length) lines.push(`Domains in play: ${domains.join(', ')}`);
  if (editorOperations.length) {
    lines.push(
      `Editor operations: ${editorOperations.join(', ')}`,
      'Treat these as the interpreted mutation plan, not as backend capabilities. Preserve each operation through the canonical owner and ask for clarification rather than inventing missing targets.',
    );
  }

  const scopeLevel = typeof envelope.scope?.level === 'string' ? envelope.scope.level : undefined;
  if (scopeLevel || targets.length) {
    lines.push(
      `Scope: ${scopeLevel ?? 'unspecified'}${targets.length ? ` → ${targets.join(', ')}` : ''}`,
      'Use this scope as a priority signal. Widen the authored file set when required to deliver a complete compatible implementation.',
    );
  }
  const scopeRelation = typeof envelope.scope?.relation === 'string' ? envelope.scope.relation : undefined;
  if (scopeRelation) lines.push(`Target relationship: ${scopeRelation}`);
  if (envelope.scope?.sourceTarget) lines.push(`Source target: ${envelope.scope.sourceTarget}`);
  if (envelope.scope?.destinationTarget) lines.push(`Destination target: ${envelope.scope.destinationTarget}`);

  if (envelope.complexity || envelope.executionMode) {
    lines.push(
      `Complexity: ${envelope.complexity ?? 'unknown'} | Execution mode: ${envelope.executionMode ?? 'unknown'}`,
    );
  }

  if (goals.length) {
    lines.push('Goals (ALL must be satisfied):');
    for (const goal of goals) {
      lines.push(`  - [${goal.priority}] ${goal.description}`);
      for (const criterion of goal.acceptance) {
        lines.push(`      ✓ ${criterion}`);
      }
    }
  }

  if (constraints.length) {
    lines.push('Constraints (violating any of these invalidates the response):');
    constraints.forEach((c) => lines.push(`  - ${c}`));
  }

  if (designTraits.length) {
    lines.push(
      `Design traits (presentation only — tokens/type/spacing/motion): ${designTraits.join(', ')}`,
      'Express these through Stage 4b tokens and certified implementations. They are NOT backend work.',
    );
  }

  if (experienceFeatures.length) {
    lines.push(
      `Experience features (presentation only): ${experienceFeatures.join(', ')}`,
      'Use certified experience/motion implementations; never add raw 3D or animation packages.',
    );
  }

  if (businessGoals.length) {
    lines.push(`Business goals (outcomes, not capability ids): ${businessGoals.join(', ')}`);
  }

  if (capabilities.length) {
    lines.push(
      `Business capabilities: ${capabilities.join(', ')}`,
      'Wire these through canonical data-ut-intent bindings — never mock or stub the behavior.',
    );
  }

  if (envelope.requiresBackend) {
    lines.push(
      'Backend work is required. Persist through the canonical Supabase contracts and the shared runtime client; do not invent local-only state.',
    );
  }

  if (ambiguities.length) {
    lines.push(
      'Ambiguities — resolve with the most conventional interpretation and state the assumption in your summary:',
    );
    ambiguities.forEach((a) => lines.push(`  - ${a}`));
  }

  lines.push(
    'Before finishing, re-read the goal list and confirm each one is actually implemented in the files you return.',
  );

  return lines.join('\n');
}
