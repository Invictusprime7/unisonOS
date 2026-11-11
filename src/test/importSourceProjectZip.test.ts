import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { importSourceProjectZip } from '@/services/export/importSourceProjectZip';
import { extractDependencies } from '@/utils/dependencyExtractor';

async function createProjectZip(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  const root = zip.folder('ariastudios');
  if (!root) throw new Error('Failed to create test archive');
  for (const [path, content] of Object.entries(entries)) root.file(path, content);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'ariastudios.zip', { type: 'application/zip' });
}

describe('importSourceProjectZip', () => {
  it('preserves imported source and makes declared runtime dependencies available to preview', async () => {
    const appSource = [
      "import { StudioGallery } from 'studio-gallery-kit';",
      "import './styles.css';",
      'export default function App() { return <StudioGallery />; }',
    ].join('\n');
    const styleSource = '@import url("https://fonts.googleapis.com/css2?family=DM+Sans");\n.hero { min-height: 100vh; display: grid; }';
    const imported = await importSourceProjectZip(await createProjectZip({
      'package.json': JSON.stringify({
        name: 'ariastudios',
        version: '1.2.3',
        scripts: { postinstall: 'do-not-preserve-imported-scripts' },
        dependencies: { 'studio-gallery-kit': '^2.4.0' },
        devDependencies: { vite: '^5.4.0' },
      }),
      'src/App.tsx': appSource,
      'src/main.tsx': "import App from './App'; export default App;",
      'src/styles.css': styleSource,
      'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;',
    }));

    expect(imported.vfsFiles['/src/App.tsx']).toBe(appSource);
    expect(imported.vfsFiles['/src/styles.css']).toBe(styleSource);

    const packageJson = JSON.parse(imported.vfsFiles['/package.json']);
    expect(packageJson.dependencies['studio-gallery-kit']).toBe('^2.4.0');
    expect(packageJson.dependencies.vite).toBe('^5.4.0');
    expect(packageJson.scripts).toBeUndefined();

    const extracted = extractDependencies(imported.vfsFiles);
    expect(extracted.dependencies['studio-gallery-kit']).toBe('^2.4.0');
  });
});