/** Read-only count of body-section origins (UPG-01 diagnostics); never a gate. */

const SECTION_VARIANT = /<section\b[^>]*\bdata-ut-variant\s*=\s*["']([^"']+)["']/g;

export function countSectionOrigins(
  files: Readonly<Record<string, string>>,
  pagePaths: readonly string[],
): { certified: number; custom: number } {
  const counts = { certified: 0, custom: 0 };
  for (const path of pagePaths) {
    for (const match of (files[path] ?? '').matchAll(SECTION_VARIANT)) {
      if (match[1].startsWith('custom:')) counts.custom += 1;
      else counts.certified += 1;
    }
  }
  return counts;
}
