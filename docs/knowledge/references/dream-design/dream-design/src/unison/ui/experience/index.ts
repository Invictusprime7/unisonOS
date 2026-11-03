// UNISON GENERATED UI FOUNDATION v1.12
// Experience layer barrel — the ONLY sanctioned WebGL surface for generated
// pages. Heavy primitives (ImmersiveHero, ProductStage, DepthGallery, ModelViewer, SceneBackground) are budgeted by the preflight gate.
// The WebGL renderer itself is loaded lazily from './webgl'; every primitive
// renders its DOM fallback until (or unless) that bundle resolves.
export { ExperienceCanvas, type ExperienceCanvasProps } from './canvas';
export { WebglLayer, ExperienceBoundary, lazyExperienceComponent, type WebglLayerProps } from './lazy';
export { useExperienceMaterial, useExperienceEnabled, type ExperienceMaterial } from './tokens';
export {
  ImmersiveHero,
  ParticleField,
  SceneBackground,
  LightRig,
  type ImmersiveHeroProps,
  type ExperienceIntensity,
  type ParticleDensity,
  type SceneBackgroundVariant,
  type LightRigPreset,
} from './scene';
export { FloatingMedia, DepthGallery, type FloatingMediaProps, type DepthGalleryItem } from './media';
export { ProductStage, ModelViewer, type ProductStageProps, type ModelViewerProps } from './stage';
