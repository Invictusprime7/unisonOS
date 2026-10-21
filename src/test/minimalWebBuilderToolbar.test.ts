import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('minimal Web Builder toolbar', () => {
  it('keeps mode controls icon-only, accessible, and visually neutral', () => {
    const toggle = read('src/components/creatives/web-builder/SimpleModeToggle.tsx');

    expect(toggle).toContain('aria-label="Edit mode"');
    expect(toggle).toContain('aria-pressed={currentMode === \'select\'}');
    expect(toggle).toContain('aria-label="Preview mode"');
    expect(toggle).toContain('aria-pressed={currentMode === \'preview\'}');
    expect(toggle).toContain('focus-visible:ring-2');
    expect(toggle).not.toMatch(/<span|<kbd|hover:bg-|bg-white\/10/);
  });

  it('keeps the compact deploy action accessible in icon-only mode', () => {
    const deployButton = read('src/components/DeployButton.tsx');

    expect(deployButton).toContain("const iconOnly = size === 'icon'");
    expect(deployButton).toContain("aria-label={iconOnly ? 'Deploy' : undefined}");
    expect(deployButton).toContain('<span className="sr-only">Deploy</span>');
  });

  it('retains selected control state for assistive tech without toolbar backgrounds', () => {
    const builder = read('src/components/creatives/WebBuilder.tsx');
    const toolbar = builder.slice(
      builder.indexOf('{/* Global builder toolbar */}'),
      builder.indexOf("{/* Creator's Playground Modal */}"),
    );

    expect(toolbar).toContain('overflow-x-auto');
    expect(toolbar).toContain('aria-pressed={device === id}');
    expect(toolbar).toContain('aria-pressed={viewMode === id}');
    expect(toolbar).toContain('aria-pressed={aiPanelOpen}');
    expect(toolbar).not.toContain('bg-white/10');
    expect(toolbar).not.toContain('hover:bg-white/');
  });
});