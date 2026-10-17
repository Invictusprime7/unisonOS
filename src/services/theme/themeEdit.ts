import { buildThemedIndexCss } from '@/components/onboarding/themePresetToIndexCss';
import { z } from 'zod';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { resolveArtDirectionPackId } from '@/sections/variants/artDirectionPacks';
import { projectResolvedArtDirection, readSealedArtDirection } from '@/sections/variants/resolvedArtDirection';
import { readThemeContract, buildThemeContract, buildThemeContractFiles, THEME_COLOR_TOKENS } from '@/platform/core/themeContract';
import { normalizeThemeTokenValue } from './themeValueNormalize';
import { isEditableThemeToken, readCompiledTokenValues, validateThemeTypography, isLegalThemeTokenValue, readThemeOverrides, serializeThemeOverrides, THEME_OVERRIDES_PATH, applyOverridesToCss } from './themeTokenOverrides';

export const themeEditSchema = z.object({
  version: z.literal('1.0'), snapshotId: z.string().min(1), revisionId: z.string().nullable(),
  // The theme lane may explicitly return null when it is changing tokens
  // inside the current preset rather than selecting a different preset.
  presetId: z.enum(['modern', 'editorial', 'futuristic', 'minimalist', 'bold', 'organic']).nullable().optional(),
  set: z.record(z.string(), z.string()).default({}), reset: z.array(z.string()).default([]),
}).strict();
export type ThemeEdit = z.infer<typeof themeEditSchema>;
export const THEME_FONT_CHOICES: string[] = [...new Set(THEME_PRESETS.flatMap(p => [p.typography.headingFont, p.typography.bodyFont]))];

export function isThemeOnlyRequest(prompt: string): boolean {
  prompt = prompt.replace(/\b(?:keep|preserve|leave|without changing)\b[^.!?]*(?=[.!?]|$)/gi, '');
  if (/\b(add|remove|delete|reorder|rewrite|replace|move)\b.{0,30}\b(section|page|text|copy|heading|headline|image|photo|gallery|form|navigation)\b|\b(layout|grid|columns|booking|checkout)\b/i.test(prompt)) return false;
  // Copy edits ("change the main heading to 'X'") are source edits, not restyles,
  // unless the request names a visual property of that text.
  const namesVisualProperty = /\b(font|typeface|typography|colou?r|palette|size|weight|bold|italic|serif|sans|gold|black|white|dark|light)\b/i.test(prompt);
  if (!namesVisualProperty && (
    /\b(change|update|edit|rename|set|make|say|reword)\b.{0,50}\b(heading|headline|title|text|copy|tagline|button|label|cta|subtitle|subheading|paragraph|wording)\b.{0,50}\b(to|into|read|say)\b/i.test(prompt)
    || /\b(to|read|say)\s*[:]?\s*["'“‘]/i.test(prompt)
  )) return false;
  return /\b(theme|palette|typography|font|typeface|appearance|aesthetic|style|headings?|colou?r|darker|lighter|contrast|rounder|corners|restyle)\b|\b(?:use|switch to|make it|make (?:the )?site)\s+(?:more\s+)?(?:bold|organic|modern|editorial|futuristic|minimal(?:ist)?)\b/i.test(prompt);
}

export function decodeThemeEdit(response: unknown): ThemeEdit {
  let value = response;
  if (value && typeof value === 'object' && 'content' in value) value = (value as { content: unknown }).content;
  if (typeof value === 'string') value = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  return themeEditSchema.parse(value);
}

export function prepareThemeEdit(files: Record<string, string>, snapshot: SiteBundleSnapshot, proposal: unknown, revisionId: string | null) {
  const edit = themeEditSchema.parse(proposal);
  // Edit policy: a theme edit is recomputed from the current files, so a
  // proposal from an older revision/snapshot is applied to the latest one.
  void revisionId;
  const presetId = edit.presetId ?? snapshot.meta.themePresetId ?? readThemeContract(files)?.themePresetId;
  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS.find((p) => p.id === 'modern') ?? THEME_PRESETS[0];
  if (!preset) throw new Error('No theme presets are available.');
  const packId = edit.presetId ? resolveArtDirectionPackId({ themePresetId: preset.id, seed: snapshot.meta.designIntervention?.seed ?? snapshot.meta.renderHash ?? preset.id }) : (readSealedArtDirection(snapshot.meta)?.storagePackId ?? snapshot.meta.artDirectionPackId);
  const contract = buildThemeContract({ themePresetId: preset.id, artDirectionPackId: packId });
  const overrides = edit.presetId ? {} : readThemeOverrides(files);
  for (const name of edit.reset) {
    if (!contract.tokenNames.includes(name) || !isEditableThemeToken(name)) continue;
    delete overrides[name];
  }
  const knownFonts = THEME_FONT_CHOICES;
  for (const [name, raw] of Object.entries(edit.set)) {
    let value = raw;
    if (name === '--font-heading' || name === '--font-body') {
      // Models often send a full stack ("'Playfair Display', serif") or a
      // differently-cased name; map it onto the supported font list.
      const families = raw.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
      const match = families.map(f => knownFonts.find(k => k.toLowerCase() === f)).find(Boolean)
        ?? families.map(f => knownFonts.find(k => k.toLowerCase().includes(f) || f.includes(k.toLowerCase()))).find(Boolean);
      if (!match) throw new Error(`That font isn't available for ${name === '--font-heading' ? 'headings' : 'body text'}. Choose one of: ${knownFonts.join(', ')}.`);
      value = match;
    }
    // Unknown tokens are skipped (advisory); values are normalized first.
    if (!contract.tokenNames.includes(name) || !isEditableThemeToken(name)) continue;
    value = normalizeThemeTokenValue(name, value, (THEME_COLOR_TOKENS as readonly string[]).includes(name));
    if (!isLegalThemeTokenValue(name, value, contract)) throw new Error(`I couldn't read "${raw}" as a value for ${name}. Try a color like #1f6f4a or a size like 12px.`);
    overrides[name] = value.trim();
  }
  validateThemeTypography({ ...readCompiledTokenValues(edit.presetId ? buildThemedIndexCss(preset) : files['/src/index.css'] ?? ''), ...overrides });
  const themeTokens = edit.presetId ? themePresetToThemeTokens(preset) : snapshot.themeTokens;
  const intervention = snapshot.meta.designIntervention ? { ...snapshot.meta.designIntervention, themePresetId: preset.id, artDirectionPackId: contract.artDirectionPackId } : undefined;
  const artDirection = projectResolvedArtDirection({ ...(intervention ?? {}), themePresetId: preset.id, artDirectionPackId: contract.artDirectionPackId });
  const next = { ...snapshot, themeTokens, ...(snapshot.appContext ? { appContext: { ...snapshot.appContext, themePresetId: preset.id } } : {}), meta: { ...snapshot.meta, themeStyleVersion: '2.0' as const, themePresetId: preset.id, selectedThemeId: preset.id, artDirectionPackId: contract.artDirectionPackId, artDirection, ...(snapshot.meta.themeInjection ? { themeInjection: { ...snapshot.meta.themeInjection, presetId: preset.id } } : {}), ...(intervention ? { designIntervention: intervention } : {}) } };
  const nextFiles = { ...files, ...buildThemeContractFiles({ themePresetId: preset.id, artDirectionPackId: contract.artDirectionPackId }), [THEME_OVERRIDES_PATH]: serializeThemeOverrides(overrides) };
  // The live preview renders /src/index.css, so the edit must land there in the
  // same candidate — the override map alone is never read by the runtime.
  if (edit.presetId) {
    nextFiles['/src/index.css'] = applyOverridesToCss(buildThemedIndexCss(preset), overrides);
  } else if (typeof files['/src/index.css'] === 'string') {
    nextFiles['/src/index.css'] = applyOverridesToCss(files['/src/index.css'], overrides);
  }
  if (intervention) nextFiles['/.unison/design-intervention.json'] = JSON.stringify(intervention, null, 2);
  nextFiles['/.unison/site-bundle-snapshot.json'] = JSON.stringify(next, null, 2);
  return { snapshot: next, files: nextFiles };
}

export function prepareThemeCorrection(files: Record<string, string>, snapshot: SiteBundleSnapshot, revisionId: string | null) {
  if (snapshot.meta.themeStyleVersion === '2.0') return { snapshot, files };
  const presetId = snapshot.meta.themePresetId ?? snapshot.appContext?.themePresetId ?? readThemeContract(files)?.themePresetId;
  // Without a persisted selection there is no authority to infer a replacement theme.
  if (!THEME_PRESETS.some(p => p.id === presetId)) return { snapshot, files };
  const corrected = prepareThemeEdit(files, snapshot, { version: '1.0', snapshotId: snapshot.snapshotId, revisionId, presetId, set: readThemeOverrides(files), reset: [] }, revisionId);
  corrected.snapshot.meta.themeStyleVersion = '2.0';
  corrected.files['/.unison/site-bundle-snapshot.json'] = JSON.stringify(corrected.snapshot, null, 2);
  return corrected;
}
