/**
 * Optional design references for Affinity (new sites and AI Builder edits).
 *
 * A reference source turns a body of design knowledge into plain guidance for
 * one request. Sources are advice only: the owner's prompt and the project's
 * own source always win, nothing here gates, rewrites or rejects a design, and
 * the owner chooses which sources Affinity may consult.
 *
 * New knowledge expansions register another source with
 * `registerDesignReferenceSource`; nothing else in the pipeline changes.
 */

export type DesignExperience = 'standard' | 'motion-rich' | 'immersive';

export interface DesignReferencePage {
  title: string;
  route: string;
}

export interface DesignReferenceContext {
  /** The owner's words (confirmed brief, or the edit instruction). */
  prompt: string;
  /** Art direction from the creative brief; wins over interpretation of the prompt. */
  artDirectionPackId?: string | null;
  /** How the art direction was decided ('explicit' | 'confirmed' | 'refinement' | 'inferred'). */
  artDirectionOrigin?: string | null;
  experience?: DesignExperience | null;
  pages?: readonly DesignReferencePage[];
  industry?: string | null;
  /** `site` = a whole new site (full reference); `edit` = one scoped change (compact). */
  scope: 'site' | 'edit';
}

export interface DesignReferenceBlock {
  sourceId: string;
  version: string;
  text: string;
  /** What the source resolved (for persistence and display), e.g. `{ artDirection: 'bold-commercial' }`. */
  resolved: Record<string, string>;
}

export interface DesignReferenceSource {
  id: string;
  /** Owner-facing name. */
  name: string;
  /** Owner-facing one-sentence description. */
  description: string;
  version: string;
  /** Default for owners who have not chosen yet. */
  enabledByDefault: boolean;
  compose(context: DesignReferenceContext): DesignReferenceBlock | null;
}

const sources = new Map<string, DesignReferenceSource>();

/** Adds (or replaces, by id) a reference source. */
export function registerDesignReferenceSource(source: DesignReferenceSource): void {
  sources.set(source.id, source);
}

export function listDesignReferenceSources(): DesignReferenceSource[] {
  return [...sources.values()];
}

export function defaultDesignReferenceIds(): string[] {
  return listDesignReferenceSources().filter((source) => source.enabledByDefault).map((source) => source.id);
}

export const DESIGN_REFERENCES_HEADER =
  "DESIGN REFERENCES (optional; the owner chose to let you consult them. The owner's prompt and the project's own source win wherever they differ. Use them as a quality floor and starting vocabulary, never as a fixed recipe or a reason to refuse an idea):";

export interface ComposedDesignReferences {
  /** Empty when no source applies. */
  text: string;
  blocks: DesignReferenceBlock[];
  omitted: Array<{ id: string; reason: 'unknown' | 'empty' | 'budget' }>;
}

/** Composes the chosen sources, in the order given, within a character budget. */
export function composeDesignReferences(
  sourceIds: readonly string[],
  context: DesignReferenceContext,
  maxCharacters = context.scope === 'site' ? 14_000 : 4_000,
): ComposedDesignReferences {
  const blocks: DesignReferenceBlock[] = [];
  const omitted: ComposedDesignReferences['omitted'] = [];
  let length = DESIGN_REFERENCES_HEADER.length;
  for (const id of [...new Set(sourceIds)]) {
    const source = sources.get(id);
    if (!source) { omitted.push({ id, reason: 'unknown' }); continue; }
    const block = source.compose(context);
    if (!block?.text.trim()) { omitted.push({ id, reason: 'empty' }); continue; }
    if (length + block.text.length + 2 > maxCharacters) { omitted.push({ id, reason: 'budget' }); continue; }
    length += block.text.length + 2;
    blocks.push(block);
  }
  return { text: blocks.length ? [DESIGN_REFERENCES_HEADER, ...blocks.map((block) => block.text)].join('\n\n') : '', blocks, omitted };
}

/* ── Per-project choice, saved inside the project so later edits use the same references ── */

export const DESIGN_REFERENCES_PATH = '/.unison/design-references.json';

export interface PersistedDesignReferences {
  version: 1;
  /** Sources the owner allowed; empty means "none". */
  sources: string[];
  artDirectionPackId?: string;
  experience?: DesignExperience;
}

export function serializeDesignReferences(choice: PersistedDesignReferences): string {
  return `${JSON.stringify(choice, null, 2)}\n`;
}

export function readDesignReferences(files: Readonly<Record<string, string>> | null | undefined): PersistedDesignReferences | null {
  const raw = files?.[DESIGN_REFERENCES_PATH];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDesignReferences>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.sources)) return null;
    return {
      version: 1,
      sources: parsed.sources.filter((id): id is string => typeof id === 'string'),
      ...(typeof parsed.artDirectionPackId === 'string' ? { artDirectionPackId: parsed.artDirectionPackId } : {}),
      ...(parsed.experience === 'standard' || parsed.experience === 'motion-rich' || parsed.experience === 'immersive' ? { experience: parsed.experience } : {}),
    };
  } catch {
    return null;
  }
}

/* ── Owner's default choice in this browser ── */

const PREFERENCE_KEY = 'unison.affinity.design-references';

export function loadDesignReferencePreference(storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage): string[] {
  try {
    const raw = storage?.getItem(PREFERENCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === 'string' && sources.has(id));
    }
  } catch {
    // Unreadable preference: fall back to defaults.
  }
  return defaultDesignReferenceIds();
}

export function saveDesignReferencePreference(ids: readonly string[], storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage): void {
  try { storage?.setItem(PREFERENCE_KEY, JSON.stringify([...ids])); } catch { /* storage unavailable */ }
}
