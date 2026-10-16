import { serve } from 'serve';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { handleCorsPreflightRequest, publicCorsHeaders } from '../_shared/cors.ts';
import { decryptConnectedProjectSecret } from '../_shared/connectedProjectCrypto.ts';
import { isValidUUID, safeParseBody } from '../_shared/validate.ts';

type PublishedBackendDescriptor = {
  projectId: string;
  siteId: string | null;
  mode: 'shared-legacy' | 'dedicated';
  status: 'ready' | 'provisioning' | 'failed';
  projectUrl: string | null;
  publishableKey: string | null;
};

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) return preflight;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...publicCorsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);

  const parsed = await safeParseBody<Record<string, unknown>>(req);
  const body = (parsed && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
  const projectId = String(body?.projectId ?? '');
  if (!isValidUUID(projectId)) return json({ success: false, error: 'A valid projectId is required.' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ success: false, error: 'Published backend resolution is unavailable.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: raw, error: resolveError } = await admin.rpc('resolve_published_site_backend', { p_project_id: projectId });
  if (resolveError || !raw || typeof raw !== 'object') {
    return json({ success: false, error: 'Published site backend could not be resolved.' }, 404);
  }

  const descriptor = raw as PublishedBackendDescriptor;
  if (descriptor.projectId !== projectId || !['shared-legacy', 'dedicated'].includes(descriptor.mode)) {
    return json({ success: false, error: 'Published site backend identity is invalid.' }, 409);
  }
  if (descriptor.mode !== 'dedicated') return json({ success: true, data: descriptor });
  if (descriptor.status !== 'ready') {
    return json({ success: false, error: 'Published site backend is not ready.' }, 503);
  }

  const { data: binding, error: bindingError } = await admin
    .from('connected_supabase_projects')
    .select('project_url, publishable_key_ciphertext, provisioning_status')
    .eq('unison_project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bindingError || !binding || binding.provisioning_status !== 'ready') {
    return json({ success: false, error: 'Published site backend binding could not be verified.' }, 503);
  }

  const encryptionKey = Deno.env.get('CONNECTED_PROJECT_TOKEN_ENCRYPTION_KEY');
  if (!encryptionKey || !binding.project_url || !binding.publishable_key_ciphertext) {
    return json({ success: false, error: 'Published site backend public connection details are unavailable.' }, 503);
  }
  let publishableKey: string;
  try {
    publishableKey = await decryptConnectedProjectSecret(binding.publishable_key_ciphertext, encryptionKey);
  } catch {
    return json({ success: false, error: 'Published site backend public connection details could not be decrypted.' }, 503);
  }

  return json({
    success: true,
    data: { ...descriptor, projectUrl: binding.project_url, publishableKey },
  });
});
