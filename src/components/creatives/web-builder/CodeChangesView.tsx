import { useEffect, useMemo, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { GitBranch, FileCode2 } from 'lucide-react';
import { computeFileStats } from '@/services/aiHistoryStore';

interface CodeChangesViewProps {
  beforeFiles: Record<string, string>;
  afterFiles: Record<string, string>;
  isLive: boolean;
}

function languageForPath(path: string): string {
  if (/\.tsx?$/.test(path)) return 'typescript';
  if (/\.jsx?$/.test(path)) return 'javascript';
  if (/\.css$/.test(path)) return 'css';
  if (/\.html?$/.test(path)) return 'html';
  if (/\.json$/.test(path)) return 'json';
  if (/\.ya?ml$/.test(path)) return 'yaml';
  return 'plaintext';
}

export function CodeChangesView({ beforeFiles, afterFiles, isLive }: CodeChangesViewProps) {
  const changes = useMemo(
    () => computeFileStats(beforeFiles, afterFiles),
    [beforeFiles, afterFiles],
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!changes.some((change) => change.path === selectedPath)) {
      setSelectedPath(changes[0]?.path ?? null);
    }
  }, [changes, selectedPath]);

  const selected = changes.find((change) => change.path === selectedPath) ?? changes[0];
  const added = changes.reduce((total, change) => total + change.added, 0);
  const removed = changes.reduce((total, change) => total + change.removed, 0);

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-white/[0.08] bg-[#0b0d12] text-white">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-white/[0.08] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <GitBranch className="h-4 w-4 shrink-0 text-cyan-300" />
          <h2 className="truncate text-sm font-semibold">Code changes</h2>
          <span className="text-xs text-white/45">{changes.length} {changes.length === 1 ? 'file' : 'files'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
          {isLive && <span className="flex items-center gap-1.5 text-cyan-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />Live</span>}
          <span className="text-emerald-300">+{added}</span>
          <span className="text-rose-300">-{removed}</span>
        </div>
      </header>

      {selected ? (
        <div className="flex min-h-0 flex-1">
          <nav aria-label="Changed files" className="w-56 shrink-0 overflow-y-auto border-r border-white/[0.08] py-2">
            {changes.map((change) => (
              <button
                key={change.path}
                type="button"
                onClick={() => setSelectedPath(change.path)}
                aria-current={selected.path === change.path ? 'true' : undefined}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${selected.path === change.path ? 'bg-cyan-400/10 text-white' : 'text-white/65 hover:bg-white/[0.04] hover:text-white'}`}
              >
                <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                <span className="min-w-0 flex-1">
                  <span className="block break-all text-xs leading-4">{change.path}</span>
                  <span className="mt-1 flex gap-2 text-[10px] tabular-nums">
                    <span className="text-emerald-300">+{change.added}</span>
                    <span className="text-rose-300">-{change.removed}</span>
                  </span>
                </span>
              </button>
            ))}
          </nav>

          <div className="min-h-0 min-w-0 flex-1">
            <div className="flex h-9 items-center border-b border-white/[0.08] px-3 text-xs text-white/60">
              <span className="truncate">{selected.path}</span>
              <span className="ml-auto pl-3 text-[10px] uppercase text-white/35">{selected.kind}</span>
            </div>
            <div className="h-[calc(100%-2.25rem)] min-h-0">
              <DiffEditor
                original={beforeFiles[selected.path] ?? ''}
                modified={afterFiles[selected.path] ?? ''}
                language={languageForPath(selected.path)}
                theme="vs-dark"
                height="100%"
                options={{
                  readOnly: true,
                  originalEditable: false,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  fontSize: 12,
                  renderOverviewRuler: false,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-white/45">
          <GitBranch className="h-5 w-5" />
          <p className="text-sm">{isLive ? 'Waiting for accepted changes' : 'No changes yet'}</p>
        </div>
      )}
    </section>
  );
}