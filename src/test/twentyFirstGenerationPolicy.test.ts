import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { getAllSections, getSiteSectionTypes } from '@/sections/registry';
import { getGenerationVariantsForSection, getVariantById, getVariantsForSection as getVariantsForSectionAll, ART_DIRECTION_PACKS } from '@/sections/variants';
import { COMPOSITION_ROLES, validateAIPageComposition } from '@/sections/aiPageComposition';
import type { SectionType } from '@/sections/types';
import { TWENTY_FIRST_INTAKE_MANIFEST } from '@/design/21st-intake/manifest';
import { registerVariants } from '../../scripts/unison-variant-register.mjs';
import recipes from '@/sections/recipes/stylexRecipes.generated.json';

describe('21st-only generation closure', () => {
 it('covers every section family in every art direction with a real 21st recipe', () => {
  for(const pack of Object.values(ART_DIRECTION_PACKS)) for(const type of getSiteSectionTypes()) {
   const variants=getGenerationVariantsForSection(type,pack);
   expect(variants.length,pack.id+':'+type).toBeGreaterThan(0);
   for(const variant of variants) {
    // Canonical rule: declared provenance, 21st adaptation or Unison-authored.
    expect(['21st','unison']).toContain(variant.source?.origin);
    expect(variant.generationStatus).not.toBe('legacy'); expect(variant.vfs?.certification).toBe('approved');
    expect(recipes.families[type as keyof typeof recipes.families]).toContain(variant.id);
   }
  }
 });
 it('accepts only eligible advertised IDs for each planner role', () => {
  const pack=ART_DIRECTION_PACKS['soft-editorial'];
  for(const role of COMPOSITION_ROLES) for(const type of getSiteSectionTypes()) {
   for(const variant of getGenerationVariantsForSection(type,pack,role)) {
    const plan={version:'1.0',pages:[{role,sectionOrder:[type],variants:{[type]:variant.id}}]};
    expect(validateAIPageComposition(plan,pack.id,[role]),role+':'+variant.id).not.toBeNull();
   }
  }
   // A registered but not-yet-migrated hero stays inadmissible for generation.
   const eligibleHeroes=new Set(getGenerationVariantsForSection('hero',pack,'home').map(variant=>variant.id));
   const ineligibleHero=getVariantsForSectionAll('hero').find(variant=>!eligibleHeroes.has(variant.id));
   if(ineligibleHero) {
    expect(validateAIPageComposition({version:'1.0',pages:[{role:'home',sectionOrder:['hero'],variants:{hero:ineligibleHero.id}}]},pack.id,['home'])).toBeNull();
   }
   // hero:prisma-cinematic is a certified generation hero: eligible wherever a pack declares it.
   expect(getVariantById('hero:prisma-cinematic' as never)).toBeDefined();
   const cinematicPacks=Object.values(ART_DIRECTION_PACKS).filter(candidate=>getGenerationVariantsForSection('hero',candidate,'home').some(variant=>variant.id==='hero:prisma-cinematic'));
   expect(cinematicPacks.length).toBeGreaterThanOrEqual(5);
   for(const cinematic of cinematicPacks) {
    expect(validateAIPageComposition({version:'1.0',pages:[{role:'home',sectionOrder:['hero'],variants:{hero:'hero:prisma-cinematic'}}]},cinematic.id,['home']),cinematic.id).not.toBeNull();
   }
 });
 it('closes all original promotion findings with explicit verified or retired dispositions', () => {
  const audit=registerVariants(process.cwd(),{auditOnly:true});
    expect(audit).toMatchObject({valid:true,specCount:10,retiredCount:0,issues:[]});
  for(const record of TWENTY_FIRST_INTAKE_MANIFEST.filter(record=>record.implementationId)) {
   if(record.status==='retired') {
    expect(getVariantById(record.implementationId as never)?.generationStatus).toBe('legacy');
   } else {
    expect(record.licenseReview?.status).toBe('verified'); expect(record.step).toBe(10);
    expect(fs.existsSync(record.archivePath!+'/source.tsx.txt')).toBe(true);
   }
  }
 });
  it('offers every owner-authorized design in every related art-direction family', () => {
    const promoted = [
      ['pricing', 'pricing:feature-table', ['home', 'pricing', 'services']],
      ['navbar', 'navbar:floating-pill', ['home', 'shop', 'services', 'contact', 'about']],
      ['services', 'services:product-cards', ['home', 'shop', 'services']],
      ['cta', 'cta:signal-banner', ['home', 'shop', 'services', 'contact']],
    ] as const;
    for (const pack of Object.values(ART_DIRECTION_PACKS)) for (const [family, id, roles] of promoted) {
      expect(getVariantById(id as never)).toMatchObject({ generationStatus: 'preferred', vfs: { certification: 'approved' } });
      for (const role of roles) {
        expect(getGenerationVariantsForSection(family, pack, role).map(candidate => candidate.id), `${pack.id}:${role}:${id}`).toContain(id);
      }
    }
  });
 it('offers the preferred image-stream hero in every art-direction pack', () => {
   const variant=getVariantById('hero:image-stream' as never);
   expect(variant).toMatchObject({generationStatus:'preferred',source:{origin:'21st',sourceId:'21st:24377'},vfs:{mode:'portable-recipe',certification:'approved'}});
   for(const pack of Object.values(ART_DIRECTION_PACKS)) {
     expect(getGenerationVariantsForSection('hero',pack,'home').map(candidate=>candidate.id),pack.id).toContain('hero:image-stream');
   }
 });
 it('keeps the three active original reviews attached to the reviewed component bytes', () => {
  for(const file of fs.readdirSync('src/design/21st-intake/promotions')) {
   const spec=JSON.parse(fs.readFileSync('src/design/21st-intake/promotions/'+file,'utf8'));
   if(spec.retirement)continue;
   const record=JSON.parse(fs.readFileSync('src/design/21st-intake/imported/'+spec.recordSlug+'/record.json','utf8'));
   const source=fs.readFileSync('src/sections/variants/'+spec.componentPath.replace('./','')+'.tsx');
   expect(record.reviewEvidence.componentSha256).toBe(createHash('sha256').update(source).digest('hex'));
  }
 });
});
