import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { readFileSync } from 'node:fs';
import { visualizer } from 'rollup-plugin-visualizer';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const projectRoot = process.cwd();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: projectRoot,
  server: {
    host: "::",
    port: 8080,
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
      open: true,
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
    rollupOptions: {
      output: {
        // Comprehensive manual chunk splitting for optimal loading
        manualChunks: (id: string) => {
          // Builder-only runtime libraries are large enough to make the
          // WebBuilder route appear permanently suspended when bundled into
          // the shared vendor chunk. Keep them independently cacheable and
          // loadable in parallel with the route shell.
          if (id.includes('@babel/standalone')) {
            return 'babel-standalone';
          }
          if (id.includes('@codesandbox/sandpack')) {
            return 'sandpack-runtime';
          }

          // React core, router, and React-dependent utilities (must stay together)
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') ||
              id.includes('use-callback-ref') || id.includes('use-sidecar') || 
              id.includes('use-sync-external-store') || id.includes('scheduler') ||
              id.includes('aria-hidden') || id.includes('react-remove-scroll')) {
            return 'react-core';
          }
          
          // Heavy creative tools (loaded on demand)
          if (id.includes('fabric')) {
            return 'fabric-canvas';
          }
          if (id.includes('@monaco-editor')) {
            return 'monaco-editor';
          }
          if (id.includes('@huggingface/transformers')) {
            return 'ai-transformers';
          }
          
          // UI Component libraries
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // Charts and visualization
          if (id.includes('recharts') || id.includes('html2canvas')) {
            return 'charts-viz';
          }
          
          // Backend and data fetching
          if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
            return 'backend-api';
          }
          
          // Utilities and smaller libraries
          if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority') || 
              id.includes('date-fns') || id.includes('nanoid') || id.includes('zod')) {
            return 'utils';
          }
          
          // Form handling
          if (id.includes('react-hook-form') || id.includes('@hookform')) {
            return 'form-handling';
          }
          
          // Syntax highlighting and code tools - split languages separately
          if (id.includes('react-syntax-highlighter') || id.includes('prismjs')) {
            return 'syntax-highlighting';
          }
          if (id.includes('refractor/lang')) {
            return 'syntax-languages';
          }
          if (id.includes('refractor')) {
            return 'refractor-core';
          }
          
          // Animation libraries
          if (id.includes('framer-motion') || id.includes('motion')) {
            return 'animation';
          }
          
          // CodeMirror / code editor
          if (id.includes('@codemirror') || id.includes('@lezer')) {
            return 'codemirror';
          }
          
          // Markdown and rich text
          if (id.includes('marked') || id.includes('dompurify') || id.includes('turndown')) {
            return 'markdown';
          }
          
          // PDF generation
          if (id.includes('jspdf') || id.includes('html2pdf')) {
            return 'pdf-export';
          }
          
          // Image processing
          if (id.includes('heic2any') || id.includes('browser-image-compression')) {
            return 'image-processing';
          }
          
          // Embla carousel
          if (id.includes('embla-carousel')) {
            return 'carousel';
          }
          
          // React Select and similar
          if (id.includes('react-select') || id.includes('react-day-picker')) {
            return 'form-widgets';
          }
          
          // Sonner toast
          if (id.includes('sonner')) {
            return 'toast';
          }

          // Node modules vendor chunk - group smaller packages together
          if (id.includes('node_modules')) {
            // Don't split every package individually - causes module resolution issues
            return 'vendor';
          }
        },
      }
    },
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
}));
