import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { readFileSync } from 'node:fs';
import { visualizer } from 'rollup-plugin-visualizer';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const projectRoot = process.cwd();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const supabaseTarget = (env.VITE_SUPABASE_URL || 'https://nfrdomdvyrbwuokathtw.supabase.co').replace(/\/+$/, '');

  return {
    root: projectRoot,
    server: {
      host: "::",
      port: 8080,
      // Keep browser Supabase traffic on the app origin in local development;
      // this also proxies Realtime websocket upgrades.
      proxy: {
        '/__supabase': {
          target: supabaseTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
          rewrite: (requestPath) => requestPath.replace(/^\/__supabase/, ''),
        },
      },
      // Pre-transform the app entry on server start so the first preview load
      // after a restart doesn't stall on cold module compilation.
      warmup: { clientFiles: ['./src/main.tsx', './src/App.tsx'] },
    },
  plugins: [
    react({
      jsxImportSource: undefined, // Use automatic JSX runtime
    }),
    ({
      name: 'sandpack-root-iframe',
      enforce: 'pre',
      configureServer(server) {
        const runnerHtml = readFileSync(
          path.resolve(projectRoot, 'node_modules/@codesandbox/sandpack-client/sandpack/index.html'),
          'utf8',
        );
        server.middlewares.use((request, response, next) => {
          if (request.url === '/' && request.headers.referer?.includes('/web-builder')) {
            response.statusCode = 200;
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(runnerHtml);
            return;
          }
          next();
        });
      },
    }) satisfies Plugin,
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@codesandbox/sandpack-client/sandpack/index.html',
          dest: 'sandpack',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/@codesandbox/sandpack-client/sandpack/static/**/*',
          dest: 'static',
          rename: { stripBase: 5 },
        },
        {
          src: 'node_modules/@codesandbox/sandpack-client/sandpack/*.worker.js',
          dest: '.',
          rename: { stripBase: true },
        },
        {
          src: 'node_modules/@codesandbox/sandpack-client/sandpack/{sandbox-service-worker.js,service-worker.js,file-manifest.json,version.txt}',
          dest: '.',
          rename: { stripBase: true },
        },
      ],
    }),
    mode === "analyze" && visualizer({
      filename: "dist/bundle-analysis.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ].filter(Boolean),
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(projectRoot, "./src"),
      "@radix-ui/react-compose-refs": path.resolve(projectRoot, "./src/lib/compose-refs-shim.ts"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  worker: {
    format: 'es',
  },
  build: {
    // Increase chunk size warning limit to 1000kb for large AI/Canvas libraries
    chunkSizeWarningLimit: 1000,
    // Optimize for modern browsers
    target: 'esnext',
    // Enable minification
    minify: 'esbuild',
  },
  // Optimize dependencies for better loading
  optimizeDeps: {
    include: [
      // Core libraries that should be pre-bundled
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'react-router-dom',
      'lucide-react',
      'clsx',
      'tailwind-merge'
    ],
    exclude: [
      // Heavy libraries that should be dynamically loaded
      '@huggingface/transformers',
      'fabric',
      '@monaco-editor/react',
      'html2canvas'
    ]
  },
  };
});
