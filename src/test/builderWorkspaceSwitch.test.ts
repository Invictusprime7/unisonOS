import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AI Builder workspace switch', () => {
  it('hosts the existing Tools and Customizer views as AI Builder tabs', () => {
    const panel = read('src/components/creatives/web-builder/AIBuilderPanel.tsx');

    expect(panel).toContain('value="tools"');
    expect(panel).toContain('value="customize"');
    expect(panel).toContain('ref={onToolsHostChange}');
    expect(panel).toContain('ref={onCustomizerHostChange}');
    expect(panel).toContain("if (!customizerAvailable && activeTab === 'customize') setActiveTab('code')");
  });

  it('renders the same parent-owned panels once and keeps standalone fallbacks out of AI mode', () => {
    const builder = read('src/components/creatives/WebBuilder.tsx');

    expect(builder.match(/const builderToolsPanel = \(/g)).toHaveLength(1);
    expect(builder.match(/createPortal\(builderToolsPanel, aiBuilderToolsHost\)/g)).toHaveLength(1);
    expect(builder).toContain('{!aiPanelOpen && !leftPanelCollapsed && builderToolsPanel}');
    expect(builder).toMatch(/createPortal\(\s*<TemplateCustomizerPanel/);
    expect(builder).toContain('!rightPanelCollapsed && (!aiPanelOpen || Boolean(selectedObject))');
    expect(builder.match(/onToolsHostChange=\{setAIBuilderToolsHost\}/g)).toHaveLength(2);
    expect(builder.match(/onCustomizerHostChange=\{setAIBuilderCustomizerHost\}/g)).toHaveLength(2);
  });
});
