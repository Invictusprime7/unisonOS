import type { SectionVariant } from '@/sections/variants/types';
import { getImplementationVocabularyRefs } from '@/services/designImplementationRegistry';

export type VisualGeometry = 'centered' | 'split' | 'asymmetric' | 'full-bleed' | 'layered' | 'spatial';
export type VisualMediaDominance = 'low' | 'medium' | 'high';
export type VisualTypographyScale = 'restrained' | 'display' | 'monumental';
export type VisualDensity = 'airy' | 'balanced' | 'dense';
export type VisualExperienceLevel = 'standard' | 'motion-rich' | 'immersive';

export interface ImplementationVisualSignature {
  geometry: VisualGeometry;
  mediaDominance: VisualMediaDominance;
  typographyScale: VisualTypographyScale;
  density: VisualDensity;
  motion: string[];
  composition: string;
  experienceLevel: VisualExperienceLevel;
}

const includesAny = (value: string, terms: readonly string[]) => terms.some(term => value.includes(term));

/**
 * Derives AI-readable visual metadata from registry metadata. Authored
 * capability facts (`variant.capabilities`) win; string inference from
 * slug/name/tags is the legacy fallback for entries not yet enriched.
 */
export function deriveImplementationVisualSignature(
  variant: Pick<SectionVariant, 'slug' | 'name' | 'description' | 'tags' | 'experience' | 'vocabulary' | 'vocabularyRefs' | 'capabilities'>,
): ImplementationVisualSignature {
  const refs = getImplementationVocabularyRefs(variant as SectionVariant);
  const authored = variant.capabilities;
  const searchable = [variant.slug, variant.name, variant.description, ...(variant.tags ?? []), ...refs.map(ref => `${ref.category}:${ref.id}`)]
    .join(' ').toLowerCase();
  const motion = refs.filter(ref => ref.category === 'motion').map(ref => ref.id);
  for (const term of ['marquee', 'parallax', 'reveal', 'kinetic', 'stream', 'carousel']) {
    if (searchable.includes(term) && !motion.includes(term)) motion.push(term);
  }
  const geometry: VisualGeometry = authored?.layout?.geometry?.[0]
    ?? (includesAny(searchable, ['spatial', '3d', 'depth', 'perspective']) ? 'spatial'
    : includesAny(searchable, ['full-bleed', 'fullscreen', 'edge-to-edge']) ? 'full-bleed'
    : includesAny(searchable, ['layered', 'overlap', 'collage', 'stacked']) ? 'layered'
    : includesAny(searchable, ['split', 'two-column']) ? 'split'
    : includesAny(searchable, ['asymmetric', 'editorial', 'offset']) ? 'asymmetric' : 'centered');
  const mediaDominance: VisualMediaDominance = authored?.layout?.mediaDominance
    ?? (includesAny(searchable, ['cinematic', 'image', 'media', 'gallery', 'video', 'product', 'portrait', 'spatial']) ? 'high'
    : includesAny(searchable, ['minimal', 'text', 'form', 'faq', 'pricing']) ? 'low' : 'medium');
  const typographyScale: VisualTypographyScale = authored?.layout?.typographyScale
    ?? (includesAny(searchable, ['monumental', 'oversized', 'massive']) ? 'monumental'
    : includesAny(searchable, ['display', 'editorial', 'headline', 'bold']) ? 'display' : 'restrained');
  const density: VisualDensity = authored?.layout?.density
    ?? (includesAny(searchable, ['dense', 'compact', 'grid', 'table']) ? 'dense'
    : includesAny(searchable, ['airy', 'minimal', 'spacious', 'full-bleed']) ? 'airy' : 'balanced');
  const authoredMotionLevel = authored?.motion?.level;
  const experienceLevel: VisualExperienceLevel = authoredMotionLevel === 'immersive' ? 'immersive'
    : authoredMotionLevel === 'motion-rich' ? 'motion-rich'
    : authoredMotionLevel === 'none' || authoredMotionLevel === 'restrained' ? 'standard'
    : variant.experience?.status === 'enabled' ? 'immersive'
    : motion.length > 0 || includesAny(searchable, ['animated', 'motion', 'kinetic', 'cinematic']) ? 'motion-rich' : 'standard';
  return { geometry, mediaDominance, typographyScale, density, motion: [...new Set(motion)].sort(), composition: variant.description, experienceLevel };
}