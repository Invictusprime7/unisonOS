import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { instrumentSourceForSelection } from '@/services/import/sourceBuild/previewInstrumentation';
import { selectedSourceFinder } from '@/components/creatives/web-builder/selectedSourceMutation';
import { mutateJSXStyles, mutateJSXText } from '@/utils/jsxElementMutation';
import { resolvePreviewSource, parseSourceLocator } from '@/services/editor/previewSourceResolver';

describe('repro', () => {
  it('aria h1', () => {
    const path = '/src/routes/index.tsx';
    const src = readFileSync('/tmp/aria/src/routes/index.tsx', 'utf8');
    const inst = instrumentSourceForSelection({ [path]: src }, 'rev-1')[path];
    const m = /<h1[^>]*data-ut-source-locator="([^"]+)" data-ut-source-ast="([^"]+)" data-ut-source-hash="([^"]+)" data-ut-source-revision="([^"]+)"/.exec(inst)!;
    console.log('locator', m?.[1]);
    const sel = { tagName: 'H1', html: '<h1 class="x">ARIA</h1>', descriptor: { sourceLocator: m[1], astIdentity: m[2], sourceHash: m[3], sourceRevisionId: m[4], revisionId: 'rev-1', instanceId: null } };
    console.log('parsed', parseSourceLocator(m[1]));
    console.log('resolve', JSON.stringify(resolvePreviewSource({ locator: m[1], files: { [path]: src }, sourceHash: m[3], astIdentity: m[2], sourceRevisionId: m[4], acceptedRevisionId: 'rev-1' })).slice(0, 600));
    const finder = selectedSourceFinder(sel);
    const selector = 'div > main > section:nth-of-type(1) > div:nth-of-type(2) > h1';
    const t = mutateJSXText(src, selector, 'ARIANN NORORI', finder);
    console.log('text ok', Boolean(t), t && t.includes('>ARIANN NORORI</h1>'));
    const s = mutateJSXStyles(src, selector, { display: 'none' }, finder);
    console.log('style ok', Boolean(s));
  });
});
