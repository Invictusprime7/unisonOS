import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTHORITATIVE_SUPABASE_URL, resolveSupabaseClientUrl, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/env';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Supabase backend identity', () => {
  const envSource = read('src/integrations/supabase/env.ts');
  const linkedRef = /project_id\s*=\s*"([a-z0-9]+)"/.exec(read('supabase/config.toml'))![1];
  const fallbackUrl = AUTHORITATIVE_SUPABASE_URL;
  const fallbackRef = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(fallbackUrl)![1];
  const fallbackKey = /'((?:eyJ|sb_publishable_)[^']+)'/.exec(envSource)![1];

  it('keeps the fallback URL on the project selected for this deployment', () => {
    expect(resolveSupabaseClientUrl(fallbackUrl, false, 'http://localhost:3000')).toBe(fallbackUrl);
    expect(resolveSupabaseClientUrl(fallbackUrl, true, 'http://localhost:3000')).toBe('http://localhost:3000/__supabase');
    expect(fallbackRef).toBe(linkedRef);
    if (fallbackKey.startsWith('eyJ')) {
      const payload = JSON.parse(Buffer.from(fallbackKey.split('.')[1], 'base64url').toString());
      expect(payload.ref).toBe(fallbackRef);
      expect(payload.role).toBe('anon');
    } else {
      expect(fallbackKey).toMatch(/^sb_publishable_/);
    }
  });

  it('keeps launch and deployment examples aligned with the same backend', () => {
    expect(SUPABASE_PUBLISHABLE_KEY).toBe(fallbackKey);
    expect(read('src/services/canonicalLaunchVfs.ts')).toContain('SUPABASE_REMOTE_URL');
    expect(read('vite.config.ts')).toContain(fallbackUrl);
    const vercelEnv = read('docs/vercel-env-setup.md');
    expect(vercelEnv).toContain('src/integrations/supabase/env.ts');
    expect(vercelEnv).toContain('.env.example');
    expect(vercelEnv).toContain('VITE_SUPABASE_URL');
    expect(vercelEnv).toContain('VITE_SUPABASE_PUBLISHABLE_KEY');
    expect(read('.env.example')).toContain(`VITE_SUPABASE_URL=${fallbackUrl}`);
    expect(read('.env.example')).toContain('VITE_SUPABASE_PUBLISHABLE_KEY=');
    expect(read('.env.example')).toContain(`VITE_SUPABASE_PROJECT_ID=${fallbackRef}`);
  });
});
