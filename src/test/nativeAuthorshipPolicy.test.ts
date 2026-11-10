import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PROMPT_CREATIVE_AUTHORITY_POLICY,
  CREATIVE_AUTHORITY_ORDER,
  hasLegacyRegistryOnlyDirective,
  renderOwnerCreativeBrief,
  retireLegacyRegistryOnlyDirective,
} from '@/services/app-builder/creativeAuthorityPolicy';
import { deriveCreativePlan, resolveDesignDirection, confirmedPageNames } from '@/services/launch/creativePlan';
import { buildSyncedVisionBrief, deriveChatLaunchPlan } from '@/services/launch/chatLaunchPlan';
import { buildPromptLaunchInput } from '@/services/launch/promptLaunchInput';
import {
  beginAuthorshipTrace,
  firstLossBoundary,
  manifestFromFiles,
  setAuthorshipTraceEnabled,
  traceHash,
} from '@/services/launch/authorshipTrace';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const SPORTS = 'Build a bold, visually rich, multi-page live sports blog for Accra Sport Desk with a match centre, live scores and cinematic motion.';

describe('single prompt-authority policy (B3)', () => {
  it('is mirrored byte-for-byte on the server', () => {
    const server = read('supabase/functions/_shared/canonicalPipelinePrompt.ts');
    const match = /export const PROMPT_CREATIVE_AUTHORITY_POLICY = '((?:\\'|[^'])*)';/.exec(server);
    expect(match?.[1].replace(/\\'/g, "'")).toBe(PROMPT_CREATIVE_AUTHORITY_POLICY);
    expect(CREATIVE_AUTHORITY_ORDER).toContain(PROMPT_CREATIVE_AUTHORITY_POLICY);
  });

  it('no active authoring instruction restricts body sections to registered families', () => {
    for (const path of [
      'src/services/wizardDesignIntervention.ts',
      'supabase/functions/_shared/canonicalPipelinePrompt.ts',
      'supabase/functions/ai-code-assistant/composerLane.ts',
    ]) {
      const source = read(path);
      expect(source, path).not.toMatch(/never author replacement section source/i);
      expect(source, path).not.toMatch(/Compose only with snapshot-owned UI primitives/);
      expect(source, path).not.toMatch(/never skip down to hand-rolled markup/);
    }
    expect(read('supabase/functions/ai-code-assistant/composerLane.ts')).toContain('${PROMPT_CREATIVE_AUTHORITY_POLICY}');
  });

  it('retires the old directive from saved projects but keeps art direction and motion guidance', () => {
    const saved = 'Compose only with snapshot-owned UI primitives and semantic Stage 4b tokens. Art direction is bold; motion budget expressive. This launch resolved the registered implementations hero:prisma — compose within them and never author replacement section source.';
    expect(hasLegacyRegistryOnlyDirective(saved)).toBe(true);
    const retired = retireLegacyRegistryOnlyDirective(saved);
    expect(hasLegacyRegistryOnlyDirective(retired)).toBe(false);
    expect(retired).toContain('Art direction is bold');
    expect(retired).toContain('motion budget expressive');
  });
});

describe('creative plan (B1/B2)', () => {
  it('turns the prompt into ID-carrying requirements', () => {
    const plan = deriveCreativePlan(SPORTS);
    const ids = plan.requirements.map((requirement) => requirement.id);
    expect(plan.multiPage).toBe(true);
    expect(ids).toEqual(expect.arrayContaining([
      'req:navigation:multi-page', 'req:interaction:match-centre', 'req:interaction:live-scores', 'req:motion:cinematic', 'req:imagery:visually-rich',
    ]));
    expect(plan.creativeBrief.tone).toContain('bold');
    expect(plan.designDirection).toMatchObject({ familyId: 'bold', origin: 'explicit' });
    expect(plan.requirements.every((requirement) => requirement.origin === 'explicit')).toBe(true);
  });

  it('never silently collapses an unmapped style to Modern', () => {
    const cinematic = resolveDesignDirection('A cinematic noir site for a jazz club');
    expect(cinematic).toMatchObject({ familyId: 'bold', origin: 'provisional' });
    expect(cinematic.unmappedStyles).toEqual(['cinematic', 'noir']);
    const unstyled = resolveDesignDirection('A site for my plumbing company');
    expect(unstyled.origin).toBe('provisional');
    expect(unstyled.note).toContain('provisional');
  });

  it('chooses the earliest family the owner names, ignoring negated ones', () => {
    expect(resolveDesignDirection('Minimal, yet bold headlines').familyId).toBe('minimalist');
    expect(resolveDesignDirection('No neon please — warm and earthy').familyId).toBe('organic');
    expect(deriveCreativePlan('No gradients and no neon, just photos').creativeBrief.color).not.toContain('neon');
  });

  it('prefers the confirmed direction when the owner names no style', () => {
    expect(resolveDesignDirection('A site for my club', 'Direction: editorial, magazine-like layouts')).toMatchObject({ familyId: 'editorial', origin: 'confirmed' });
  });

  it('keeps pages from the confirmed direction, labelled as confirmed', () => {
    expect(confirmedPageNames('Pages: Home, Match Centre, Fixtures and News')).toEqual(['Home', 'Match Centre', 'Fixtures', 'News']);
    expect(confirmedPageNames('A contact section sits on the homepage.')).toEqual([]);
    const plan = deriveChatLaunchPlan(
      'Confirmed site direction: Bold football coverage.\nPages: Home, Match Centre, Fixtures, News\nConversation details: I want a multi-page site for Hearts of Oak fans',
      { promptFirst: true },
    );
    const routes = plan.creationInput.pages.map((page) => page.route);
    expect(routes).toEqual(expect.arrayContaining(['/match-centre', '/fixtures']));
    const matchCentre = plan.creationInput.requirements?.find((requirement) => requirement.pageRoute === '/match-centre');
    expect(matchCentre?.origin).toBe('confirmed');
    expect(plan.creationInput.confirmedDirection).toContain('Bold football coverage');
    expect(plan.creationInput.originalPrompt).toBe('I want a multi-page site for Hearts of Oak fans');
  });

  it('launches an unmapped style on its provisional base and says so in the brief', () => {
    const { input } = buildPromptLaunchInput('A cinematic noir portfolio for a film director');
    // No family was named, so the direction stays provisional — but the token
    // base follows the art direction the owner's words selected (Conversational
    // Experience guide), never an unrelated default.
    expect(input.universalCreation?.experienceDirection?.artDirection).toMatchObject({ packId: 'cinematic-portfolio', origin: 'explicit' });
    expect(input.theme.id).toBe('editorial');
    expect(input.designSelection?.artDirectionPackId).toBe('cinematic-portfolio');
    expect(input.universalCreation?.designDirection?.origin).toBe('provisional');
    expect(input.visionPrompt).toContain('PROVISIONAL');
    expect(input.visionPrompt).toContain('[req:experience:art-direction]');
    expect(input.visionPrompt.split('\n')[0]).toContain('cinematic noir portfolio');
  });
});

describe('data honesty on edits (F)', () => {
  it('rejects an edit that drops the visible sample-data label unless the owner asked about it', async () => {
    const { sampleLabelViolations } = await import('@/services/builder/aiCandidateGates');
    const base = { '/src/project-components/MatchCentre.tsx': 'export default function M(){return <span>Live Fixture Ticker (Sample Data)</span>}' };
    const next = { '/src/project-components/MatchCentre.tsx': 'export default function M(){return <span>Live Fixtures</span>}' };
    expect(sampleLabelViolations(base, next, 'Make it two columns')).toHaveLength(1);
    expect(sampleLabelViolations(base, next, 'Remove the sample label, we connected a real feed')).toEqual([]);
    expect(sampleLabelViolations(base, base, 'Make it two columns')).toEqual([]);
  });

  it('keeps "interactive match centre" as a match-centre requirement', () => {
    expect(deriveCreativePlan('an interactive match centre').requirements.map((requirement) => requirement.id)).toContain('req:interaction:match-centre');
  });
});

describe('requirements survive long prompts (B4)', () => {
  it('never truncates the CREATIVE REQUIREMENTS block', () => {
    const plan = deriveChatLaunchPlan(`${SPORTS} ${'Every story needs vivid detail. '.repeat(700)}`, { promptFirst: true });
    const vision = buildSyncedVisionBrief(plan, {
      industry: null, businessName: 'Accra Sport Desk', primaryGoal: null, selectedPages: plan.selectedPages, themePresetId: null,
    });
    expect(vision.length).toBeGreaterThan(20_000);
    const brief = renderOwnerCreativeBrief(vision);
    expect(brief.length).toBeLessThan(9_000);
    for (const id of ['req:navigation:multi-page', 'req:interaction:match-centre', 'req:motion:cinematic', 'req:direction']) {
      expect(brief).toContain(`[${id}]`);
    }
    expect(brief).toContain('[Prompt continues');
  });
});

describe('authorship trace (A2/A3)', () => {
  afterEach(() => setAuthorshipTraceEnabled(null));

  const home = 'import MatchCentre from "../project-components/MatchCentre";\nexport default function Home(){return <main><MatchCentre /></main>;}';
  const module = 'export default function MatchCentre(){return <section>Live</section>;}';

  it('stores hashes and paths, never source', () => {
    const { manifest, counts } = manifestFromFiles({ '/src/pages/Home.tsx': home, '/src/project-components/MatchCentre.tsx': module });
    expect(counts).toMatchObject({ authored: 1, page: 1 });
    expect(manifest.find((entry) => entry.path === '/src/pages/Home.tsx')?.imports).toEqual(['/src/project-components/MatchCentre.tsx']);
    expect(JSON.stringify(manifest)).not.toContain('Live');
  });

  it('is off by default', () => {
    setAuthorshipTraceEnabled(false);
    const trace = beginAuthorshipTrace('off-build');
    trace.record('launchPrompt');
    expect(trace.events()).toEqual([]);
  });

  const run = (normalized: Record<string, string>, invocationHashes = [traceHash('req:interaction:match-centre')]) => {
    setAuthorshipTraceEnabled(true);
    const trace = beginAuthorshipTrace('build-1');
    trace.record('launchPrompt', { requirementHashes: [traceHash('req:interaction:match-centre')] });
    trace.record('authorSiteInvocation', { pageId: '/src/pages/Home.tsx', requirementHashes: invocationHashes });
    trace.recordFiles('rawCandidateFileManifest', { '/src/pages/Home.tsx': home, '/src/project-components/MatchCentre.tsx': module });
    trace.recordFiles('normalizedCandidateFileManifest', normalized);
    trace.recordFiles('acceptedVfsManifest', normalized, { revisionId: 'rev-1' });
    trace.recordFiles('previewRouteManifest', { '/src/pages/Home.tsx': normalized['/src/pages/Home.tsx'] ?? '' });
    return firstLossBoundary(trace.events());
  };

  it('reports no loss when the authored module reaches the accepted revision and Preview', () => {
    const report = run({ '/src/pages/Home.tsx': home, '/src/project-components/MatchCentre.tsx': module });
    expect(report.boundary).toBe('none');
    expect(report.authoredAccepted).toEqual(['/src/project-components/MatchCentre.tsx']);
  });

  it('names normalization when the import is rewritten away', () => {
    expect(run({ '/src/pages/Home.tsx': 'export default function Home(){return <main/>;}', '/src/project-components/MatchCentre.tsx': module }).boundary).toBe('normalization');
  });

  it('names the request when prompt requirements never reached the AI', () => {
    expect(run({ '/src/pages/Home.tsx': home }, []).boundary).toBe('before-model-invocation');
  });
});
