/**
 * Node addressing — one shared way to name parts of a site and resolve each
 * name to the file that owns it. Read-only: callers that change the resolved
 * owner still commit through the canonical writer.
 *
 *   page:/about            → page whose route is /about
 *   section:/about#hero    → section id "hero" on that page
 *   button:/home#Book      → intent-bearing element (by id, intent or label)
 *   component:SiteNav      → shared component by name
 *   file:/src/pages/X.tsx  → a file
 */
import { buildSystemGraph, type SystemGraph, type GraphPage } from './systemGraph';

export type NodeKind = 'page' | 'section' | 'button' | 'component' | 'file';

export interface NodeAddress { kind: NodeKind; path: string; fragment: string | null }

export type ResolvedNode =
  | { ok: true; address: NodeAddress; canonicalId: string; ownerPath: string; label: string; node: unknown }
  | { ok: false; address: NodeAddress | null; error: string };

const KINDS: NodeKind[] = ['page', 'section', 'button', 'component', 'file'];

export function parseNodeAddress(raw: string): NodeAddress | null {
  const m = /^([a-z]+):(.+)$/.exec(raw.trim());
  if (!m || !KINDS.includes(m[1] as NodeKind)) return null;
  const kind = m[1] as NodeKind;
  const [path, fragment] = m[2].split('#');
  if (!path) return null;
  if ((kind === 'section' || kind === 'button') && !fragment) return null;
  return { kind, path, fragment: fragment ?? null };
}

export function formatNodeAddress(a: NodeAddress): string {
  return `${a.kind}:${a.path}${a.fragment ? `#${a.fragment}` : ''}`;
}

function findPage(graph: SystemGraph, route: string): GraphPage | undefined {
  const norm = route === '' ? '/' : route;
  const canonicalId = graph.aliases[`page:${norm}`];
  if (canonicalId) {
    const aliasedPage = graph.pages.find((page) => page.id === canonicalId);
    if (aliasedPage) return aliasedPage;
  }
  return graph.pages.find((p) => p.route === norm || p.path === norm)
    ?? graph.pages.find((p) => p.name.toLowerCase() === norm.replace(/^\//, '').toLowerCase());
}

function isAmbiguousAlias(graph: SystemGraph, alias: string): boolean {
  return graph.ambiguousAliases?.includes(alias) === true;
}

function normalizeComponentAddress(value: string): string {
  return value.replace(/^component:/i, '').toLowerCase().replace(/[\s_-]+/g, '');
}

export function resolveMutableNode(
  raw: string,
  files: Record<string, string>,
  graph: SystemGraph = buildSystemGraph(files),
): ResolvedNode {
  const address = parseNodeAddress(raw);
  if (!address) return { ok: false, address: null, error: `Not a node address: ${raw} (try page:/about, section:/about#hero, button:/home#Book, component:SiteNav, file:/src/App.tsx)` };

  if (address.kind === 'file') {
    return address.path in files
      ? { ok: true, address, canonicalId: `file:${address.path}`, ownerPath: address.path, label: address.path, node: { path: address.path } }
      : { ok: false, address, error: `File not found: ${address.path}` };
  }
  if (address.kind === 'component') {
    const aliasKey = `component:${address.path}`;
    if (isAmbiguousAlias(graph, aliasKey)) {
      return { ok: false, address, error: `Ambiguous component alias: ${address.path}; use its canonical component name or file path.` };
    }
    const sought = normalizeComponentAddress(address.path);
    const aliasTarget = graph.aliases[aliasKey];
    const matches = graph.components.filter((component) =>
      component.id === aliasTarget
      || [component.name, component.id, ...(component.aliases ?? []), component.sourcePath ?? '']
        .some((candidate) => normalizeComponentAddress(candidate) === sought),
    );
    if (matches.length > 1) return { ok: false, address, error: `Ambiguous component address: ${address.path}; use its canonical component name or file path.` };
    const c = matches[0];
    if (!c?.sourcePath) return { ok: false, address, error: `Component not found: ${address.path}` };
    return { ok: true, address, canonicalId: c.id, ownerPath: c.sourcePath, label: c.name, node: c };
  }
  const pageAlias = `page:${address.path === '' ? '/' : address.path}`;
  if (isAmbiguousAlias(graph, pageAlias)) {
    return { ok: false, address, error: `Ambiguous page alias: ${address.path}; use a canonical route.` };
  }
  const page = findPage(graph, address.path);
  if (!page) return { ok: false, address, error: `No page at ${address.path}` };
  if (address.kind === 'page') return { ok: true, address, canonicalId: page.id, ownerPath: page.path, label: page.name, node: page };

  const frag = address.fragment!.toLowerCase();
  if (address.kind === 'section') {
    const aliasTarget = graph.aliases[`section:${page.route}#${address.fragment}`]
      ?? graph.aliases[`section:${page.id}#${address.fragment}`];
    const s = page.sections.find((x) => x.nodeId === aliasTarget || x.id.toLowerCase() === frag || x.nodeId.toLowerCase() === frag);
    return s
      ? { ok: true, address, canonicalId: s.nodeId, ownerPath: page.path, label: `${page.name} › ${s.id}`, node: s }
      : { ok: false, address, error: `No section "${address.fragment}" on ${page.name} (has: ${page.sections.map((x) => x.id).join(', ') || 'none'})` };
  }
  const aliasTarget = graph.aliases[`button:${page.route}#${address.fragment}`];
  const intent = page.intents.find((x) => x.id === aliasTarget || x.id.toLowerCase() === frag || x.intent.toLowerCase() === frag)
    ?? page.intents.find((x) => x.label.toLowerCase().includes(frag));
  return intent
    ? { ok: true, address, canonicalId: intent.id, ownerPath: page.path, label: `${page.name} › "${intent.label || intent.intent}" → ${intent.target ?? intent.intent}`, node: intent }
    : { ok: false, address, error: `No button "${address.fragment}" on ${page.name}` };
}
