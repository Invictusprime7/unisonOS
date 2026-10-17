/**
 * Review Scope — enforces file-scoping for surgical/behavioral edits.
 * 
 * Ensures AI output only touches the resolved target file(s) and does not
 * silently regenerate the entire project.
 */

export interface ScopeCheckResult {
  /** Whether the patch stays within scope */
  inScope: boolean;
  /** Human-readable reason if out of scope */
  reason: string | null;
  /** Files that are outside the allowed scope */
  outOfScopeFiles: string[];
  /** Whether auto-apply should be blocked */
  blockAutoApply: boolean;
  /** Edit-policy advisories: reported to the user, never blocking. */
  advisories?: string[];
}

function normalizeVfsPath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

const IMPORT_PATTERN = /^\s*import\s[\s\S]*?;?$/gm;
const COMPONENT_DECLARATION_PATTERN = /(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g;
const JSX_TAG_PATTERN = /<\s*([A-Za-z][A-Za-z0-9_.-]*)\b/g;
const SIDE_EFFECT_TAGS = new Set([
  "form", "input", "textarea", "select", "option", "button", "dialog",
  "nav", "header", "footer", "section", "article", "aside", "table",
  "video", "audio", "iframe",
]);

function collectMatches(content: string, pattern: RegExp): Set<string> {
  return new Set([...content.matchAll(pattern)].map((match) => match[1]));
}

function promptAllows(prompt: string, token: string): boolean {
  const lower = prompt.toLowerCase();
  if (["form", "input", "textarea", "select", "option"].includes(token.toLowerCase())) {
    return /\b(form|contact|signup|sign up|register|checkout|booking|appointment|submit|field|input|textarea|select)\b/.test(lower);
  }
  if (token.toLowerCase() === "button") return /\b(button|cta|call to action|submit|action|form|contact|signup|checkout|booking)\b/.test(lower);
  if (/^[A-Z]/.test(token)) return /\b(add|create|introduce|new|component|form|widget|section|block)\b/.test(lower);
  return false;
}

function findUnrequestedScopedSideEffects(original: string, candidate: string, prompt: string): string[] {
  const reasons: string[] = [];
  const originalImports = new Set([...original.matchAll(IMPORT_PATTERN)].map((match) => match[0].trim()));
  const candidateImports = new Set([...candidate.matchAll(IMPORT_PATTERN)].map((match) => match[0].trim()));
  const addedImports = [...candidateImports].filter((value) => !originalImports.has(value));
  if (addedImports.length > 0 && !/\b(add|create|introduce|import|use|icon|motion|animate|form|button|component)\b/i.test(prompt)) {
    reasons.push(`new imports (${addedImports.length})`);
  }

  const originalTags = collectMatches(original, JSX_TAG_PATTERN);
  const candidateTags = collectMatches(candidate, JSX_TAG_PATTERN);
  for (const tag of [...candidateTags].filter((value) => !originalTags.has(value))) {
    const normalizedTag = tag.toLowerCase();
    if ((SIDE_EFFECT_TAGS.has(normalizedTag) || /^[A-Z]/.test(tag)) && !promptAllows(prompt, tag)) {
      reasons.push(`new <${tag}> element`);
    }
  }

  const originalDeclarations = collectMatches(original, COMPONENT_DECLARATION_PATTERN);
  const candidateDeclarations = collectMatches(candidate, COMPONENT_DECLARATION_PATTERN);
  for (const name of [...candidateDeclarations].filter((value) => !originalDeclarations.has(value))) {
    if (!promptAllows(prompt, name)) reasons.push(`new ${name} component`);
  }

  return [...new Set(reasons)];
}

export interface EditScopeInput {
  scopeType?: "element" | "block" | "section" | "page";
  componentPath?: string;
  editableRange?: { startLine?: number; endLine?: number };
  lockedBindings?: string[];
  riskLevel?: "low" | "medium" | "high";
}

/**
 * Check whether an AI-generated patch stays within the allowed scope
 * for a scoped edit (surgical, behavioral, single-file, etc.).
 */
export function checkEditScope(opts: {
  patchFiles: Record<string, string>;
  targetFile?: string | null;
  taskType: string;
  existingFiles?: string[];
  editScope?: EditScopeInput | null;
  originalFiles?: Record<string, string>;
  userPrompt?: string;
}): ScopeCheckResult {
  const { patchFiles, taskType, existingFiles = [], editScope, originalFiles = {}, userPrompt = "" } = opts;
  // editScope.componentPath overrides targetFile when present
  const targetFile = editScope?.componentPath || opts.targetFile;

  // Only enforce scope for scoped edit task types — or whenever an
  // explicit editScope was supplied by the floating preview toolbar.
  const SCOPED_TASKS = [
    "surgical_edit",
    "behavioral_edit",
    "single_file_edit",
  ];

  if (!editScope && !SCOPED_TASKS.includes(taskType)) {
    return { inScope: true, reason: null, outOfScopeFiles: [], blockAutoApply: false };
  }

  const patchPaths = Object.keys(patchFiles).map(normalizeVfsPath);
  // Edit policy: file counts and unrequested-looking additions are advisory.
  // Only missing targets, stubs, locked-binding removal and editable-range
  // violations (data-loss risks) block auto-apply.
  const advisories: string[] = [];

  // Rule 1: If we have a resolved target file, patch MUST include it
  if (targetFile) {
    const normTarget = normalizeVfsPath(targetFile);
    if (!patchPaths.includes(normTarget)) {
      return {
        inScope: false,
        reason: `Scoped edit resolved to ${normTarget} but AI did not update that file.`,
        outOfScopeFiles: patchPaths,
        blockAutoApply: true,
      };
    }
  }

  // Rule 2 (advisory): many touched files
  const MAX_SCOPED_FILES = 3;
  if (patchPaths.length > MAX_SCOPED_FILES) {
    advisories.push(`Edit touched ${patchPaths.length} files.`);
  }

  // Rule 3 (advisory): new files
  const newFiles = patchPaths.filter(
    (p) => !existingFiles.map(normalizeVfsPath).includes(p)
  );
  if (newFiles.length > 1) {
    advisories.push(`Edit created ${newFiles.length} new files.`);
  }

  // Rule 4: If target file exists, check that AI didn't replace it with a stub
  if (targetFile) {
    const normTarget = normalizeVfsPath(targetFile);
    const originalKey = Object.keys(patchFiles).find(
      (k) => normalizeVfsPath(k) === normTarget
    );
    if (originalKey) {
      const content = patchFiles[originalKey];
      if (content.length < 100) {
        return {
          inScope: false,
          reason: `Target file ${normTarget} reduced to ${content.length} chars — likely a stub.`,
          outOfScopeFiles: [],
          blockAutoApply: true,
        };
      }
    }

    const newKey = Object.keys(patchFiles).find((k) => normalizeVfsPath(k) === normTarget);
    const origKey = Object.keys(originalFiles).find((k) => normalizeVfsPath(k) === normTarget);
    const newContent = newKey ? patchFiles[newKey] : null;
    const origContent = origKey ? originalFiles[origKey] : null;
    if (newContent && origContent) {
      const sideEffects = findUnrequestedScopedSideEffects(origContent, newContent, userPrompt);
      // Additions are advisory unless the user explicitly narrowed the edit
      // ("only", "just"), which makes them a real scope breach.
      if (sideEffects.length > 0 && /\b(only|just)\b/i.test(userPrompt)) {
        return {
          inScope: false,
          reason: `Scoped edit introduced unrequested side effects: ${sideEffects.join(", ")}.`,
          outOfScopeFiles: [normTarget],
          blockAutoApply: true,
          advisories,
        };
      }
      if (sideEffects.length > 0) {
        advisories.push(`Edit also added: ${sideEffects.join(", ")}.`);
      }
    }
  }

  // ── editScope-specific enforcement (preview floating toolbar) ──────────
  if (editScope && targetFile) {
    const normTarget = normalizeVfsPath(targetFile);
    const newKey = Object.keys(patchFiles).find((k) => normalizeVfsPath(k) === normTarget);
    const origKey = Object.keys(originalFiles).find((k) => normalizeVfsPath(k) === normTarget);
    const newContent = newKey ? patchFiles[newKey] : null;
    const origContent = origKey ? originalFiles[origKey] : null;

    // Locked bindings must survive the edit
    if (newContent && origContent && editScope.lockedBindings?.length) {
      const missing = editScope.lockedBindings.filter((b) => {
        const needle = `data-ut-intent="${b}"`;
        if (!origContent.includes(needle) || newContent.includes(needle)) return false;
        // Removing a control the user explicitly asked about is intended.
        const label = b.split(".").pop() ?? b;
        return !(userPrompt.toLowerCase().includes(b.toLowerCase()) || (label.length > 3 && /\b(remove|delete|drop)\b/i.test(userPrompt) && userPrompt.toLowerCase().includes(label.toLowerCase())));
      });
      if (missing.length) {
        return {
          inScope: false,
          reason: `Edit removed locked intent bindings: ${missing.join(", ")}`,
          outOfScopeFiles: [normTarget],
          blockAutoApply: true,
        };
      }
    }

    // editableRange: lines outside the range must be byte-identical
    const range = editScope.editableRange;
    if (newContent && origContent && range && typeof range.startLine === "number" && typeof range.endLine === "number") {
      const origLines = origContent.split("\n");
      const newLines = newContent.split("\n");
      const before = origLines.slice(0, Math.max(0, range.startLine - 1)).join("\n");
      const after = origLines.slice(range.endLine).join("\n");
      const newBefore = newLines.slice(0, Math.max(0, range.startLine - 1)).join("\n");
      // We can't pin the exact end-line in the new file (line count may shift),
      // but we can require the prefix above startLine to match exactly.
      if (before !== newBefore) {
        return {
          inScope: false,
          reason: `Edit modified lines above editableRange.startLine (${range.startLine}).`,
          outOfScopeFiles: [normTarget],
          blockAutoApply: true,
        };
      }
      // Best-effort suffix match: align tail by length of `after`
      const tailLen = after.length;
      const newTail = newContent.slice(newContent.length - tailLen);
      if (tailLen > 0 && newTail !== after) {
        return {
          inScope: false,
          reason: `Edit modified content below editableRange.endLine (${range.endLine}).`,
          outOfScopeFiles: [normTarget],
          blockAutoApply: true,
        };
      }
    }
  }

  return { inScope: true, reason: null, outOfScopeFiles: [], blockAutoApply: false, advisories };
}
