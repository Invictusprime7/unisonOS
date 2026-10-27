/**
 * Read-only discovery of commerce artifacts authored into a generated site's VFS.
 * These findings describe source fixtures, not persisted catalog records.
 */
export interface AuthoredCatalogItem {
  id: string;
  name: string;
  price: number | null;
  sourcePath: string;
}

export interface GeneratedSiteDiscovery {
  authoredCatalogItems: AuthoredCatalogItem[];
  relevantFiles: string[];
  cartRuntimeFiles: string[];
  controls: Array<{ label: string; sourcePath: string; intent?: string; href?: string }>;
}

const SOURCE_FILE = /\.(?:[jt]sx?|mjs|cjs)$/i;
const COMMERCE_TERMS = /\b(?:cart|bag|checkout|addToCart|add-to-cart|product|catalog|collection)\b/i;
const CART_RUNTIME_TERMS = /\b(?:CartProvider|useCart|cartItems|setCart|createContext|CartContext)\b/;
const MAX_ITEMS = 24;
const MAX_CONTROLS = 24;

function numericPrice(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function textAttribute(attributes: string, name: string): string | undefined {
  return attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
}

/**
 * Keeps generated source data visible to the authoring lane when a project has
 * not yet been connected to the managed catalog. This must never be treated as
 * a database catalog or used as a write target.
 */
export function discoverGeneratedSiteArtifacts(files: Record<string, string>): GeneratedSiteDiscovery {
  const authoredCatalogItems: AuthoredCatalogItem[] = [];
  const relevantFiles: string[] = [];
  const cartRuntimeFiles: string[] = [];
  const controls: GeneratedSiteDiscovery['controls'] = [];
  const seenItems = new Set<string>();

  for (const [sourcePath, source] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!SOURCE_FILE.test(sourcePath)) continue;
    const commerceSource = COMMERCE_TERMS.test(sourcePath) || COMMERCE_TERMS.test(source);
    if (!commerceSource) continue;
    relevantFiles.push(sourcePath);
    if (CART_RUNTIME_TERMS.test(source)) cartRuntimeFiles.push(sourcePath);

    // Static generated sites commonly express their product fixture as an
    // object literal. Capture only objects that have a product-like name and a
    // price; arbitrary editorial copy therefore cannot become a catalog item.
    const productObject = /\{[^{}]{0,180}?(?:name|title)\s*:\s*["']([^"']{2,100})["'][^{}]{0,360}?price\s*:\s*["']?\$?([\d,.]+)["']?[^{}]{0,180}?\}/gi;
    for (const match of source.matchAll(productObject)) {
      if (authoredCatalogItems.length >= MAX_ITEMS) break;
      const name = match[1].trim();
      const key = `${sourcePath}:${name.toLowerCase()}`;
      if (seenItems.has(key)) continue;
      seenItems.add(key);
      authoredCatalogItems.push({
        id: `source:${sourcePath}:${authoredCatalogItems.length + 1}`,
        name,
        price: numericPrice(match[2]),
        sourcePath,
      });
    }

    // Surface real controls too, so a request such as "wire add to cart" can
    // be scoped to the existing button instead of inventing a replacement.
    const control = /<(?:button|a)\b([^>]*)>([^<]{1,120})<\/(?:button|a)>/gi;
    for (const match of source.matchAll(control)) {
      if (controls.length >= MAX_CONTROLS) break;
      const attributes = match[1];
      const label = match[2].replace(/\s+/g, ' ').trim();
      const intent = textAttribute(attributes, 'data-ut-intent');
      const href = textAttribute(attributes, 'href');
      if (!label || !(/cart|bag|checkout|add|shop|buy/i.test(label) || intent || href?.match(/cart|bag|checkout|shop/i))) continue;
      controls.push({ label, sourcePath, intent, href });
    }
  }

  return { authoredCatalogItems, relevantFiles, cartRuntimeFiles, controls };
}

/** A bounded projection intended only for the Composer's read context. */
export function renderGeneratedSiteDiscoveryForPrompt(discovery: GeneratedSiteDiscovery, maxChars = 2800): string {
  const lines = [
    'GENERATED SITE SOURCE INVENTORY (authored VFS fixtures; not saved database catalog rows):',
    discovery.authoredCatalogItems.length
      ? `- Authored products: ${discovery.authoredCatalogItems.map((item) => `${item.name}${item.price != null ? ` ($${item.price})` : ''} in ${item.sourcePath}`).join('; ')}`
      : '- No static product fixtures were detected.',
    discovery.cartRuntimeFiles.length
      ? `- Shared cart/runtime source: ${discovery.cartRuntimeFiles.join(', ')}`
      : '- No shared cart runtime was detected.',
    discovery.controls.length
      ? `- Existing commerce controls: ${discovery.controls.map((control) => `${JSON.stringify(control.label)} in ${control.sourcePath}${control.intent ? ` [${control.intent}]` : ''}${control.href ? ` -> ${control.href}` : ''}`).join('; ')}`
      : '- No existing commerce controls were detected.',
    `- Related authored files: ${discovery.relevantFiles.join(', ') || 'none'}`,
    'Use these source artifacts for scoped implementation. Do not claim they are managed catalog records or create duplicate cart state.',
  ];
  const rendered = lines.join('\n');
  return rendered.length > maxChars ? `${rendered.slice(0, maxChars)}\n…` : rendered;
}

/** Includes generated runtime/provider files that a page-only selector misses. */
export function sourceTargetsForCartWiring(files: Record<string, string>, activePagePath: string): string[] {
  const discovery = discoverGeneratedSiteArtifacts(files);
  return Array.from(new Set([
    activePagePath,
    ...discovery.cartRuntimeFiles,
    ...discovery.authoredCatalogItems.map((item) => item.sourcePath),
    ...discovery.controls.map((control) => control.sourcePath),
  ])).slice(0, 32);
}
