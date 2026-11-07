# DREAM. Design.

Exported from Unison. Drop-in Vite + React + Tailwind project.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Build for production

```bash
npm run build
npm run preview
```

## Deploy

The `dist/` output is a static SPA — deploy to any static host (Vercel,
Netlify, Cloudflare Pages, S3, GitHub Pages). SPA fallback files are included
in the project root under `_redirects`, `vercel.json`, and `netlify.toml`.

## Backend

This site was generated with backend intents (auth/DB/booking/cart). The frontend ships as-is, but backend endpoints are NOT included. Wire your own handlers to the `data-ut-intent="..."` attributes on interactive elements.

Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

