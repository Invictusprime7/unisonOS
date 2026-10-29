/**
 * The production Gemini model for every text-generation Edge Function.
 * Keep the managed gateway separate from Gemini model versioning.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_GATEWAY_MODEL = `google/${DEFAULT_GEMINI_MODEL}`;

export function configuredGeminiModel(readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)): string {
  return (readEnv('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL).replace(/^google\//, '');
}

export function configuredComposerGeminiModel(readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)): string {
  return (readEnv('GEMINI_COMPOSER_MODEL')?.trim() || DEFAULT_GEMINI_MODEL).replace(/^google\//, '');
}
