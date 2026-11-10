import { CheckCircle2, CircleSlash, AlertTriangle, FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportedSourceRecords, VerificationState } from '@/services/import/importedSourceRecords';

const FRAMEWORK_LABEL: Record<string, string> = {
  'tanstack-start': 'TanStack Start',
  next: 'Next.js',
  remix: 'Remix',
  'react-router-framework': 'React Router',
  astro: 'Astro',
  sveltekit: 'SvelteKit',
  nuxt: 'Nuxt',
  'vue-vite': 'Vue + Vite',
  'vite-react': 'React + Vite',
  'create-react-app': 'Create React App',
  'static-html': 'HTML site',
  'react-source-only': 'React source files',
  unknown: 'Unrecognized project type',
};

function StateIcon({ state }: { state: VerificationState | 'supported' | 'blocked' }) {
  if (state === 'verified' || state === 'supported' || state === 'not-applicable') return <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />;
  if (state === 'partial' || state === 'unverified') return <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  return <CircleSlash className="h-4 w-4 shrink-0 text-destructive" aria-hidden />;
}

/**
 * Truthful preview surface for externally imported projects. It never renders
 * a transformed version of the design; it reports what is preserved and what
 * still blocks a faithful preview and publishing.
 */
export function ImportedSourcePreviewStatus({ records, className }: { records: ImportedSourceRecords; className?: string }) {
  const { provenance, profile, manifest, assets } = records;
  const r = provenance.readiness;
  const framework = FRAMEWORK_LABEL[profile.framework] ?? profile.framework;
  const storedAssets = assets.assets.filter((a) => a.status === 'stored').length;
  const pageRoutes = profile.routing.routes.filter((route) => route.kind === 'page');
  const rows: Array<{ label: string; state: VerificationState | 'supported' | 'blocked'; detail: string }> = [
    { label: 'Original code kept', state: r.sourcePreserved, detail: `${manifest.files.filter((f) => f.storage === 'text').length} files saved exactly as uploaded` },
    {
      label: 'Images, fonts and media kept',
      state: r.assetsPreserved,
      detail: assets.assets.length === 0 ? 'None in this project' : `${storedAssets} of ${assets.assets.length} stored unchanged`,
    },
    { label: 'Can run here', state: r.runtimeCompatibility, detail: r.runtimeCompatibility === 'supported' ? `${framework} supported` : `${framework} needs ${profile.previewAdapter.requires.join(', ')}` },
    { label: 'Preview shown', state: r.previewRendered, detail: r.previewRendered === 'blocked' ? 'Off, so a different design is never shown' : 'Not checked yet' },
    { label: 'Matches the original', state: r.visualParity, detail: 'Not compared yet' },
    { label: 'Ready to publish', state: r.publishReady ? 'verified' : 'blocked', detail: r.publishReady ? 'Ready' : 'Blocked until the preview matches the original' },
  ];

  return (
    <div
      data-unison-imported-source-preview="true"
      data-import-framework={profile.framework}
      className={cn('flex h-full flex-col overflow-auto rounded-lg border border-border bg-background', className)}
    >
      <div className="mx-auto w-full max-w-xl space-y-5 p-6">
        <div className="flex items-start gap-3">
          <FileCode2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Imported {framework} project</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{profile.previewAdapter.reason}</p>
          </div>
        </div>

        <ul className="divide-y divide-border rounded-md border border-border" aria-label="Import status">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-3 px-3 py-2.5">
              <StateIcon state={row.state} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Pages found</dt>
            <dd className="text-foreground">{pageRoutes.length > 0 ? pageRoutes.slice(0, 8).map((route) => route.path).join(', ') + (pageRoutes.length > 8 ? '…' : '') : 'None detected'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fonts</dt>
            <dd className="text-foreground">{profile.styles.fontFamilies.length > 0 ? profile.styles.fontFamilies.slice(0, 6).join(', ') : 'None detected'}</dd>
          </div>
          {profile.envNames.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Settings it expects (values were not imported)</dt>
              <dd className="break-words text-foreground">{profile.envNames.join(', ')}</dd>
            </div>
          )}
          {profile.serverCapabilities.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Server features</dt>
              <dd className="text-foreground">{profile.serverCapabilities.join(', ')}</dd>
            </div>
          )}
        </dl>

        <p className="text-xs leading-relaxed text-muted-foreground">
          You can still open and edit the files, and ask Affinity for changes to specific files. Every change is saved as a new version and can be undone.
        </p>
      </div>
    </div>
  );
}
