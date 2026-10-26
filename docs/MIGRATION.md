# Code Migration & Deployment Guide

This guide provides **actual runnable code** and scripts to migrate your Lovable project to other code editors and deployment platforms.

## Quick Start Scripts

All deployment scripts and configuration files are included in this repository:
- `docker-compose.yml` - Docker setup
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD
- `scripts/setup-local.sh` - Local setup automation
- `scripts/deploy.sh` - Deployment automation
- `vercel.json` / `netlify.toml` - Platform configs

## Table of Contents
1. [Quick Start Scripts](#quick-start-scripts)
2. [Exporting Your Code](#exporting-your-code)
3. [Automated Local Setup](#automated-local-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Docker Deployment](#docker-deployment)
7. [CI/CD Pipelines](#cicd-pipelines)
8. [Platform-Specific Deployments](#platform-specific-deployments)
9. [Common Issues](#common-issues)

---

## Exporting Your Code

### Via GitHub (Recommended)

1. **Connect to GitHub**
   - Click the GitHub button in the top-right of Lovable
   - Authorize the Lovable GitHub App
   - Select your GitHub account/organization
   - Click "Create Repository" to generate a new repo

2. **Clone the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

### Manual Export
If GitHub isn't an option, you can manually copy files from Lovable's Dev Mode.

---

## Local Development Setup

### Prerequisites
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **bun** package manager
- **Git** - [Download](https://git-scm.com/)

### Install Dependencies

```bash
# Using npm
npm install

# Or using bun (faster)
bun install
```

---

## Environment Configuration

### 1. Create Environment File

Create a `.env` file in the project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://rwmbfwjsdwchqiqnqcjo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bWJmd2pzZHdjaHFpcW5xY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzAzOTksImV4cCI6MjA3NDc0NjM5OX0.vYAPveA9NtvlwecrKRNUAsYPzyA4ywkYEIs2xeC57dE
VITE_SUPABASE_PROJECT_ID=rwmbfwjsdwchqiqnqcjo

# Optional: For Edge Functions Development
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2. Backend Options

#### Option A: Continue Using Lovable Cloud (Easiest)
- Keep the existing Supabase credentials above
- No additional setup needed
- Edge functions remain deployed on Lovable's infrastructure

#### Option B: Self-Hosted Supabase
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration scripts from `supabase/migrations/`
3. Update `.env` with your new project credentials
4. Deploy edge functions manually

---

## Database Setup

### Using Lovable Cloud Backend
No setup needed - database is already configured.

### Self-Hosted Supabase

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Link to Your Project**
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```

3. **Apply Migrations**
   ```bash
   supabase db push
   ```

4. **Deploy Edge Functions**
   ```bash
   supabase functions deploy generate-image
   supabase functions deploy generate-template-image
   ```

5. **Set Secrets**
   ```bash
   supabase secrets set LOVABLE_API_KEY=your_key_here
   ```

---

## Running Locally

### Development Server

```bash
# Using npm
npm run dev

# Using bun
bun run dev
```

The app will be available at `http://localhost:8080`

### Build for Production

```bash
# Using npm
npm run build

# Using bun
bun run build
```

The built files will be in the `dist/` directory.

---

## Deployment Options

### 1. Vercel (Recommended for React/Vite)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

**Configuration:**
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Add environment variables in Vercel dashboard

### 2. Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

**Configuration:**
- Build command: `npm run build`
- Publish directory: `dist`
- Add environment variables in Netlify dashboard

### 3. GitHub Pages

1. Update `vite.config.ts`:
   ```typescript
   export default defineConfig({
     base: '/YOUR_REPO_NAME/',
     // ... rest of config
   });
   ```

2. Build and deploy:
   ```bash
   npm run build
   npx gh-pages -d dist
   ```

### 4. Docker

Create `Dockerfile`:
```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "run", "preview"]
```

Build and run:
```bash
docker build -t my-app .
docker run -p 8080:8080 my-app
```

### 5. AWS Amplify / Azure / Google Cloud

Upload the `dist/` folder to your preferred cloud storage with static hosting enabled.

---

## Common Issues

### Issue: "Module not found" errors
**Solution:** Ensure all dependencies are installed:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Supabase connection fails
**Solution:** Verify environment variables are correctly set:
- Check `.env` file exists
- Ensure variables start with `VITE_` prefix
- Restart dev server after changes

### Issue: Edge Functions not working
**Solution:** 
- If using Lovable Cloud: Functions are auto-deployed, no action needed
- If self-hosted: Deploy functions with `supabase functions deploy`

### Issue: Build fails with TypeScript errors
**Solution:**
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix auto-fixable issues
npm run lint -- --fix
```

### Issue: Assets not loading
**Solution:** 
- Check asset paths are relative (e.g., `/assets/image.png`)
- Verify `base` URL in `vite.config.ts` matches deployment path

### Issue: Database migrations fail
**Solution:**
```bash
# Reset and reapply migrations
supabase db reset
supabase db push
```

---

## Code Editors & IDEs

### Recommended Setup

#### VS Code
- Install extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features

#### WebStorm / IntelliJ IDEA
- Native TypeScript support
- Enable ESLint in Preferences → Languages → JavaScript → Code Quality Tools

#### Cursor / Windsurf
- AI-powered editors work great with this codebase
- Import the project and continue developing with AI assistance

---

## Project Structure

```
.
├── src/
│   ├── components/       # React components
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom hooks
│   ├── utils/           # Utility functions
│   ├── schemas/         # Zod validation schemas
│   ├── integrations/    # Supabase client
│   └── types/           # TypeScript types
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
├── public/              # Static assets
└── index.html          # Entry point
```

---

## Technology Stack

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Canvas:** Fabric.js v6
- **Validation:** Zod
- **Routing:** React Router v6

---

## Support

- **Lovable Docs:** [docs.lovable.dev](https://docs.lovable.dev/)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)
- **Vite Docs:** [vitejs.dev](https://vitejs.dev/)

---

## License

Check your project's LICENSE file for licensing information.
