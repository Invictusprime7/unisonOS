import { describe, expect, it } from 'vitest';
import { findUnrequestedCopyChanges, findUnrequestedScopedSideEffects } from '@/services/builder/scopedEditContentGuard';

describe('scoped edit content guard', () => {
  it('rejects a form and new component added to a copy-only edit', () => {
    const original = `export default function Hero() { return <section><p>Hero eyebrow</p></section>; }`;
    const candidate = `import { Mail } from '@/unison/ui/icons';
function ContactForm() { return <form><input /></form>; }
export default function Hero() { return <section><p>Product designer</p><ContactForm /></section>; }`;

    expect(findUnrequestedScopedSideEffects(original, candidate, 'Change only the hero eyebrow copy.'))
      .toEqual(expect.arrayContaining([
        'new imports (1)',
        'new <form> element',
        'new <input> element',
        'new <ContactForm> element',
        'new ContactForm component',
      ]));
  });

  it('allows controls explicitly requested by the prompt', () => {
    const original = `export default function Hero() { return <section><p>Hero eyebrow</p></section>; }`;
    const candidate = `export default function Hero() { return <section><p>Contact us</p><form><input /></form></section>; }`;

    expect(findUnrequestedScopedSideEffects(original, candidate, 'Add a contact form to the hero.')).toEqual([]);
  });

  it('blocks copy rewrites on a style-only request', () => {
    const original = `export default function About() { return <section><h1 className="text-8xl">An Auteur Approach</h1><p>We craft films.</p></section>; }`;
    const candidate = `export default function About() { return <section><h1 className="text-5xl">A Director's Eye</h1><p>We craft films.</p></section>; }`;
    expect(findUnrequestedCopyChanges(original, candidate, 'Make this title smaller', 'An Auteur Approach'))
      .toEqual(['An Auteur Approach']);
  });

  it('allows a wording change only on the clicked element', () => {
    const original = `<section><HeroBlock headline="Visual stories" subheadline="Award winning studio" /><p>Contact the team</p></section>`;
    const scoped = `<section><HeroBlock headline="Stories you feel" subheadline="Award winning studio" /><p>Contact the team</p></section>`;
    const collateral = `<section><HeroBlock headline="Stories you feel" subheadline="A friendly studio" /><p>Say hi</p></section>`;
    expect(findUnrequestedCopyChanges(original, scoped, 'make this less formal', 'Visual stories')).toEqual([]);
    expect(findUnrequestedCopyChanges(original, collateral, 'make this less formal', 'Visual stories'))
      .toEqual(expect.arrayContaining(['Award winning studio', 'Contact the team']));
  });

  it('accepts pure style edits that keep every string', () => {
    const original = `<h1 className="text-8xl">Title</h1>`;
    const candidate = `<h1 className="text-5xl md:text-6xl">Title</h1>`;
    expect(findUnrequestedCopyChanges(original, candidate, 'make it smaller', 'Title')).toEqual([]);
  });
});
