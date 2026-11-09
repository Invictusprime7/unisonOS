// Temporary live probe (deleted after the run): real AI authorship through the
// real App Builder page path against the Lovable Cloud test copy.
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createUnisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { buildPromptLaunchInput } from '@/services/launch/promptLaunchInput';
import { buildRequirementCoverage } from '@/services/app-builder/requirementCoverage';
import { manifestFromFiles } from '@/services/launch/authorshipTrace';

const URL = 'https://oruwtgdjurstvhgqcvbv.supabase.co/functions/v1/generate-page';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydXd0Z2RqdXJzdHZoZ3FjdmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTE5NzIsImV4cCI6MjA3NTg2Nzk3Mn0.aOV9uab2niXhszfqCg81yzDRDg1-15XS9BL3-2bhhYM';
const OUT = '/tmp/live-native';

const invoke = async (input: Record<string, unknown>, options: { signal?: AbortSignal } = {}) => {
  const response = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN}` },
    body: JSON.stringify(input),
    signal: options.signal,
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { data = null; }
  writeFileSync(`${OUT}/status-${Date.now()}.txt`, `${response.status} ${text.slice(0, 600)}`);
  return response.ok ? { data, error: null } : { data, error: Object.assign(new Error(`HTTP ${response.status}`), { context: { status: response.status, body: text.slice(0, 2000) } }) };
};

const shell = {
  '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'react-router-dom': '^6.26.0', 'framer-motion': '^11.0.0', 'lucide-react': '^0.462.0' } }),
  '/src/project-components/site/SiteNav.tsx': 'import { Link } from "react-router-dom";\nexport default function SiteNav(){return <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="custom:site-nav"><nav aria-label="Main"><Link to="/">Home</Link> <Link to="/match-centre">Match Centre</Link></nav></header>;}\n',
  '/src/project-components/site/SiteFooter.tsx': 'export default function SiteFooter(){return <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="custom:site-footer"><p>Whistle Blower</p></footer>;}\n',
  '/src/pages/Home.tsx': 'import SiteNav from "../project-components/site/SiteNav";\nimport SiteFooter from "../project-components/site/SiteFooter";\nexport default function Home(){return <><SiteNav /><main><section data-ut-section-id="home:hero:0" data-ut-section-type="hero" data-ut-variant="custom:home-hero"><h1>Whistle Blower</h1></section></main><SiteFooter /></>;}\n',
};

describe.skipIf(!process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN)('live native authorship probe', () => {
  it('AI authors an original match centre page with its own module', async () => {
    mkdirSync(OUT, { recursive: true });
    const { input } = buildPromptLaunchInput('Create Whistle Blower: a bold, visually rich, multi-page live-sports blog with live scores, an interactive match centre and cinematic motion. Use clearly labelled sample data.');
    const builder = createUnisonAppBuilder({ invokePage: invoke as never, loadContentTypes: async () => [] });
    const result = await builder.generatePages({
      operationId: 'live-native-probe',
      currentFiles: shell,
      baseRevisionId: null,
      pages: [{ pageId: 'match-centre', title: 'Match Centre', route: '/match-centre', filePath: '/src/pages/MatchCentre.tsx', role: 'custom', pageType: 'custom', showInNav: true } as never],
      existingRoutes: [{ title: 'Home', route: '/' }],
      businessName: 'Whistle Blower',
      industry: 'universal',
      visionBrief: `${input.visionPrompt}\nFor THIS page: build the interactive match centre as an ORIGINAL component module under /src/project-components/sports/ (e.g. MatchCentre.tsx) and import it from the page. Reuse SiteNav and SiteFooter.`,
      budgetMs: 240_000,
    });
    const files = result.candidateFiles;
    const { manifest } = manifestFromFiles(files);
    writeFileSync(`${OUT}/result.json`, JSON.stringify({ status: result.status, stopReason: result.stopReason, diagnostics: result.diagnostics, manifest }, null, 2));
    for (const entry of manifest) if (entry.provenance !== 'chrome') writeFileSync(`${OUT}/${entry.path.replace(/\//g, '_')}`, files[entry.path]);
    const coverage = buildRequirementCoverage({
      requirements: input.universalCreation?.requirements ?? [],
      files,
      pages: [{ route: '/', filePath: '/src/pages/Home.tsx', title: 'Home' }, { route: '/match-centre', filePath: '/src/pages/MatchCentre.tsx', title: 'Match Centre' }],
    });
    writeFileSync(`${OUT}/coverage.json`, JSON.stringify(coverage, null, 2));
    expect(result.status, JSON.stringify(result.diagnostics)).toBe('ready-for-commit');
  }, 300_000);
});
