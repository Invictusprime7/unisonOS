/**
 * Analyze React/TSX VFS files to extract a structural map of the site.
 * Gives the AI a component-level understanding of the project so it can
 * target specific sections, elements, and components in surgical edits.
 */

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) + '…' : s);

/** Recognized UI section patterns — matched against component names & JSX content */
const SECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /hero/i, label: 'Hero' },
  { pattern: /header/i, label: 'Header' },
  { pattern: /nav(bar|igation)?/i, label: 'Navigation' },
  { pattern: /footer/i, label: 'Footer' },
  { pattern: /pricing/i, label: 'Pricing' },
  { pattern: /testimonial/i, label: 'Testimonials' },
  { pattern: /feature/i, label: 'Features' },
  { pattern: /about/i, label: 'About' },
  { pattern: /contact/i, label: 'Contact' },
  { pattern: /faq/i, label: 'FAQ' },
  { pattern: /cta|call.?to.?action/i, label: 'CTA' },
  { pattern: /gallery/i, label: 'Gallery' },
  { pattern: /team/i, label: 'Team' },
  { pattern: /service/i, label: 'Services' },
  { pattern: /blog|article|post/i, label: 'Blog' },
  { pattern: /portfolio|showcase|work/i, label: 'Portfolio' },
  { pattern: /stats|metric|counter/i, label: 'Stats' },
  { pattern: /newsletter|subscribe/i, label: 'Newsletter' },
  { pattern: /login|signin|auth/i, label: 'Auth' },
  { pattern: /signup|register/i, label: 'Signup' },
  { pattern: /cart|checkout/i, label: 'Cart' },
  { pattern: /booking|appointment|schedule/i, label: 'Booking' },
  { pattern: /sidebar/i, label: 'Sidebar' },
  { pattern: /modal|dialog|popup/i, label: 'Modal' },
  { pattern: /form/i, label: 'Form' },
  { pattern: /card/i, label: 'Card' },
  { pattern: /banner/i, label: 'Banner' },
  { pattern: /logo/i, label: 'Logo' },
];

export interface ComponentInfo {
  name: string;
  file: string;
  isDefault: boolean;
  sectionLabel: string | null;
  headings: string[];
  hasForm: boolean;
  hasButtons: boolean;
  hasImages: boolean;
  hasLinks: boolean;
  childComponents: string[];
  intentWiring: string[];
  lineCount: number;
}

export interface SiteAnalysis {
  components: ComponentInfo[];
  entryFile: string | null;
  sectionMap: string; // human-readable summary for the AI prompt
}

interface ResolveEditTargetOptions {
  /** Active page source used to prefer components actually rendered by that page. */
  preferredFile?: string | null;
  files?: Readonly<Record<string, string>>;
  /** Keep explicit page requests inside that page's import graph. */
  restrictToPreferredFile?: boolean;
}

function normalizeImportPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

function resolveImportedFile(
  fromFile: string,
  specifier: string,
  files: Readonly<Record<string, string>>,
): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? `/src/${specifier.slice(2)}`
    : normalizeImportPath(`${fromFile.slice(0, fromFile.lastIndexOf('/'))}/${specifier}`);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, `${base}/index.tsx`, `${base}/index.ts`];
  return candidates.find((candidate) => candidate in files) ?? null;
}

function collectReachableFiles(
  rootFile: string,
  files: Readonly<Record<string, string>>,
): Set<string> {
  const reachable = new Set<string>();
  const pending = [rootFile];
  while (pending.length) {
    const current = pending.pop();
    if (!current || reachable.has(current) || !files[current]) continue;
    reachable.add(current);
    const imports = files[current].matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g);
    for (const match of imports) {
      const imported = resolveImportedFile(current, match[1], files);
      if (imported && !reachable.has(imported)) pending.push(imported);
    }
  }
  return reachable;
}

/** Identify section label from a component name or its JSX */
function classifySection(name: string, content: string): string | null {
  for (const { pattern, label } of SECTION_PATTERNS) {
    if (pattern.test(name)) return label;
  }
  // Check JSX content for section-level semantic tags
  if (/<header[\s>]/i.test(content)) return 'Header';
  if (/<footer[\s>]/i.test(content)) return 'Footer';
  if (/<nav[\s>]/i.test(content)) return 'Navigation';
  return null;
}

/** Extract component info from React/TSX source code */
function analyzeComponent(content: string, filePath: string): ComponentInfo[] {
  const results: ComponentInfo[] = [];
  
  // Match function/const component declarations
  const componentPatterns = [
    // export default function Name
    /export\s+default\s+function\s+([A-Z]\w*)/g,
    // export function Name
    /export\s+function\s+([A-Z]\w*)/g,
    // function Name (with later export)
    /^function\s+([A-Z]\w*)/gm,
    // const Name = () => | const Name: React.FC
    /(?:export\s+)?const\s+([A-Z]\w*)\s*(?::\s*React\.FC[^=]*)?=\s*(?:\([^)]*\)|[^=])*=>/g,
    // const Name = function
    /(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*function/g,
  ];

  const foundNames = new Set<string>();
  for (const pattern of componentPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      foundNames.add(match[1]);
    }
  }

  // Check for default export  
  const hasDefaultExport = /export\s+default/.test(content);

  // Extract headings from JSX
  const headings: string[] = [];
  const headingRegex = /<h[1-3][^>]*>([^<]+)</g;
  let hMatch;
  while ((hMatch = headingRegex.exec(content)) !== null) {
    headings.push(clip(hMatch[1].trim(), 60));
  }
  // Also match template literal headings: {`Some Heading`}  
  const templateHeadingRegex = /<h[1-3][^>]*>\s*\{[`"]([^`"]+)[`"]\}/g;
  while ((hMatch = templateHeadingRegex.exec(content)) !== null) {
    headings.push(clip(hMatch[1].trim(), 60));
  }

  // Detect forms, buttons, images, links
  const hasForm = /<form[\s>]|onSubmit/i.test(content);
  const hasButtons = /<button[\s>]|<Button[\s>]|onClick/i.test(content);
  const hasImages = /<img[\s>]|<Image[\s>]|background-image|backgroundImage/i.test(content);
  const hasLinks = /<a\s+href|<Link[\s>]/i.test(content);

  // Extract child component usage (PascalCase JSX tags)
  const childComponents: string[] = [];
  const jsxTagRegex = /<([A-Z]\w+)[\s/>]/g;
  let tagMatch;
  while ((tagMatch = jsxTagRegex.exec(content)) !== null) {
    const tag = tagMatch[1];
    if (!foundNames.has(tag) && !childComponents.includes(tag)) {
      childComponents.push(tag);
    }
  }

  // Detect intent wiring
  const intentWiring: string[] = [];
  const intentRegex = /data-ut-intent=["']([^"']+)["']/g;
  let iMatch;
  while ((iMatch = intentRegex.exec(content)) !== null) {
    intentWiring.push(iMatch[1]);
  }
  // Also detect onClick handler intents
  const handlerIntentRegex = /handleIntent\s*\(\s*['"]([^'"]+)['"]/g;
  while ((iMatch = handlerIntentRegex.exec(content)) !== null) {
    intentWiring.push(iMatch[1]);
  }

  const lineCount = content.split('\n').length;

  for (const name of foundNames) {
    results.push({
      name,
      file: filePath,
      isDefault: hasDefaultExport && (
        new RegExp(`export\\s+default\\s+function\\s+${name}`).test(content) ||
        new RegExp(`export\\s+default\\s+${name}`).test(content)
      ),
      sectionLabel: classifySection(name, content),
      headings: headings.slice(0, 5),
      hasForm,
      hasButtons,
      hasImages,
      hasLinks,
      childComponents: childComponents.slice(0, 15),
      intentWiring,
      lineCount,
    });
  }

  // If no named components found but file has JSX, report as anonymous component
  if (foundNames.size === 0 && (/<[A-Z]/.test(content) || /return\s*\(/.test(content))) {
    const fileName = filePath.split('/').pop()?.replace(/\.\w+$/, '') || 'Unknown';
    results.push({
      name: fileName,
      file: filePath,
      isDefault: hasDefaultExport,
      sectionLabel: classifySection(fileName, content),
      headings: headings.slice(0, 5),
      hasForm,
      hasButtons,
      hasImages,
      hasLinks,
      childComponents: childComponents.slice(0, 15),
      intentWiring,
      lineCount,
    });
  }

  return results;
}

/** Analyze all VFS files and produce a structural site map */
export function analyzeReactSite(files: Record<string, string>): SiteAnalysis {
  const allComponents: ComponentInfo[] = [];
  let entryFile: string | null = null;

  for (const [path, content] of Object.entries(files)) {
    // Only analyze TSX/JSX/TS/JS files
    if (!/\.(tsx?|jsx?)$/.test(path)) continue;
    // Skip config/test files
    if (/\.(test|spec|config|d)\./i.test(path)) continue;
    if (/node_modules|__tests__/.test(path)) continue;

    // Identify entry file
    if (/App\.(tsx|jsx)$/.test(path)) entryFile = path;
    if (/main\.(tsx|jsx)$/.test(path) && !entryFile) entryFile = path;

    const components = analyzeComponent(content, path);
    allComponents.push(...components);
  }

  // Build human-readable section map
  const sectionMap = buildSectionMap(allComponents, files, entryFile);

  return { components: allComponents, entryFile, sectionMap };
}

/** Build a concise, AI-friendly section map of the site */
function buildSectionMap(
  components: ComponentInfo[],
  files: Record<string, string>,
  entryFile: string | null,
): string {
  if (components.length === 0) {
    return '(no React components detected in project)';
  }

  const lines: string[] = [];
  lines.push(`Entry: ${entryFile || '(unknown)'}`);
  lines.push(`Components: ${components.length} total`);
  lines.push('');

  // Group by file
  const byFile = new Map<string, ComponentInfo[]>();
  for (const c of components) {
    const existing = byFile.get(c.file) || [];
    existing.push(c);
    byFile.set(c.file, existing);
  }

  // Entry file first, then alphabetical
  const sortedFiles = [...byFile.keys()].sort((a, b) => {
    if (a === entryFile) return -1;
    if (b === entryFile) return 1;
    return a.localeCompare(b);
  });

  for (const file of sortedFiles) {
    const comps = byFile.get(file)!;
    lines.push(`📄 ${file}`);
    for (const c of comps) {
      const tags: string[] = [];
      if (c.isDefault) tags.push('default');
      if (c.sectionLabel) tags.push(c.sectionLabel);
      if (c.hasForm) tags.push('form');
      if (c.hasButtons) tags.push('buttons');
      if (c.hasImages) tags.push('images');
      if (c.hasLinks) tags.push('links');
      
      const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
      const headingStr = c.headings.length > 0 ? ` — "${c.headings[0]}"` : '';
      lines.push(`  └ ${c.name}${tagStr}${headingStr}`);
      
      if (c.childComponents.length > 0) {
        lines.push(`    uses: ${c.childComponents.slice(0, 8).join(', ')}`);
      }
      if (c.intentWiring.length > 0) {
        lines.push(`    intents: ${c.intentWiring.join(', ')}`);
      }
    }
  }

  // Build a quick section index for targeted edits
  const sections = components
    .filter(c => c.sectionLabel)
    .map(c => `${c.sectionLabel} → ${c.name} (${c.file})`);
  
  if (sections.length > 0) {
    lines.push('');
    lines.push('Section Index:');
    for (const s of sections) {
      lines.push(`  • ${s}`);
    }
  }

  return lines.join('\n');
}

/**
 * Identify which file and component a user's edit request targets.
 * Returns the file path, component name, and match confidence.
 */
export function resolveEditTarget(
  userPrompt: string,
  analysis: SiteAnalysis,
  options: ResolveEditTargetOptions = {},
): { file: string; component: string; section: string | null; confidence: 'high' | 'medium' | 'low' } | null {
  const lower = userPrompt.toLowerCase();
  const reachable = options.preferredFile && options.files
    ? collectReachableFiles(options.preferredFile, options.files)
    : null;
  const candidates = options.restrictToPreferredFile && reachable
    ? analysis.components.filter((component) => reachable.has(component.file))
    : analysis.components;
  const prioritizeRendered = (components: ComponentInfo[]): ComponentInfo[] => [...components].sort((a, b) => {
    const aRendered = reachable?.has(a.file) ? 0 : 1;
    const bRendered = reachable?.has(b.file) ? 0 : 1;
    return aRendered - bRendered || a.file.localeCompare(b.file);
  });

  const sectionRequested = (sectionLabel: string | null): boolean => {
    if (!sectionLabel) return false;
    if (lower.includes(sectionLabel.toLowerCase())) return true;
    if (sectionLabel === 'Navigation') return /\b(?:nav|navbar|navigation|menu)\b/i.test(lower);
    return false;
  };
  
  // Named source owners outrank a page classified by nested <nav>/<header> markup.
  const namedSection = prioritizeRendered(candidates).find(c =>
    sectionRequested(c.sectionLabel) && SECTION_PATTERNS.some(({ pattern, label }) =>
      label === c.sectionLabel && pattern.test(c.name)));
  if (namedSection) {
    return { file: namedSection.file, component: namedSection.name, section: namedSection.sectionLabel, confidence: 'high' };
  }

  // Section label match (hero, footer, etc.)
  for (const c of prioritizeRendered(candidates)) {
    if (sectionRequested(c.sectionLabel)) {
      return { file: c.file, component: c.name, section: c.sectionLabel, confidence: 'high' };
    }
  }

  // Direct component name match
  for (const c of prioritizeRendered(candidates).filter((candidate) => (
    candidate.name.toLowerCase() !== candidate.sectionLabel?.toLowerCase()
  ))) {
    if (lower.includes(c.name.toLowerCase())) {
      return { file: c.file, component: c.name, section: c.sectionLabel, confidence: 'high' };
    }
  }

  // Content-based match — check headings
  for (const c of prioritizeRendered(candidates)) {
    for (const heading of c.headings) {
      if (lower.includes(heading.toLowerCase().slice(0, 30))) {
        return { file: c.file, component: c.name, section: c.sectionLabel, confidence: 'medium' };
      }
    }
  }

  // UI element type match
  const elementTargets: Array<{ keywords: RegExp; check: (c: ComponentInfo) => boolean }> = [
    { keywords: /\b(form|input|submit|field)\b/, check: c => c.hasForm },
    { keywords: /\b(button|btn|cta)\b/, check: c => c.hasButtons },
    { keywords: /\b(image|photo|picture|img|logo|icon)\b/, check: c => c.hasImages },
    { keywords: /\b(link|anchor|navigation|menu|nav)\b/, check: c => c.hasLinks },
  ];

  for (const { keywords, check } of elementTargets) {
    if (keywords.test(lower)) {
      const match = prioritizeRendered(candidates.filter(check))[0];
      if (match) {
        return { file: match.file, component: match.name, section: match.sectionLabel, confidence: 'low' };
      }
    }
  }

  return null;
}

/** Project source owners only; site scope expands a named part, not unrelated pages. */
export function resolveEditSourceTargets(
  prompt: string,
  analysis: SiteAnalysis,
  options: { files: Record<string, string>; pageFiles: string[]; preferredFile: string; siteScope: boolean; pinnedFile?: string | null },
): string[] {
  if (options.pinnedFile) return [options.pinnedFile];
  const roots = options.siteScope ? options.pageFiles : [options.preferredFile];
  const targets = roots.flatMap(preferredFile => {
    const target = resolveEditTarget(prompt, analysis, { files: options.files, preferredFile, restrictToPreferredFile: true });
    const inlinePart = /\b(nav|navbar|navigation)\b/i.test(prompt) ? /<nav[\s/>]/i
      : /\bfooter\b/i.test(prompt) ? /<footer[\s/>]/i : null;
    if (inlinePart && inlinePart.test(options.files[preferredFile] ?? '') && (!target || target.file === preferredFile)) return [preferredFile];
    return target ? [target.file] : options.siteScope ? [] : [preferredFile];
  });
  return [...new Set(targets)].filter(path => typeof options.files[path] === 'string');
}
