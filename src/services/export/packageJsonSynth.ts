/**
 * Synthesize a package.json + companion Vite/TS/Tailwind config files for a
 * source-project export. Inputs are the prepared VFS + optional RuntimeManifest.
 *
 * The output is intentionally "drop-in for `npm i && npm run dev`" — no
 * platform-specific tokens leak in.
 */

import type { RuntimeManifest } from '@/types/runtimeManifest';
import { resolvePinnedRuntimeVersion, SANDPACK_RUNTIME_PACKAGE_VERSIONS } from '@/utils/sandpackDependencies';

const BASE_DEPS: Record<string, string> = {
  react: '19.2.1',
  'react-dom': '19.2.1',
  'react-router-dom': '7.18.4',
  'lucide-react': '0.545.0',
  'framer-motion': '12.29.2',
  clsx: '2.1.1',
  'tailwind-merge': '3.4.0',
};

const BASE_DEV_DEPS: Record<string, string> = {
  '@types/react': '19.2.7',
  '@types/react-dom': '19.2.3',
  '@vitejs/plugin-react-swc': '4.3.2',
  autoprefixer: '10.5.4',
  postcss: '8.5.24',
  tailwindcss: '3.4.19',
  typescript: '5.9.3',
  vite: '7.3.6',
};

const EXPORT_DEPENDENCY_PINS: Readonly<Record<string, string>> = {
  ...SANDPACK_RUNTIME_PACKAGE_VERSIONS,
  'framer-motion': '12.29.2',
  'tailwind-merge': '3.4.0',
  zod: '4.6.5',
  'react-hook-form': '7.68.0',
  '@hookform/resolvers': '5.2.2',
  'class-variance-authority': '0.7.1',
  'date-fns': '4.1.0',
  'react-day-picker': '9.12.0',
  'embla-carousel-react': '8.6.0',
  cmdk: '1.1.1',
  vaul: '1.1.2',
  'input-otp': '1.4.2',
  'react-resizable-panels': '3.0.6',
  sonner: '2.0.7',
  recharts: '3.5.1',
};

const DEP_BLOCKLIST = new Set([
  '@/', 'react', 'react-dom', // stripped/base
]);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unison-site';
}

function scanImports(files: Record<string, string>): Set<string> {
  const out = new Set<string>();
  const rx = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const rxDynamicImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const rxRequire = /require\(['"]([^'"]+)['"]\)/g;
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?|mjs|cjs)$/i.test(path)) continue;
    if (typeof code !== 'string') continue;
    for (const m of code.matchAll(rx)) out.add(m[1]);
    for (const m of code.matchAll(rxDynamicImport)) out.add(m[1]);
    for (const m of code.matchAll(rxRequire)) out.add(m[1]);
  }
  return out;
}

function extractPkgName(spec: string): string | null {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('~/') || spec.startsWith('node:')) return null;
  if (spec.startsWith('@')) {
    const [scope, name] = spec.split('/');
    return name ? `${scope}/${name}` : null;
  }
  const name = spec.split('/')[0];
  if (['assert', 'buffer', 'crypto', 'events', 'fs', 'http', 'https', 'module', 'os', 'path', 'process', 'stream', 'url', 'util', 'zlib'].includes(name)) return null;
  return name;
}

export interface SynthesizeOptions {
  projectName: string;
  manifest?: RuntimeManifest;
}

export interface SynthesizedProject {
  packageJson: string;
  viteConfig: string;
  tsConfig: string;
  tsConfigNode: string;
  tailwindConfig: string;
  postcssConfig: string;
  indexHtml: string;
  envExample: string;
  readme: string;
  gitignore: string;
  agentsMd: string;
  unisonProjectMd: string;
}

export function synthesizeProjectFiles(
  files: Record<string, string>,
  { projectName, manifest }: SynthesizeOptions,
): SynthesizedProject {
  const slug = slugify(projectName);

  // Merge scanned deps with manifest deps (manifest wins on version).
  const scanned = scanImports(files);
  const dependencies: Record<string, string> = { ...BASE_DEPS };
  for (const spec of scanned) {
    const pkg = extractPkgName(spec);
    if (!pkg || DEP_BLOCKLIST.has(pkg)) continue;
    if (!dependencies[pkg]) {
      dependencies[pkg] = resolvePinnedRuntimeVersion(pkg) ?? EXPORT_DEPENDENCY_PINS[pkg] ?? 'latest';
    }
  }
  if (manifest?.dependencies) {
    for (const [k, v] of Object.entries(manifest.dependencies)) {
      if (k === 'react' || k === 'react-dom') continue;
      dependencies[k] = resolvePinnedRuntimeVersion(k) ?? EXPORT_DEPENDENCY_PINS[k] ?? (v || dependencies[k] || 'latest');
    }
  }

  const packageJson = JSON.stringify(
    {
      name: slug,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies,
      devDependencies: BASE_DEV_DEPS,
    },
    null,
    2,
  ) + '\n';

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { port: 5173, open: true },
});
`;

  const tsConfig = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: false,
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    },
    null,
    2,
  ) + '\n';

  const tsConfigNode = JSON.stringify(
    {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
      },
      include: ['vite.config.ts'],
    },
    null,
    2,
  ) + '\n';

  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
`;

  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  const entry = manifest?.entryPoint?.replace(/^\/+/, '') || 'src/main.tsx';
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entry.startsWith('src/') ? entry : 'src/main.tsx'}"></script>
  </body>
</html>
`;

  const envExample = (manifest?.envRequirements || [])
    .map((k) => `${k}=`)
    .join('\n') + '\n';

  const backendNote = manifest?.backendRequired
    ? `\n## Backend\n\nThis site was generated with backend intents (auth/DB/booking/cart). ` +
      `The frontend ships as-is, but backend endpoints are NOT included. ` +
      `Wire your own handlers to the \`data-ut-intent="..."\` attributes on interactive elements.\n` +
      (manifest.envRequirements?.length
        ? `\nRequired env vars: ${manifest.envRequirements.map((e) => `\`${e}\``).join(', ')}\n`
        : '')
    : '';

  const readme = `# ${projectName}

Exported from Unison. Drop-in Vite + React + Tailwind project.

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open http://localhost:5173.

## Build for production

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Deploy

The \`dist/\` output is a static SPA — deploy to any static host (Vercel,
Netlify, Cloudflare Pages, S3, GitHub Pages). SPA fallback files are included
in the project root under \`_redirects\`, \`vercel.json\`, and \`netlify.toml\`.
${backendNote}
`;

  const gitignore = `node_modules
dist
.env
.env.local
.DS_Store
*.log
`;

  const agentsMd = `# Exported Project Instructions

- Keep application routes and page ownership in the exported source files; do not add Unison service-role credentials.
- Preserve ".unison/" metadata when updating or re-importing this project.
- Treat ".unison/site-bundle-snapshot.json" as the exported design snapshot; edit the site through its source and re-export from Unison to refresh metadata.
- Configure required environment variables locally from ".env.example"; never commit secret values.
- Run "npm run build" before deployment.
`;

  const unisonProjectMd = `# ${projectName}

This project was exported from Unison as a Vite + React source archive.

- Entry point: \`${entry.startsWith('src/') ? entry : 'src/main.tsx'}\`
- Project metadata: \`project-manifest.json\`
- Design context: \`design-context.json\`
- Runtime contract: \`unison.runtime.json\`
- Backend requirements: \`backend-capabilities.json\`
- Asset inventory: \`asset-manifest.json\`
- Unison round-trip metadata: \`.unison/\`

See \`README.md\` for local development and build commands.
`;

  return {
    packageJson,
    viteConfig,
    tsConfig,
    tsConfigNode,
    tailwindConfig,
    postcssConfig,
    indexHtml,
    envExample,
    readme,
    gitignore,
    agentsMd,
    unisonProjectMd,
  };
}
