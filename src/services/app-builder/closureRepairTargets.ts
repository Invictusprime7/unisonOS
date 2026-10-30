import { collectLocalImportClosure } from '@/services/laneBCompanionModules';
import { isProtectedComposerPath, APP_BUILDER_GENERATION_PREFIXES } from '@/contracts/aiComposerContract';
import type { AuthoringPage } from '@/services/launch/siteAuthoringOrchestrator';

/** Resolve a diagnostic to its source owner, never to every page in the site. */
export function closureRepairTargets(
  files: Record<string, string>,
  pages: readonly AuthoringPage[],
  issues: readonly { severity: string; path?: string; code: string; message: string }[],
): Array<{ page: AuthoringPage; target: string; diagnostics: string[] }> {
  const groups = new Map<string, { page: AuthoringPage; target: string; diagnostics: string[] }>();
  const closures = pages.map(page => ({ page, paths: collectLocalImportClosure(files, page.filePath) }));
  for (const issue of issues) {
    if (issue.severity !== 'blocker') continue;
    const path = issue.path?.startsWith('/src/') ? issue.path
      : pages.find(page => page.route === issue.path)?.filePath;
    const target = path ?? Object.keys(files).find(path => issue.message.includes(path));
    if (!target || isProtectedComposerPath(target)
      || !APP_BUILDER_GENERATION_PREFIXES.some(prefix => target.startsWith(prefix))
      || typeof files[target] !== 'string') continue;
    const owner = closures.find(entry => entry.page.filePath === target)
      ?? closures.find(entry => entry.paths.includes(target));
    if (!owner) continue;
    const group = groups.get(target) ?? { page: owner.page, target, diagnostics: [] };
    group.diagnostics.push(`${issue.code} (${target}): ${issue.message}`);
    groups.set(target, group);
  }
  return [...groups.values()];
}