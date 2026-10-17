export const BUILDER_FEATURE_DEFAULTS = { images: true, catalog: true, capabilities: true, repairs: true, tools: true };
export type BuilderFeatures = typeof BUILDER_FEATURE_DEFAULTS;
export type BuilderFeature = keyof BuilderFeatures;
export const BUILDER_FEATURE_KEY = 'unison:builder-features:v1';

export function readBuilderFeatures(raw: string | null): BuilderFeatures {
  try {
    const parsed = JSON.parse(raw ?? '{}');
    return Object.fromEntries(Object.entries(BUILDER_FEATURE_DEFAULTS).map(([key, value]) => [key, typeof parsed?.[key] === 'boolean' ? parsed[key] : value])) as BuilderFeatures;
  } catch { return { ...BUILDER_FEATURE_DEFAULTS }; }
}

export function requireBuilderFeature(features: BuilderFeatures, feature: BuilderFeature): void {
  if (!features[feature]) throw new Error(`Turn on ${feature === 'capabilities' ? 'business actions' : feature} in AI settings to continue.`);
}

/** No compatibility author is permitted for saved source edits. */
export function builderAuthoringLane(launch: boolean, catalog: boolean, files: Record<string, string>): 'launch' | 'catalog' | 'composer' {
  if (launch) return 'launch';
  if (catalog) return 'catalog';
  if (!Object.keys(files).some(path => /^\/src\/.+\.(?:tsx?|jsx?)$/.test(path))) {
    throw new Error('Open a saved React page before requesting an edit. No legacy editing fallback is available.');
  }
  return 'composer';
}