import { describe, expect, it } from 'vitest';
import { parseExpression } from '@babel/parser';
import { mutateJSXText } from '@/utils/jsxElementMutation';
import { findElementBoundsInJSX } from '@/components/creatives/web-builder/jsxSourceUtils';
import { anchoredFinder } from '@/components/creatives/web-builder/pictureInsertion';

const edit = (source: string, text: string) => mutateJSXText(source, '#title', text, findElementBoundsInJSX);

describe('selected source text editing', () => {
  it('replaces a formatted word without changing wrappers, icons or neighboring text', () => {
    const source = '<h1 id="title">Build <strong className="accent">better</strong> sites<ArrowRight /></h1>';
    const next = edit(source, 'Build beautiful sites');
    expect(next).toBe('<h1 id="title">Build <strong className="accent">{"beautiful"}</strong> sites<ArrowRight /></h1>');
    expect(() => parseExpression(next ?? '', { plugins: ['jsx'] })).not.toThrow();
  });
  it('handles multiline JSX, literal expressions and fragments', () => {
    const next = edit('<h1 id="title">\n  Build <><span>{"better"}</span></> sites\n</h1>', 'Build beautiful sites');
    expect(next).toContain('<span>{"beautiful"}</span>');
    expect(() => parseExpression(next ?? '', { plugins: ['jsx'] })).not.toThrow();
  });
  it('preserves an SVG when changing a button label', () => {
    const next = edit('<button id="title"><svg><path d="M0 0" /></svg><span>Continue</span></button>', 'Next');
    expect(next).toBe('<button id="title"><svg><path d="M0 0" /></svg><span>{"Next"}</span></button>');
  });
  it('escapes JSX characters as actual text, including ampersands', () => {
    const next = edit('<h1 id="title"><span>Old</span></h1>', 'A & B < C {value}');
    expect(next).toContain('{"A & B < C {value}"}');
    expect(() => parseExpression(next ?? '', { plugins: ['jsx'] })).not.toThrow();
  });
  it('does not overwrite dynamic data bindings or section content', () => {
    expect(edit('<h1 id="title">Hello <span>{customer.name}</span></h1>', 'New')).toBeNull();
    expect(edit('<section id="title"><h1>Heading</h1><p>Body</p></section>', 'New')).toBeNull();
  });
  it('uses clicked text to avoid a misleading position selector', () => {
    const source = '<section><h1>Wrong title</h1><h1>Selected title</h1></section>';
    const finder = anchoredFinder(findElementBoundsInJSX, { tag: 'h1', runs: ['Selected title'] });
    const next = mutateJSXText(source, 'h1', 'Updated title', finder);
    expect(next).toBe('<section><h1>Wrong title</h1><h1>Updated title</h1></section>');
  });
  it('handles insertions and deletions across multiple inline leaves', () => {
    expect(edit('<h1 id="title">One <em>two</em> three</h1>', 'One TWO three')).toContain('<em>{"TWO"}</em>');
    expect(edit('<h1 id="title"><span>Hi</span></h1>', 'Hi there')).toContain('{"Hi there"}');
    expect(edit('<h1 id="title"><span>Hi there</span></h1>', 'Hi')).toContain('{"Hi"}');
  });
});