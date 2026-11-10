import { createRoot } from 'react-dom/client';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { readImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { VFSPreview } from '@/components/VFSPreview';

export async function mountProbe(entries: Array<{ path: string; b64: string }>) {
  const intake = await intakeLooseFiles(entries.map((e) => ({ path: e.path, bytes: Uint8Array.from(atob(e.b64), (c) => c.charCodeAt(0)) })));
  const profile = analyzeImportedProject(intake);
  const { files } = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'probe', importedAt: '2026-11-10T00:00:00Z' });
  document.body.innerHTML = '<div id="probe" style="height:900px"></div>';
  createRoot(document.getElementById('probe')!).render(<VFSPreview nodes={[]} files={files} activeFile="/index.html" forceBackend="sandpack" autoStart={false} showToolbar={false} />);
  return { framework: profile.framework, adapter: profile.previewAdapter.status, hasRecords: Boolean(readImportedSourceRecords(files)) };
}
