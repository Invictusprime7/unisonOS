/**
 * THEME TOKEN EDITOR — contract-scoped token overrides in the builder.
 *
 * Reads the sealed theme contract out of the canonical VFS and lets the user
 * re-value tokens it already declares. Nothing here invents a token, writes a
 * literal into a page, or bypasses the commit path: edits leave as FileOps for
 * a `theme-change` PatchPlan.
 */

import { useEffect, useMemo, useState } from 'react';
import { Palette, RotateCcw, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { readThemeContract } from '@/platform/core/themeContract';
import {
  INDEX_CSS_PATH,
  buildThemeOverrideFileOps,
  isEditableThemeToken,
  isLegalThemeTokenValue,
  readCompiledTokenValues,
  readThemeOverrides,
  type ThemeTokenOverrides,
} from '@/services/theme/themeTokenOverrides';
import type { FileOp } from '@/types/patchPlan';

export interface ThemeTokenEditorPanelProps {
  vfsFiles: Record<string, string>;
  onCommitTokens: (ops: FileOp[], summary: string) => Promise<boolean> | boolean;
}

export default function ThemeTokenEditorPanel({
  vfsFiles,
  onCommitTokens,
}: ThemeTokenEditorPanelProps) {
  const contract = useMemo(() => readThemeContract(vfsFiles), [vfsFiles]);
  const persisted = useMemo(() => readThemeOverrides(vfsFiles), [vfsFiles]);
  const compiled = useMemo(
    () => readCompiledTokenValues(vfsFiles[INDEX_CSS_PATH] ?? ''),
    [vfsFiles],
  );

  const [draft, setDraft] = useState<ThemeTokenOverrides>(persisted);
  const persistedKey = JSON.stringify(persisted);
  useEffect(() => { setDraft(JSON.parse(persistedKey)); }, [persistedKey]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(persisted),
    [draft, persisted],
  );

  if (!contract) {
    return (
      <div className="p-4 text-[11px] text-muted-foreground">
        No sealed theme contract in this snapshot yet. Generate or open a wizard-launched
        site and the token editor becomes available.
      </div>
    );
  }

  const setToken = (name: string, value: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[name];
      else next[name] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const ops = buildThemeOverrideFileOps({ files: vfsFiles, overrides: draft });
      if (ops.length === 0) return;
      await onCommitTokens(ops, `Theme · ${Object.keys(draft).length} token override(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply theme values.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <Palette className="h-3 w-3 text-primary" />
            Theme tokens
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            {contract.artDirectionName} · sealed pack {contract.artDirectionPackId}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            disabled={Object.keys(draft).length === 0 || saving}
            onClick={() => setDraft({})}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Apply
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="px-3 py-2 text-xs text-destructive">{error}</p>}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {contract.groups.map((group) => (
            <section key={group.id} className="space-y-1.5">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h4>
              {group.tokens.filter(token => isEditableThemeToken(token.name)).map((token) => {
                const value = draft[token.name] ?? '';
                const invalid = value.length > 0 && !isLegalThemeTokenValue(token.name, value, contract);
                return (
                  <div key={token.name} className="grid grid-cols-[1fr_1.2fr] items-center gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[10px]">{token.name}</div>
                      <div className="truncate text-[9px] text-muted-foreground">{token.role}</div>
                    </div>
                    <Input
                      value={value}
                      placeholder={compiled[token.name] ?? 'inherit from pack'}
                      onChange={(e) => setToken(token.name, e.target.value)}
                      className={`h-6 font-mono text-[10px] ${invalid ? 'border-destructive' : ''}`}
                      aria-label={`Override ${token.name}`}
                    />
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
