import { describe, it, expect } from 'vitest';
import { mutateJSXStyles } from '@/utils/jsxElementMutation';
import { anchoredFinder, boundsByText, scrimToneForTextColor, coverBackgroundStyles } from '@/components/creatives/web-builder/pictureInsertion';

const page = `export default function Home(){return (<main>
  <section className="py-24"><h1>Precision hardware engineered</h1></section>
  <section className="py-12"><h2>Proving design through rigorous fabrication</h2><p>TRENDZ started with an unyielding mandate</p></section>
</main>);}`;
// A loose position selector that points at the FIRST section.
const wrong = (src: string) => { const s = src.indexOf('<section'); return { start: s, end: src.indexOf('</section>') + 10 }; };

describe('hero background placement', () => {
  it('lands on the clicked section, found by its own text', () => {
    const f = anchoredFinder(wrong, { tag: 'section', runs: ['Proving design through rigorous fabrication'] });
    const out = mutateJSXStyles(page, 'section:nth-of-type(2)', coverBackgroundStyles('u', 'light'), f)!;
    expect(out.indexOf('style=')).toBeGreaterThan(out.indexOf('Precision hardware'));
    expect(out).toContain('<section className="py-12" style={{');
  });
  it('refuses when the text cannot be pinned to one element', () => {
    expect(boundsByText(page, 'section', ['not on this page anywhere'])).toBeNull();
  });
  it('keeps complex existing styles instead of wiping them', () => {
    const src = `<section style={{ minHeight: 640, ...motion, color: 'red' }}><h2>x</h2></section>`;
    const b = () => ({ start: 0, end: src.length });
    const out = mutateJSXStyles(src, 'section', { backgroundSize: 'cover' }, b)!;
    expect(out).toContain('minHeight: 640');
    expect(out).toContain('...motion');
    expect(out).toContain("backgroundSize: 'cover'");
  });
  it('picks a light shade for dark text', () => {
    expect(scrimToneForTextColor('rgb(20, 20, 20)')).toBe('light');
    expect(scrimToneForTextColor('rgb(250, 250, 250)')).toBe('dark');
  });
});
