import type { TemplateComposition } from './types';
import type { ExperienceEnvelope } from '@/services/experienceCapabilityResolver';
import { getDesignImplementation, resolveImplementationId } from '@/services/designImplementationRegistry';
import { EXPERIENCE_PERFORMANCE_BUDGET } from '@/platform/core/generatedRuntimeCapabilities';

/** Executable adapters only. Vocabulary without an adapter is never mounted. */
export const COMPOSITION_ENHANCEMENTS = [
  { id: 'editorial-reveal', category: 'motion', vocabularyId: null, sectionTypes: ['about', 'services', 'features', 'testimonials', 'stats', 'team', 'pricing', 'contact', 'cta', 'faq', 'gallery', 'blog-preview', 'before-after', 'logo-cloud'], canvasRoots: 0, imports: ["import { Reveal } from '@/unison/ui/motion';"] },
  { id: 'immersive-hero', category: 'hero', vocabularyId: 'immersive-product', sectionTypes: ['hero'], canvasRoots: 1, imports: ["import { ImmersiveHero } from '@/unison/ui/experience/scene';"] },
  { id: 'scene-backdrop', category: 'background', vocabularyId: '3d-scene', sectionTypes: ['hero'], canvasRoots: 1, imports: ["import { SceneBackground } from '@/unison/ui/experience/scene';"] },
  { id: 'depth-gallery', category: 'media', vocabularyId: 'depth-gallery', sectionTypes: ['gallery'], canvasRoots: 1, imports: ["import { DepthGallery } from '@/unison/ui/experience/media';", "import * as ExperienceTabs from '@/unison/ui/radix/tabs';", "import { Container } from '@/unison/ui/layout';"] },
] as const;

/** The tunnel hero's WebGL layer is the scene backdrop's tunnel variant. */
const TUNNEL_HERO_ID = 'hero:tunnel-immersive';
export type EnhancementId = typeof COMPOSITION_ENHANCEMENTS[number]['id'];
export type EnhancementReason = 'selected' | 'incompatible-capability' | 'missing-assets' | 'performance-budget' | 'missing-implementation' | 'not-applicable';
export interface EnhancementDecision {
  sectionId: string;
  implementationId: string;
  recipeId: EnhancementId;
  reason: EnhancementReason;
}
export interface CompositionActivation {
  policy: 'maximum-compatible';
  version: '1.0';
  decisions: EnhancementDecision[];
  canvasRoots: number;
}

export function resolveCompositionEnhancements(
  template: TemplateComposition,
  envelope: ExperienceEnvelope | undefined,
  canvasBudget: number = EXPERIENCE_PERFORMANCE_BUDGET.maxCanvasRootsPerPage,
): CompositionActivation {
  let remaining = Math.max(0, Math.min(canvasBudget, envelope?.canvasBudget ?? 0, EXPERIENCE_PERFORMANCE_BUDGET.maxCanvasRootsPerPage));
  const decisions: EnhancementDecision[] = [];
  for (const section of template.sections) {
    if (section.hidden) continue;
    const implementationId = resolveImplementationId(section.type, section.variantId);
    for (const recipe of COMPOSITION_ENHANCEMENTS) {
      if (!(recipe.sectionTypes as readonly string[]).includes(section.type)) continue;
      let reason: EnhancementReason = 'selected';
      if (!getDesignImplementation(implementationId)) reason = 'missing-implementation';
      else if (recipe.id === 'immersive-hero' && implementationId === TUNNEL_HERO_ID) reason = 'not-applicable';
      else if (recipe.id === 'immersive-hero' && (!envelope?.immersiveRequested || !['home', 'immersive'].includes(template.pageRole || 'home'))) reason = 'not-applicable';
      else if (recipe.id === 'scene-backdrop' && implementationId !== TUNNEL_HERO_ID && envelope?.immersiveRequested && ['home', 'immersive'].includes(template.pageRole || 'home')) reason = 'not-applicable';
      else if (recipe.id === 'scene-backdrop' && section.sourceSectionId) reason = 'not-applicable';
      else if (recipe.canvasRoots && (!envelope || envelope.webgl === 'ineligible')) reason = 'incompatible-capability';
      else if (recipe.id === 'scene-backdrop' && !envelope?.backgroundCandidates.includes('3d-scene')) reason = 'incompatible-capability';
      else if (recipe.id === 'depth-gallery' && !envelope?.mediaCandidates.includes('depth-gallery')) reason = 'incompatible-capability';
      else if (recipe.id === 'depth-gallery' && !hasGalleryMedia(section.props)) reason = 'missing-assets';
      else if (recipe.canvasRoots > remaining) reason = 'performance-budget';
      if (reason === 'selected') remaining -= recipe.canvasRoots;
      decisions.push({ sectionId: section.id, implementationId, recipeId: recipe.id, reason });
    }
  }
  return {
    policy: 'maximum-compatible', version: '1.0', decisions,
    canvasRoots: decisions.reduce((sum, decision) => sum + (decision.reason === 'selected' ? COMPOSITION_ENHANCEMENTS.find(recipe => recipe.id === decision.recipeId)!.canvasRoots : 0), 0),
  };
}

function hasGalleryMedia(props: unknown): boolean {
  const items = (props as { items?: unknown[] })?.items;
  return Array.isArray(items) && items.length > 0 && items.every(item => {
    const src = (item as { src?: unknown })?.src;
    return typeof src === 'string' && /^(https?:\/\/|\/)/.test(src);
  });
}

/** Emit only adapters actually selected for this page, with explicit mounts for preflight. */
export function emitCompositionEnhancements(activation?: CompositionActivation): { imports: string; source: string } {
  const selected = activation?.decisions.filter(decision => decision.reason === 'selected') ?? [];
  const imports = [...new Set(selected.flatMap(decision => COMPOSITION_ENHANCEMENTS.find(recipe => recipe.id === decision.recipeId)!.imports))].join('\n');
  const branches = selected.map(decision => {
    const condition = `section.id === ${JSON.stringify(decision.sectionId)}`;
    switch (decision.recipeId) {
      case 'editorial-reveal':
        // Guard every experience primitive: a failed optional module must
        // degrade to the canonical content instead of crashing the page.
        return `if (${condition} && typeof Reveal === 'function') content = <Reveal>{content}</Reveal>;`;
      case 'scene-backdrop':
        // Keep the canonical hero, its media and actions intact. The scene is decorative.
        return `if (${condition} && typeof SceneBackground === 'function') content = <div className="relative isolate"><div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-20"><SceneBackground className="z-0"${decision.implementationId === TUNNEL_HERO_ID ? ' variant="tunnel"' : ''} /></div>{content}</div>;`;
      case 'immersive-hero':
        return `if (${condition} && typeof ImmersiveHero === 'function') content = <div data-ut-enhancement="immersive-hero"><ImmersiveHero intensity="cinematic" className="rounded-none">{content}</ImmersiveHero></div>;`;
      case 'depth-gallery':
        // Hydrated props, not frozen sample items. Grid retains the existing lightbox.
        return `if (${condition} && typeof DepthGallery === 'function' && ExperienceTabs && ExperienceTabs.Root && ExperienceTabs.List && ExperienceTabs.Trigger && ExperienceTabs.Content && Array.isArray(props.items) && props.items.length) content = <ExperienceTabs.Root defaultValue="depth" className="ut-block" data-ut-enhancement="depth-gallery">
          <Container><ExperienceTabs.List aria-label="Gallery view" className="flex gap-2">
            <ExperienceTabs.Trigger value="depth" className="ut-shadcn-button" data-ut-radix="control">Immersive view</ExperienceTabs.Trigger>
            <ExperienceTabs.Trigger value="grid" className="ut-shadcn-button" data-ut-radix="control">Photo gallery</ExperienceTabs.Trigger>
          </ExperienceTabs.List></Container>
          <ExperienceTabs.Content value="depth"><Container className="ut-stack">
            {props.headline ? <h2 className="ut-heading">{props.headline}</h2> : null}
            {props.subheadline ? <p>{props.subheadline}</p> : null}
            <DepthGallery items={props.items.filter((item: any) => typeof item.src === 'string').map((item: any) => ({ src: item.src, alt: item.alt || item.caption || '', caption: item.caption }))} />
          </Container></ExperienceTabs.Content>
          <ExperienceTabs.Content value="grid">{content}</ExperienceTabs.Content>
        </ExperienceTabs.Root>;`;
    }
  }).join('\n  ');
  return { imports, source: branches ? `function enhanceSection(section: any, props: any, content: React.ReactElement): React.ReactElement {\n  ${branches}\n  return content;\n}\n` : '' };
}
