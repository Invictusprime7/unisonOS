import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { intakeZipArchive } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { readImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { ImportedSourceRuntimeFrame } from '@/components/import/ImportedSourceRuntimeFrame';
import { describeSelection } from '@/services/editor/editableObjectDescriptor';
import { selectedSourceFinder } from '@/components/creatives/web-builder/selectedSourceMutation';
import { mutateJSXText, mutateJSXStyles } from '@/utils/jsxElementMutation';

const REV = 'rev-1';
function App() {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => { (async () => {
    const bytes = await (await fetch('/__h/aria.zip')).arrayBuffer();
    const intake = await intakeZipArchive(bytes, { name: 'aria.zip' });
    const profile = analyzeImportedProject(intake);
    const { files } = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' });
    (window as any).__files = files; setFiles(files);
  })(); }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data; if (!d?.type) return;
      if (d.type === 'EDIT_MODE_BRIDGE_READY') frame.current?.contentWindow?.postMessage({ type: 'EDIT_MODE_TOGGLE', enabled: true, activationKey: 0, revisionId: REV, siteId: null }, '*');
      if (d.type === 'ELEMENT_SELECTED') {
        const el = d.element; const a = el.scopeAncestors ?? {};
        const descriptor = describeSelection({ pagePath: a.pagePath || '/', sectionId: a.sectionId ?? null, resourceMark: null, sourceLocator: a.sourceLocator ?? null, instanceIndex: a.repeatIndex ?? null, revisionId: el.revisionId ?? null, sourceHash: a.sourceHash ?? null, astIdentity: a.astIdentity ?? null, sourceRevisionId: a.sourceRevisionId ?? null });
        const fs = (window as any).__files as Record<string, string>;
        const path = descriptor.sourceLocator?.split(':')[0] ?? '';
        const finder = selectedSourceFinder({ tagName: el.tagName, html: el.html, descriptor });
        const t = fs[path] ? mutateJSXText(fs[path], el.selector, 'CHANGED', finder) : null;
        const s = fs[path] ? mutateJSXStyles(fs[path], el.selector, { display: 'none' }, finder) : null;
        (window as any).__sel = { tag: el.tagName, selector: el.selector, scope: { pagePath: a.pagePath, sourceLocator: a.sourceLocator, sourceHash: a.sourceHash, astIdentity: a.astIdentity, sourceRevisionId: a.sourceRevisionId, repeatIndex: a.repeatIndex }, revisionId: el.revisionId, descriptor, hasFile: Boolean(fs[path]), textOk: Boolean(t), styleOk: Boolean(s) };
      }
      if (d.type === 'INLINE_TEXT_EDIT_COMMIT') (window as any).__inline = d;
    };
    window.addEventListener('message', on); return () => window.removeEventListener('message', on);
  }, []);
  if (!files) return <div>loading</div>;
  const records = readImportedSourceRecords(files)!;
  return <div style={{ height: '100vh' }}><ImportedSourceRuntimeFrame records={records} files={files} assetUrls={{}} adapter={records.profile.previewAdapter} editable revisionId={REV} onFrameChange={(f) => { frame.current = f; }} /></div>;
}
createRoot(document.getElementById('root')!).render(<App />);
