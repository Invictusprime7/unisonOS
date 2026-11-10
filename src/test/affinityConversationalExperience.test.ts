import { describe, expect, it } from 'vitest';
import {
  CREATIVE_BRIEF_PATH,
  deriveExperienceDirection,
  designSelectionFromDirection,
  experienceRequirements,
  refineExperienceDirection,
  refinedCreativeBriefFile,
  renderCreativeBriefDirective,
  serializeCreativeBrief,
} from '@/services/launch/experienceDirector';

const MUSIC = 'Create a cinematic music artist website with an immersive hero, horizontal releases gallery, tour dates, and fan sign-ups.';
const SPORTS = 'Build a bold, visually rich, multi-page live sports blog with a match centre, editorial news layouts, and animated scores.';
const WEDDING = 'Create a romantic editorial wedding website with an immersive photography hero, our story timeline, schedule, and dedicated RSVP page.';

const decision = (direction: ReturnType<typeof deriveExperienceDirection>, id: string) =>
  direction.decisions.find((entry) => entry.id === id);

describe('Affinity conversational experience direction', () => {
  it('reads the music brief into art direction, experience, hero and gallery decisions', () => {
    const direction = deriveExperienceDirection({
      ownerText: MUSIC,
      pages: [{ route: '/', title: 'Home' }, { route: '/releases', title: 'Releases' }, { route: '/tour', title: 'Tour' }],
    });
    expect(direction.artDirection.packId).toBe('cinematic-portfolio');
    expect(direction.artDirection.origin).toBe('explicit');
    expect(direction.artDirection.evidence).toContain('cinematic');
    expect(direction.experience.value).toBe('motion-rich');
    const hero = decision(direction, 'dec:hero:home');
    expect(hero?.modifiers).toContain('immersive');
    expect(hero?.resolution).not.toBe('author');
    const gallery = decision(direction, 'dec:section:gallery:releases');
    expect(gallery?.pageRoute).toBe('/releases');
    expect(gallery?.modifiers).toContain('horizontal');
    expect(gallery?.implementationIds[0]).toBe('gallery:horizontal-reel');
    expect(gallery?.resolution).toBe('reuse');
  });

  it('reads the sports brief: bold family, editorial news layouts and animated scores', () => {
    const direction = deriveExperienceDirection({
      ownerText: SPORTS,
      designDirection: { familyId: 'bold', origin: 'explicit', evidence: 'bold' },
    });
    expect(direction.artDirection.familyId).toBe('bold');
    expect(direction.artDirection.packId).toBe('bold-commercial');
    expect(direction.experience.value).toBe('motion-rich');
    expect(decision(direction, 'dec:section:blog-preview:site')?.modifiers).toContain('editorial');
    expect(decision(direction, 'dec:section:stats:site')?.modifiers).toContain('animated');
  });

  it('reads the wedding brief: soft editorial grammar, photography hero and an authored story timeline', () => {
    const direction = deriveExperienceDirection({
      ownerText: WEDDING,
      designDirection: { familyId: 'editorial', origin: 'explicit', evidence: 'editorial' },
      vertical: { designTerms: ['elegant', 'editorial', 'romantic', 'serif', 'airy'] },
      pages: [{ route: '/', title: 'Home' }, { route: '/rsvp', title: 'RSVP' }],
    });
    expect(direction.artDirection.packId).toBe('soft-editorial');
    const hero = decision(direction, 'dec:hero:home');
    expect(hero?.modifiers).toEqual(expect.arrayContaining(['immersive', 'photography']));
    expect(hero?.pageRoute).toBe('/');
    const timeline = decision(direction, 'dec:original:timeline:site');
    expect(timeline?.resolution).toBe('author');
    expect(timeline?.value).toContain('story timeline');
  });

  it('never defaults to Modern when the owner names no style', () => {
    const direction = deriveExperienceDirection({ ownerText: 'A website for my dog walking business.' });
    expect(direction.artDirection.origin).toBe('inferred');
    expect(direction.decisions).toEqual([]);
  });

  it('honours an owner-named pack and negated styles', () => {
    expect(deriveExperienceDirection({ ownerText: 'Use the Swiss Grid look for my studio.' }).artDirection.packId).toBe('swiss-grid');
    const notDark = deriveExperienceDirection({ ownerText: 'A cinematic film studio site, but not dark or moody.' });
    expect(['editorial-noir', 'noir-atelier']).not.toContain(notDark.artDirection.packId);
  });

  it('a scoped refinement changes only the hero and locks every other decision', () => {
    const base = deriveExperienceDirection({ ownerText: WEDDING, designDirection: { familyId: 'editorial', origin: 'explicit', evidence: 'editorial' } });
    const outcome = refineExperienceDirection(base, 'Make the hero more cinematic, but leave the rest of the site unchanged.');
    expect(outcome.changed).toEqual(['dec:hero:home']);
    expect(outcome.preserveRest).toBe(true);
    const hero = decision(outcome.direction, 'dec:hero:home');
    expect(hero?.modifiers).toEqual(expect.arrayContaining(['cinematic', 'immersive', 'photography']));
    expect(hero?.origin).toBe('refinement');
    expect(outcome.direction.artDirection).toEqual(base.artDirection);
    expect(outcome.direction.experience).toEqual(base.experience);
    expect(decision(outcome.direction, 'dec:original:timeline:site')).toEqual(decision(base, 'dec:original:timeline:site'));
    expect(outcome.locked).toEqual(expect.arrayContaining(['dec:art-direction', 'dec:experience', 'dec:original:timeline:site']));
    expect(outcome.locked).not.toContain('dec:hero:home');
  });

  it('a confirmed summary cannot overwrite the owner\'s own decision', () => {
    const direction = deriveExperienceDirection({
      ownerText: 'A gallery site with a masonry gallery.',
      confirmedDirection: '**Pages** — Home with a carousel gallery',
    });
    expect(decision(direction, 'dec:section:gallery:site')?.modifiers).toEqual(['masonry']);
    expect(decision(direction, 'dec:section:gallery:site')?.origin).toBe('explicit');
  });

  it('later refinements win and are recorded as refinements', () => {
    const direction = deriveExperienceDirection({
      ownerText: 'A portfolio with a masonry gallery.',
      refinements: ['Actually, use a horizontal gallery instead.'],
    });
    const gallery = decision(direction, 'dec:section:gallery:site');
    expect(gallery?.modifiers).toEqual(['horizontal']);
    expect(gallery?.origin).toBe('refinement');
  });

  it('projects decisions into ID-carrying requirements and executable pins', () => {
    const direction = deriveExperienceDirection({
      ownerText: MUSIC,
      pages: [{ route: '/', title: 'Home' }, { route: '/releases', title: 'Releases' }],
    });
    const requirements = experienceRequirements(direction);
    expect(requirements.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'req:experience:art-direction', 'req:experience:budget', 'req:experience:hero:home', 'req:experience:section:gallery:releases',
    ]));
    const gallery = requirements.find((entry) => entry.id === 'req:experience:section:gallery:releases');
    expect(gallery?.design?.implementationIds?.[0]).toBe('gallery:horizontal-reel');
    expect(gallery?.text).toContain('REUSE certified gallery:horizontal-reel');
    const selection = designSelectionFromDirection(direction);
    expect(selection.artDirectionPackId).toBe('cinematic-portfolio');
    expect(selection.experience).toBe('motion-rich');
    expect(selection.routePins?.['/releases']?.gallery).toBe('gallery:horizontal-reel');
    expect(selection.routePins?.['/']?.hero).toBeTruthy();
  });

  it('is deterministic for the same words', () => {
    expect(JSON.stringify(deriveExperienceDirection({ ownerText: SPORTS }))).toBe(JSON.stringify(deriveExperienceDirection({ ownerText: SPORTS })));
  });

  it('records an Affinity edit refinement in the sealed brief and tells the editor what is locked', () => {
    const base = deriveExperienceDirection({ ownerText: WEDDING });
    const files = { [CREATIVE_BRIEF_PATH]: serializeCreativeBrief(base, [{ route: '/', title: 'Home' }]) };
    const instruction = 'Make the hero more cinematic, but leave the rest of the site unchanged.';
    const refined = refinedCreativeBriefFile(files, instruction);
    expect(refined?.changed).toEqual(['dec:hero:home']);
    expect(JSON.parse(refined!.contents).direction.decisions.find((entry: { id: string }) => entry.id === 'dec:hero:home').origin).toBe('refinement');
    expect(refinedCreativeBriefFile(files, 'Fix the typo in the footer address.')).toBeNull();
    const directive = renderCreativeBriefDirective(JSON.parse(files[CREATIVE_BRIEF_PATH]), instruction);
    expect(directive).toContain('This request changes only: dec:hero:home');
    expect(directive).toContain('leave everything else unchanged');
  });
});
