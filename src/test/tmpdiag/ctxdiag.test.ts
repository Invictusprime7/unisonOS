// @vitest-environment node
import { it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
import { resolveIndustryVertical } from '@/services/composition/verticals';

it('diag', () => {
  const c = curateMarketplaceTemplate(ALL_COMPOSITIONS.find((x) => x.id === 'salon-premium')!, THEME_PRESETS[0]);
  const prompt = 'Create a wedding website for Eman & Kiara. Romantic, editorial, soft florals and golden light. Pages: Home, Our Story (About), The Day\'s Details with a day schedule timeline, travel and venue map, and an RSVP form page where guests confirm attendance, meal choice and plus-ones. Include FAQ about dress code, parking, kids and gifts. Elegant serif headings, cream and sage palette, gentle motion.';
  c.contract.business.universalCreation = {
    mode: 'open-ended', originalPrompt: prompt, sitePurpose: 'wedding website', subject: 'Eman & Kiara wedding',
    pages: [{ route: '/', title: 'Home', suggestedRole: 'home', purpose: 'welcome' } as any, { route: '/rsvp', title: 'RSVP', suggestedRole: 'contact', purpose: 'rsvp' } as any],
    visualRequirements: ['soft florals', 'golden light'], requestedCapabilities: ['rsvp'],
    vertical: resolveIndustryVertical(prompt) as any,
    creativeBrief: { tone: ['romantic'], typography: [], color: [], imagery: [], composition: [], motion: [], interactions: [], references: [] },
  } as any;
  const g = buildAppBuilderGenerationContext(c.contract);
  for (const page of c.contract.topology.sitePlan.pages) {
    for (const budget of [12000, 8000, 4000]) {
      const ctx = g.runtimeContextForPage(page.id, budget);
      console.log(page.id, budget, ctx.length, 'OPTIONS=', ctx.includes('CERTIFIED OPTIONS FOR THIS PAGE'), 'props{', (ctx.match(/props \{/g) ?? []).length);
    }
  }
  const ctx = g.runtimeContextForPage(c.contract.topology.sitePlan.pages[0].id, 12000);
  const unbounded = g.runtimeContextForPage(c.contract.topology.sitePlan.pages[0].id, 1e9);
  console.log('UNBOUNDED', unbounded.length);
  const blocks = unbounded.split('\n').map(l => l.slice(0, 70));
  const lines = unbounded.split('\n'); let cur='START', n=0; const out: string[] = [];
  for (const l of lines) { if (/^[A-Z][A-Z \-]{6,}[:(—]/.test(l)) { out.push(cur+' '+n); cur=l.slice(0,50); n=0; } n += l.length+1; }
  out.push(cur+' '+n); console.log(out.join('\n'));
  const noCreation = curateMarketplaceTemplate(ALL_COMPOSITIONS.find((x) => x.id === 'salon-premium')!, THEME_PRESETS[0]);
  const g2 = buildAppBuilderGenerationContext(noCreation.contract);
  const p0 = noCreation.contract.topology.sitePlan.pages[0].id;
  const heads=(t: string)=>t.split('\n').filter(l=>/^[A-Z][A-Z \-]{6,}[:(—]/.test(l)).map(l=>l.slice(0,40));
  const kept=new Set(heads(ctx)); console.log('LOST@12000:', heads(unbounded).filter(h=>!kept.has(h)).join(' | '));
  console.log('TAIL:', ctx.slice(-200));
  console.log('SALON no creation', g2.runtimeContextForPage(p0, 12000).includes('CERTIFIED OPTIONS'), g2.runtimeContextForPage(p0, 1e9).length);
});
