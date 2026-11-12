/**
 * Point-and-click editing for source projects. PREVIEW ONLY: the builder's
 * preview build gets the same source locators and selection bridge the
 * Unison preview uses, so a click maps to an exact line in the saved file.
 * Saved bytes, page checks for publishing and published builds never see this.
 */
import { injectPreviewSourceLocators, PREVIEW_SELECTION_BRIDGE } from '@/utils/sandpackFilePrep';

const JSX_SOURCE = /\.(jsx|tsx)$/;

/** Copies `files` with locator attributes on every intrinsic JSX element; React/Preact projects only. */
export function instrumentSourceForSelection(files: Record<string, string>, revisionId?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    out[path] = JSX_SOURCE.test(path) && !path.includes('/node_modules/') && typeof text === 'string'
      ? injectPreviewSourceLocators(text, path, revisionId ?? null)
      : text;
  }
  return out;
}

let bridgeScript: Promise<string> | null = null;

/** The selection bridge compiled to plain script for the sealed runtime frame. */
export function selectionBridgeScript(): Promise<string> {
  bridgeScript ??= import('typescript').then(({ default: ts }) => ts.transpileModule(
    `${PREVIEW_SELECTION_BRIDGE}\n__initUnisonPreviewSelectionBridge();`,
    { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.None } },
  ).outputText).catch((error) => { bridgeScript = null; throw error; });
  return bridgeScript;
}
