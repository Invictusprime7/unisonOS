/**
 * Files an AI Builder edit may change in a source project (Affinity-written or
 * imported): the visible page, everything it imports, and the project's own
 * router, global styles and build manifest. New modules are always allowed.
 */
import { isSourceProjectComposerPath } from '@/contracts/aiComposerContract';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';

const PROJECT_WIDE = [
  '/src/App.tsx', '/src/App.jsx', '/src/main.tsx', '/src/main.jsx', '/src/router.tsx', '/src/routes/__root.tsx',
  '/src/index.css', '/src/styles.css', '/src/app.css', '/src/globals.css', '/src/styles/globals.css', '/app/globals.css',
  '/package.json', '/index.html',
  // Projects without a src/ folder (converted older sites).
  '/App.tsx', '/App.jsx', '/index.tsx', '/index.jsx', '/index.css',
];
const MAX_TARGETS = 40;
const MAX_FILE_CHARS = 60_000;

export function sourceProjectEditTargets(files: Readonly<Record<string, string>>, pagePath: string, requested: readonly string[] = []): string[] {
  const editable = (path: string) => typeof files[path] === 'string' && files[path].length <= MAX_FILE_CHARS && isSourceProjectComposerPath(path);
  const ordered = [
    pagePath,
    ...requested,
    ...collectLocalImportClosure(files, pagePath),
    ...PROJECT_WIDE,
  ];
  return [...new Set(ordered)].filter(editable).slice(0, MAX_TARGETS);
}
