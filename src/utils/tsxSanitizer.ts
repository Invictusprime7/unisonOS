import { normalizeImageCompatibility } from '@/utils/imageCompatibility';
/**
 * tsxSanitizer.ts
 *
 * Hardening pipeline for AI-generated TSX/JSX files before they are written
 * into the VFS or rendered in the preview.
 *
 * Goals:
 *  - Strip prose / markdown leaks ("Here is your code…" + ```tsx fences).
 *  - Normalize JSX (void elements, style strings, hallucinated SVG namespaces).
 *  - Ensure required React imports for files that use hooks.
 *  - Detect grossly malformed files (unbalanced braces / parens / JSX tags)
 *    so the launcher can fall back to its deterministic seed instead of
 *    pushing a broken module into Sandpack.
 *
 * This module is intentionally dependency-free and safe to call from the
 * client (prompt-first launch, Monaco quick-fix action) and from the preview
 * compiler.
 */

import {
  extractCleanCode,
  ensureReactImports,
  fixJsxVoidElements,
  fixJsxStyleStrings,
  sanitizeSvgElements,
} from "@/utils/aiCodeCleaner";
import { getUnisonVfsFacadeImport } from "@/utils/sandpackDependencies";

export interface SanitizeResult {
  /** Normalized file content. Always a string. */
  code: string;
  /** True when the cleaned code passes structural balance checks. */
  valid: boolean;
  /** Human-readable issues encountered during sanitization. */
  issues: string[];
  /** Names of transforms that were applied. */
  applied: string[];
}

/** Files we never try to "fix" — they are not React modules. */
const NON_TSX_RE = /\.(css|json|md|svg|png|jpe?g|gif|webp|ico|txt)$/i;

/**
 * Lightweight structural validation. We do NOT run a real parser here —
 * Sandpack/esbuild will do that — but we catch the most common failure
 * shapes (unclosed braces / parens / fragments) cheaply so the launcher
 * can decide to fall back to its deterministic seed.
 */
export function validateTsxStructure(code: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!code || code.trim().length === 0) {
    return { valid: false, issues: ["empty file"] };
  }

  let brace = 0;
  let paren = 0;
  let bracket = 0;
  let inString: '"' | "'" | "`" | null = null;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const prev = code[i - 1];

    if (inLine) {
      if (c === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      if (c === "/" && prev === "*") inBlock = false;
      continue;
    }
    if (inString) {
      if (c === inString && prev !== "\\") inString = null;
      continue;
    }

    if (c === "/" && code[i + 1] === "/") {
      inLine = true;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      inBlock = true;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inString = c as '"' | "'" | "`";
      continue;
    }

    if (c === "{") brace++;
    else if (c === "}") brace--;
    else if (c === "(") paren++;
    else if (c === ")") paren--;
    else if (c === "[") bracket++;
    else if (c === "]") bracket--;

    if (brace < 0) {
      issues.push("extra '}'");
      break;
    }
    if (paren < 0) {
      issues.push("extra ')'");
      break;
    }
    if (bracket < 0) {
      issues.push("extra ']'");
      break;
    }
  }

  if (brace !== 0) issues.push(`unbalanced braces (${brace})`);
  if (paren !== 0) issues.push(`unbalanced parens (${paren})`);
  if (bracket !== 0) issues.push(`unbalanced brackets (${bracket})`);

  // Fragment balance: <> ... </>
  const openFrag = (code.match(/<>/g) || []).length;
  const closeFrag = (code.match(/<\/>/g) || []).length;
  if (openFrag !== closeFrag) {
    issues.push(`unbalanced fragments (<>:${openFrag} </>:${closeFrag})`);
  }

  // Component must export something renderable
  if (!/export\s+(default|const|function)/.test(code)) {
    issues.push("no export statement");
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Cheap brace balance counter (string/comment aware). Positive = missing closes.
 */
export function countBraceBalance(code: string): number {
  let brace = 0;
  let inString: '"' | "'" | "`" | null = null;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const prev = code[i - 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (c === "/" && prev === "*") inBlock = false; continue; }
    if (inString) { if (c === inString && prev !== "\\") inString = null; continue; }
    if (c === "/" && code[i + 1] === "/") { inLine = true; continue; }
    if (c === "/" && code[i + 1] === "*") { inBlock = true; continue; }
    if (c === '"' || c === "'" || c === "`") { inString = c as '"' | "'" | "`"; continue; }
    if (c === "{") brace++;
    else if (c === "}") brace--;
  }
  return brace;
}

/**
 * Run the full hardening pipeline on a single file.
 *
 * Safe defaults:
 *  - non-TSX/JSX files pass through untouched.
 *  - if any transform throws, we return the original code with valid=false.
 */
export function sanitizeTsxFile(path: string, raw: string): SanitizeResult {
  const applied: string[] = [];
  const issues: string[] = [];

  if (typeof raw !== "string") {
    return { code: "", valid: false, issues: ["non-string content"], applied };
  }

  // Pass-through for non-React files
  if (NON_TSX_RE.test(path)) {
    return { code: raw, valid: true, issues, applied };
  }

  let code = raw;

  try {
    const cleaned = extractCleanCode(code);
    if (cleaned && cleaned !== code) {
      code = cleaned;
      applied.push("extractCleanCode");
    } else if (!cleaned) {
      issues.push("AI returned prose-only content");
      return { code: "", valid: false, issues, applied };
    }
  } catch (e) {
    issues.push(`extractCleanCode failed: ${(e as Error).message}`);
  }

  try {
    const next = sanitizeSvgElements(code);
    if (next !== code) {
      code = next;
      applied.push("sanitizeSvgElements");
    }
  } catch (e) {
    issues.push(`sanitizeSvgElements failed: ${(e as Error).message}`);
  }

  try {
    const next = fixJsxVoidElements(code);
    if (next !== code) {
      code = next;
      applied.push("fixJsxVoidElements");
    }
  } catch (e) {
    issues.push(`fixJsxVoidElements failed: ${(e as Error).message}`);
  }

  try {
    const next = fixJsxStyleStrings(code);
    if (next !== code) {
      code = next;
      applied.push("fixJsxStyleStrings");
    }
  } catch (e) {
    issues.push(`fixJsxStyleStrings failed: ${(e as Error).message}`);
  }

  // Strip stray module.exports leaks
  if (/\bmodule\.exports\b/.test(code)) {
    code = code.replace(/\bmodule\.exports\s*=\s*\{[\s\S]*?\n\};?\s*/g, "");
    applied.push("stripModuleExports");
  }

  // Strip leading "Here's…" prose lines that survived extractCleanCode
  code = code.replace(/^(?:\s*\/\/[^\n]*\n)*\s*(?:Here(?:'s| is)|Sure|Below|This is)\b[^\n]*\n/i, "");

  const imageCompatibility = normalizeImageCompatibility(code, path);
  if (imageCompatibility.code !== code) applied.push('normalizeNextImage');
  code = imageCompatibility.code;
  issues.push(...imageCompatibility.issues);

  // Generated snapshots own the UI runtime facade modules. Normalize common
  // model imports here so every Lane B response uses the same executable VFS
  // contract while leaving unrelated packages untouched.
  try {
    const rewriteFacadeSpecifier = (full: string, prefix: string, specifier: string, suffix: string) => {
      const facade = getUnisonVfsFacadeImport(specifier);
      return facade ? `${prefix}${facade}${suffix}` : full;
    };
    const next = code
      .replace(
        /(\b(?:import|export)\s+(?:type\s+)?(?:[\w*{},\s]+?\s+from\s+)?['"])([^'"]+)(['"])/g,
        rewriteFacadeSpecifier,
      )
      .replace(
        /(\bimport\s*\(\s*['"])([^'"]+)(['"]\s*\))/g,
        rewriteFacadeSpecifier,
      );
    if (next !== code) {
      code = next;
      applied.push('rewriteUnisonVfsImports');
    }
  } catch (e) {
    issues.push(`rewriteUnisonVfsImports failed: ${(e as Error).message}`);
  }

  // Replace FontAwesome <i class="fab fa-…"> stubs with lucide-react components.
  // Preview ships only lucide-react; FA classes render as blank squares.
  try {
    const FA_MAP: Record<string, string> = {
      "fa-instagram": "Instagram", "fa-facebook": "Facebook", "fa-facebook-f": "Facebook",
      "fa-twitter": "Twitter", "fa-x-twitter": "Twitter", "fa-linkedin": "Linkedin",
      "fa-linkedin-in": "Linkedin", "fa-youtube": "Youtube", "fa-tiktok": "Music",
      "fa-github": "Github", "fa-pinterest": "Bookmark", "fa-whatsapp": "MessageCircle",
      "fa-envelope": "Mail", "fa-phone": "Phone", "fa-map-marker": "MapPin",
      "fa-map-marker-alt": "MapPin", "fa-location-dot": "MapPin",
      "fa-star": "Star", "fa-heart": "Heart", "fa-check": "Check", "fa-arrow-right": "ArrowRight",
    };
    const replacedIcons = new Set<string>();
    const replacer = (_full: string, cls: string) => {
      const m = cls.match(/fa-[\w-]+/);
      const Icon = (m && FA_MAP[m[0]]) || "Circle";
      replacedIcons.add(Icon);
      return `<${Icon} className="w-5 h-5" aria-hidden="true" />`;
    };
    let next = code.replace(
      /<i\s+className=(?:"|')([^"']*\bfa[brs]?\s+fa-[\w-]+[^"']*)(?:"|')[^>]*\/?>(?:\s*<\/i>)?/g,
      replacer,
    );
    next = next.replace(
      /<i\s+class=(?:"|')([^"']*\bfa[brs]?\s+fa-[\w-]+[^"']*)(?:"|')[^>]*\/?>(?:\s*<\/i>)?/g,
      replacer,
    );
    if (replacedIcons.size > 0 && next !== code) {
      const needed = Array.from(replacedIcons);
      const importRe = /import\s+\{([^}]*)\}\s+from\s+['"](?:lucide-react|@\/unison\/ui\/icons)['"]\s*;?/;
      if (importRe.test(next)) {
        next = next.replace(importRe, (_m, group: string) => {
          const existing = group.split(",").map((s) => s.trim()).filter(Boolean);
          const merged = Array.from(new Set([...existing, ...needed])).sort();
          return `import { ${merged.join(", ")} } from "@/unison/ui/icons";`;
        });
      } else {
        next = `import { ${needed.sort().join(", ")} } from "@/unison/ui/icons";\n` + next;
      }
      code = next;
      applied.push(`replaceFontAwesomeIcons(${needed.length})`);
    }
  } catch (e) {
    issues.push(`replaceFontAwesomeIcons failed: ${(e as Error).message}`);
  }

  // Repair an `export default Foo;` that landed inside a JSX block / function body
  // (the exact failure shape we saw with Navbar.tsx). Pull the orphan export
  // out and drop it onto its own top-level line at EOF.
  try {
    const exportMatch = code.match(/^([ \t]+)(export\s+default\s+([A-Za-z_$][\w$]*)\s*;?)\s*$/m);
    if (exportMatch) {
      const [full, , , name] = exportMatch;
      code = code.replace(full, "");
      code = code.replace(/\s*$/, "") + `\n\nexport default ${name};\n`;
      applied.push("liftOrphanDefaultExport");
    }
  } catch (e) {
    issues.push(`liftOrphanDefaultExport failed: ${(e as Error).message}`);
  }

  // Strip self-referential re-exports the AI sometimes hallucinates after a
  // default-exported component, e.g. `export const Services = Services;` which
  // crashes Babel with "Identifier 'X' has already been declared".
  try {
    const selfExportRe = /^[ \t]*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\1\s*;?\s*$/gm;
    if (selfExportRe.test(code)) {
      code = code.replace(selfExportRe, "");
      applied.push("stripSelfReferentialExport");
    }
    // Also handle duplicate `export default X` after another `export default X`
    const defaultMatches = [...code.matchAll(/^[ \t]*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/gm)];
    if (defaultMatches.length > 1) {
      const seen = new Set<string>();
      code = code.replace(/^[ \t]*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/gm, (m, name) => {
        if (seen.has(name)) return "";
        seen.add(name);
        return m;
      });
      applied.push("dedupeDefaultExport");
    }

    // Strip imports that collide with a top-level declaration of the same
    // name (e.g. `import App from './pages/App.tsx'` followed by
    // `export default function App()`). Babel hard-fails with "Identifier
    // 'X' has already been declared" before we ever reach the preview.
    const declaredNames = new Set<string>();
    const declRe = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm;
    const constRe = /^[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;
    for (const m of code.matchAll(declRe)) declaredNames.add(m[1]);
    for (const m of code.matchAll(constRe)) declaredNames.add(m[1]);

    if (declaredNames.size > 0) {
      const before = code;
      // Default imports: `import Name from '...'`
      code = code.replace(
        /^[ \t]*import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+['"]\s*;?\s*$\n?/gm,
        (full, name) => (declaredNames.has(name) ? "" : full),
      );
      // Named imports inside `{ ... }` — drop just the colliding specifier.
      code = code.replace(
        /^([ \t]*import\s*\{)([^}]+)(\}\s*from\s*['"][^'"]+['"]\s*;?\s*)$/gm,
        (_full, head, body, tail) => {
          const kept = body
            .split(",")
            .map((s: string) => s.trim())
            .filter((s: string) => {
              if (!s) return false;
              const local = s.split(/\s+as\s+/i).pop()!.trim();
              return !declaredNames.has(local);
            });
          if (kept.length === 0) return "";
          return `${head} ${kept.join(", ")} ${tail}`;
        },
      );
      if (code !== before) applied.push("stripCollidingImports");
    }
  } catch (e) {
    issues.push(`stripSelfReferentialExport failed: ${(e as Error).message}`);
  }

  // Append missing closing braces if balance is off by a small positive amount.
  // This avoids Babel crashing with read-only SyntaxError on `e.message =` assignment
  // and lets the in-editor parser surface a real diagnostic instead.
  try {
    const balance = countBraceBalance(code);
    if (balance > 0 && balance <= 3) {
      code = code.replace(/\s*$/, "") + "\n" + "}".repeat(balance) + "\n";
      applied.push(`appendMissingBraces(${balance})`);
    }
  } catch (e) {
    issues.push(`braceRepair failed: ${(e as Error).message}`);
  }

  // Force React + hook imports last so we don't lose them to other transforms
  try {
    const next = ensureReactImports(code);
    if (next !== code) {
      code = next;
      applied.push("ensureReactImports");
    }
  } catch (e) {
    issues.push(`ensureReactImports failed: ${(e as Error).message}`);
  }

  const validation = validateTsxStructure(code);
  return {
    code,
    valid: validation.valid && imageCompatibility.issues.length === 0,
    issues: [...issues, ...validation.issues],
    applied,
  };
}

/**
 * Sanitize a multi-file map (path → contents). Files that fail validation are
 * reported in `invalidFiles`; the launcher should treat those as candidates
 * for fallback to its deterministic seed.
 */
export function sanitizeGeneratedFiles(
  files: Record<string, string>
): {
  files: Record<string, string>;
  invalidFiles: string[];
  report: Record<string, SanitizeResult>;
} {
  const out: Record<string, string> = {};
  const report: Record<string, SanitizeResult> = {};
  const invalidFiles: string[] = [];

  for (const [path, raw] of Object.entries(files || {})) {
    const result = sanitizeTsxFile(path, raw);
    report[path] = result;
    if (!result.valid && /\.(t|j)sx?$/.test(path)) {
      invalidFiles.push(path);
      // Still write the cleaned code — preview compiler will surface the
      // syntax error in the editor; the launcher can override entry files.
    }
    out[path] = result.code || raw;
  }

  return { files: out, invalidFiles, report };
}
