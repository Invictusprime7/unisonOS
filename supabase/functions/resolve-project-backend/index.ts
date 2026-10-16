import { serve } from 'serve';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { authError, verifyAuth } from '../_shared/auth.ts';
import { decryptConnectedProjectSecret } from '../_shared/connectedProjectCrypto.ts';
import { isValidUUID, safeParseBody } from '../_shared/validate.ts';

type BackendDescriptor = {
  bindingId: string;
  projectId: string;
  siteId: string | null;
  mode: 'shared-legacy' | 'dedicated';
  provider: 'supabase';
  status: 'ready' | 'provisioning' | 'failed';
  projectUrl?: string | null;
  publishableKey?: string | null;
};

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, cors);
  if (preflight) return preflight;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

  const auth = await verifyAuth(req);
  if (!auth.user) return authError(auth.error ?? 'Please sign in.', auth.status, cors);
  const parsed = await safeParseBody<Record<string, unknown>>(req);
  const body = (parsed && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
  const projectId = String(body?.projectId ?? '');
  if (!isValidUUID(projectId)) return json({ success: false, error: 'A valid projectId is required.' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ success: false, error: 'Backend resolution is unavailable.' }, 503);

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') ?? '' } },
  });
  const { data: raw, error: resolveError } = await userClient.rpc('resolve_project_backend', { p_project_id: projectId });
  if (resolveError || !raw || typeof raw !== 'object') {
    return json({ success: false, error: resolveError?.message ?? 'Project backend could not be resolved.' }, 403);
  }

  const descriptor = raw as BackendDescriptor;
  if (descriptor.projectId !== projectId || !['shared-legacy', 'dedicated'].includes(descriptor.mode)) {
    return json({ success: false, error: 'Project backend identity is invalid.' }, 409);
  }
  if (descriptor.mode !== 'dedicated') return json({ success: true, data: descriptor });
  if (descriptor.status !== 'ready') return json({ success: true, data: descriptor });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: binding, error: bindingError } = await admin
    .from('connected_supabase_projects')
    .select('id, project_url, publishable_key_ciphertext, provisioning_status')
    .eq('id', descriptor.bindingId)
    .eq('unison_project_id', projectId)
    .maybeSingle();
  if (bindingError || !binding || binding.provisioning_status !== 'ready') {
    return json({ success: false, error: 'Project backend binding could not be verified.' }, 503);
  }

  const encryptionKey = Deno.env.get('CONNECTED_PROJECT_TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey || !binding.project_url || !binding.publishable_key_ciphertext) {
    return json({ success: false, error: 'Project backend public connection details are unavailable.' }, 503);
  }
  let publishableKey: string;
  try {
    publishableKey = await decryptConnectedProjectSecret(binding.publishable_key_ciphertext, encryptionKey);
  } catch {
    return json({ success: false, error: 'Project backend public connection details could not be decrypted.' }, 503);
  }

  return json({
    success: true,
    data: { ...descriptor, projectUrl: binding.project_url, publishableKey },
  });
});
