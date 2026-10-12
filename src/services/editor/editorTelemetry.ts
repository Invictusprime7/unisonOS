/**
 * Editor telemetry (Preview-First milestone M0). Every editor command gets a
 * correlation ID and one recorded event: which owner lane it routed to, where
 * it saved, and whether it succeeded. This is observability only — it holds
 * no editing state and never influences routing.
 */
import type { EditorCommandResult, EditorCommandSource, EditorCommandType, EditorOwnerLane } from './editorCommandTypes';

export interface EditorCommandEvent {
  correlationId: string;
  at: number;
  source: EditorCommandSource;
  command: EditorCommandType;
  lane: EditorOwnerLane;
  target: {
    elementId?: string | null;
    selector?: string | null;
    pagePath?: string | null;
    sectionId?: string | null;
    resourceMark?: string | null;
  };
  ok: boolean;
  savedTo: string | null;
  changedFields: string[];
  error?: string;
  durationMs: number;
}

type Listener = (event: EditorCommandEvent) => void;

const MAX_EVENTS = 200;
const events: EditorCommandEvent[] = [];
const listeners = new Set<Listener>();
let counter = 0;

export function newEditorCorrelationId(): string {
  counter += 1;
  return `ec_${Date.now().toString(36)}_${counter}`;
}

export function recordEditorCommandEvent(event: EditorCommandEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  for (const fn of listeners) fn(event);
}

export function getEditorCommandEvents(): readonly EditorCommandEvent[] {
  return events;
}

export function onEditorCommandEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Test helper: clears the ring buffer. */
export function resetEditorCommandEvents(): void {
  events.length = 0;
}

// ── Mutation telemetry (M0 remainder) ────────────────────────────────────────
// One event per canonical mutation: which surface ran it, the base revision it
// started from, the revision it produced, and whether it succeeded. Pure
// observability — never influences save behavior.

export interface MutationEvent {
  correlationId: string;
  at: number;
  kind: 'commit' | 'resource-op' | 'surface-run';
  surface: string;
  baseRevisionId: string | null;
  resultRevisionId: string | null;
  /** resource-op only: resource key, op and record id. */
  resourceKey?: string;
  resourceOp?: string;
  recordId?: string | null;
  ok: boolean;
  error?: string;
  durationMs: number;
}

const MAX_MUTATION_EVENTS = 200;
const mutationEvents: MutationEvent[] = [];
const mutationListeners = new Set<(event: MutationEvent) => void>();

export function recordMutationEvent(event: MutationEvent): void {
  mutationEvents.push(event);
  if (mutationEvents.length > MAX_MUTATION_EVENTS) mutationEvents.splice(0, mutationEvents.length - MAX_MUTATION_EVENTS);
  for (const fn of mutationListeners) fn(event);
}

export function getMutationEvents(): readonly MutationEvent[] {
  return mutationEvents;
}

export function onMutationEvent(fn: (event: MutationEvent) => void): () => void {
  mutationListeners.add(fn);
  return () => mutationListeners.delete(fn);
}

/** Test helper: clears the mutation ring buffer. */
export function resetMutationEvents(): void {
  mutationEvents.length = 0;
}

export function toEditorCommandEvent(
  correlationId: string,
  source: EditorCommandSource,
  command: EditorCommandType,
  lane: EditorOwnerLane,
  target: EditorCommandEvent['target'],
  result: EditorCommandResult,
  durationMs: number,
): EditorCommandEvent {
  return {
    correlationId,
    at: Date.now(),
    source,
    command,
    lane,
    target,
    ok: result.ok,
    savedTo: result.savedTo,
    changedFields: result.changedFields,
    error: result.error,
    durationMs,
  };
}
