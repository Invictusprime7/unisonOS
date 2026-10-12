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
