/**
 * Canonical Design Implementation Registry (Phase 3 — registry consolidation)
 *
 * One index over every renderable design implementation in the platform.
 * Section families come from the Section Registry, visual variants come from
 * the Variant Registry, . Nothing here declares its own list — this module is a derived
 * view, so it can never drift from the registries the compiler renders with.
 *
 * Every downstream authority (design contract, Lane B prompt vocabulary,
 * drift detection, swap UI) must resolve implementation identity through
 * `resolveImplementationId` instead of assembling id strings by hand.
 */

import { getAllSections } from '@/sections/registry';
import { VARIANT_REGISTRY } from '@/sections/variants';
import type { VariantId } from '@/sections/variants';
import type { SectionVariant, VocabularyRef } from '@/sections/variants/types';
import type { SectionType, SectionRegistryEntry } from '@/sections/types';
import { DESIGN_VOCABULARY } from '@/platform/core/designVocabulary';
import { hashSeed } from '@/platform/core/generationSeed';

/** Identity used everywhere a design implementation is referenced. */
export type ImplementationId = `${string}:${string}`;

/** The generic implementation slug used when a family has no variants. */
export const GENERIC_IMPLEMENTATION_SLUG = 'generic';

export interface DesignImplementation {
  /** Stable identity: `${sectionType}:${variantSlug}` (or `:generic`). */
  implementationId: ImplementationId;
  sectionType: SectionType;
  /** Registered variant id, when this implementation is a real variant. */
  variantId?: VariantId;
  /** Variant slug, or `generic` for the family default renderer. */
  slug: string;
  name: string;
  description: string;
  category: SectionRegistryEntry['category'];
  tags: string[];
  isDefault: boolean;
  thumbnail?: string;
  /** True when the family exposes variant-level implementations. */
  hasVariants: boolean;
  vfs?: SectionVariant['vfs'];
  source?: SectionVariant['source'];
  generationStatus?: SectionVariant['generationStatus'];
  radixPrimitives?: SectionVariant['radixPrimitives'];
  vocabulary?: SectionVariant['vocabulary'];
  /** Deduplicated union of the legacy shorthand and additional references. */
  vocabularyRefs?: readonly VocabularyRef[];
  pageRoles?: SectionVariant['pageRoles'];
  experience?: SectionVariant['experience'];
  capabilities?: SectionVariant['capabilities'];
  compatibility?: SectionVariant['compatibility'];
  lifecycle?: SectionVariant['lifecycle'];
  ai?: SectionVariant['ai'];
}

let cachedIndex: Map<string, DesignImplementation> | null = null;
let cachedVocabularyIndex: Map<string, DesignImplementation[]> | null = null;

/** Vocabulary ids are unique per category only, so both parts are the key. */
export function vocabularyKey(ref: VocabularyRef): string {
  return `${ref.category}:${ref.id}`;
}

export function getImplementationVocabularyRefs(
  declaration: Pick<SectionVariant, 'vocabulary' | 'vocabularyRefs'>,
): VocabularyRef[] {
  const refs = [
    ...(declaration.vocabulary ? [declaration.vocabulary] : []),
    ...(declaration.vocabularyRefs ?? []),
  ];
  return [...new Map(refs.map((ref) => [vocabularyKey(ref), { ...ref }])).values()];
}

function buildIndex(): Map<string, DesignImplementation> {
  const index = new Map<string, DesignImplementation>();
  const sections = getAllSections();

  for (const [type, entry] of Object.entries(sections) as Array<[SectionType, SectionRegistryEntry]>) {
    const variants = VARIANT_REGISTRY[type] ?? [];

    if (variants.length === 0) {
      const implementationId = `${type}:${GENERIC_IMPLEMENTATION_SLUG}` as ImplementationId;
      index.set(implementationId, {
        implementationId,
        sectionType: type,
        slug: GENERIC_IMPLEMENTATION_SLUG,
        name: entry.label,
        description: entry.description ?? '',
        category: entry.category,
        tags: [],
        isDefault: true,
        hasVariants: false,
      });
      continue;
    }

    for (const variant of variants) {
      const implementationId = variant.id as ImplementationId;
      index.set(implementationId, {
        implementationId,
        sectionType: type,
        variantId: variant.id,
        slug: variant.slug,
        name: variant.name,
        description: variant.description,
        category: entry.category,
        tags: variant.tags ?? [],
        isDefault: Boolean(variant.isDefault),
        thumbnail: variant.thumbnail,
        hasVariants: true,
        source: variant.source ? { ...variant.source } : undefined,
        generationStatus: variant.generationStatus,
        vfs: variant.vfs ? { ...variant.vfs } : undefined,
        radixPrimitives: variant.radixPrimitives ? [...variant.radixPrimitives] : undefined,
        vocabulary: variant.vocabulary ? { ...variant.vocabulary } : undefined,
        vocabularyRefs: getImplementationVocabularyRefs(variant),
        pageRoles: variant.pageRoles ? [...variant.pageRoles] : undefined,
        experience: variant.experience
          ? { ...variant.experience, vocabulary: { ...variant.experience.vocabulary } }
          : undefined,
        capabilities: variant.capabilities,
        compatibility: variant.compatibility,
        lifecycle: variant.lifecycle ? { ...variant.lifecycle } : undefined,
        ai: variant.ai ? { ...variant.ai } : undefined,
      });
    }
  }

  return index;
}

function index(): Map<string, DesignImplementation> {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

/** Test-only: drop the memoized view (registries are static at runtime). */
export function resetDesignImplementationIndex(): void {
  cachedIndex = null;
  cachedVocabularyIndex = null;
}

export function listDesignImplementations(): DesignImplementation[] {
  return [...index().values()].sort((a, b) =>
    a.implementationId.localeCompare(b.implementationId));
}

export function getDesignImplementation(id: string): DesignImplementation | undefined {
  return index().get(id);
}

export function isRegisteredImplementation(id: string): boolean {
  return index().has(id);
}

export function listImplementationsForSection(type: SectionType): DesignImplementation[] {
  return listDesignImplementations().filter((impl) => impl.sectionType === type);
}

function vocabularyIndex(): Map<string, DesignImplementation[]> {
  if (cachedVocabularyIndex) return cachedVocabularyIndex;
  const built = new Map<string, DesignImplementation[]>();
  for (const implementation of listDesignImplementations()) {
    for (const ref of getImplementationVocabularyRefs(implementation)) {
      const key = vocabularyKey(ref);
      const bucket = built.get(key);
      if (bucket) bucket.push(implementation);
      else built.set(key, [implementation]);
    }
  }
  cachedVocabularyIndex = built;
  return built;
}

/** Registered implementations that already execute a vocabulary entry. */
export function listImplementationsForVocabulary(ref: VocabularyRef): DesignImplementation[] {
  return vocabularyIndex().get(vocabularyKey(ref)) ?? [];
}

/** True when the compiler can actually build this vocabulary entry today. */
export function isExecutableVocabulary(ref: VocabularyRef): boolean {
  return vocabularyIndex().has(vocabularyKey(ref));
}

export interface VocabularyExecutability {
  /** Entries backed by at least one registered implementation. */
  executable: string[];
  /** Entries the vocabulary offers that nothing can render yet. */
  unimplemented: string[];
}

/**
 * The measured version of "design vocabulary is richer than the set of
 * compiler-executable recipes". Phase 5 closes this gap by moving entries from
 * `unimplemented` to `executable`, never by widening the vocabulary.
 */
export function vocabularyExecutabilityReport(): VocabularyExecutability {
  const executable: string[] = [];
  const unimplemented: string[] = [];
  for (const entry of DESIGN_VOCABULARY) {
    const key = vocabularyKey({ category: entry.category, id: entry.id });
    (vocabularyIndex().has(key) ? executable : unimplemented).push(key);
  }
  return { executable, unimplemented };
}

/** Global implementation does not imply eligibility or selection for a launch. */
export function buildDesignVocabularyReport(options: {
  eligibleImplementationIds: readonly string[];
  selectedImplementationIds: readonly string[];
}) {
  const report = vocabularyExecutabilityReport();
  const implemented = new Set(report.executable);
  const project = (ids: readonly string[]) => [...new Set(ids.flatMap((id) => {
    const implementation = getDesignImplementation(id);
    return implementation ? getImplementationVocabularyRefs(implementation).map(vocabularyKey) : [];
  }))].filter((key) => implemented.has(key)).sort();
  return {
    globalExecutableIds: [...report.executable].sort(),
    executableIds: project(options.eligibleImplementationIds),
    selectedIds: project(options.selectedImplementationIds),
    unimplementedIds: [...report.unimplemented].sort(),
  };
}

/** Versioned capability metadata hash; does not reinterpret persisted dr_* IDs. */
export function designCapabilityFingerprint(options: {
  eligibleImplementationIds: readonly string[];
  industry: string;
  templateId: string;
  themePresetId: string;
  artDirectionPackId?: string;
}): string {
  const sorted = (values: readonly string[]) => [...new Set(values)].sort();
  const implementations = listDesignImplementations().map((implementation) => ({
    id: implementation.implementationId,
    vocabulary: sorted(getImplementationVocabularyRefs(implementation).map(vocabularyKey)),
    vfsMode: implementation.vfs?.mode ?? null,
    certification: implementation.vfs?.certification ?? null,
    generationStatus: implementation.generationStatus ?? null,
    source: implementation.source ? { origin: implementation.source.origin, sourceId: implementation.source.sourceId, derivation: implementation.source.derivation } : null,
    radix: sorted(implementation.radixPrimitives ?? []),
    pageRoles: sorted(implementation.pageRoles ?? []),
    tags: sorted(implementation.tags),
    experience: implementation.experience ? {
      status: implementation.experience.status,
      vocabulary: vocabularyKey(implementation.experience.vocabulary),
    } : null,
  }));
  return `dc_v1_${hashSeed(JSON.stringify({
    implementations,
    eligible: sorted(options.eligibleImplementationIds),
    industry: options.industry,
    templateId: options.templateId,
    themePresetId: options.themePresetId,
    artDirectionPackId: options.artDirectionPackId ?? null,
  }))}`;
}

/**
 * The single sanctioned way to derive an implementation identity.
 * Falls back to the family's generic identity so unregistered variants stay
 * addressable (and visible to drift detection) rather than silently dropped.
 */
export function resolveImplementationId(
  sectionType: string,
  variantId?: string | null,
): ImplementationId {
  if (variantId && index().has(variantId)) return variantId as ImplementationId;
  const generic = `${sectionType}:${GENERIC_IMPLEMENTATION_SLUG}` as ImplementationId;
  if (index().has(generic)) return generic;
  const family = listImplementationsForSection(sectionType as SectionType);
  const fallback = family.find((impl) => impl.isDefault) ?? family[0];
  return fallback?.implementationId ?? generic;
}

/**
 * Deterministic fingerprint of the whole design inventory. Snapshot metadata
 * stamps this so a rebuild can prove it rendered the same implementation set.
 */
export function designRegistrySignature(): string {
  const payload = listDesignImplementations()
    .map((impl) => `${impl.implementationId}|${impl.category}|${impl.isDefault ? 'default' : '-'}`)
    .join('\n');
  return `dr_${hashSeed(payload)}`;
}
