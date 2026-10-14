import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Unison text-only hover policy', () => {
  it('loads after Tailwind and the attached Unison token stylesheet', () => {
    const main = read('src/main.tsx');
    const baseStyles = main.indexOf('import "./index.css"');
    const libraryTokens = main.indexOf('design-system/unison/styles/tokens.css');
    const unisonBridge = main.indexOf('import "./styles/unison-theme.css"');

    expect(baseStyles).toBeGreaterThanOrEqual(0);
    expect(libraryTokens).toBeGreaterThan(baseStyles);
    expect(unisonBridge).toBeGreaterThan(libraryTokens);
  });

  it('illuminates text while neutralizing direct, group, and peer hover decoration', () => {
    const theme = read('src/styles/unison-theme.css');
    const policy = theme.slice(theme.indexOf('/* Existing Tailwind hover utilities'));

    expect(policy).toContain('@media (hover: hover)');
    expect(policy).toContain('[class*="hover:"]:hover');
    expect(policy).toContain('.group:hover [class*="group-hover:"]');
    expect(policy).toContain('.peer:hover [class*="peer-hover:"]');
    expect(policy).toContain('color-mix(in srgb, currentColor var(--ut-hover-illumination-mix), white)');
    expect(policy).toContain('border-color: transparent !important');
    expect(policy).toContain('background-color: transparent !important');
    expect(policy).toContain('box-shadow: none !important');
    expect(policy).toContain('transform: none !important');
    expect(policy).not.toContain('focus-visible');
  });

  it('keeps legacy app and Obsidian stylesheets from adding parallel CSS hover effects', () => {
    for (const path of [
      'src/App.css',
      'src/index.css',
      'src/components/creatives/web-builder/obsidian-theme.css',
    ]) {
      expect(read(path), path).not.toMatch(/:hover\s*\{/);
    }
  });
});
