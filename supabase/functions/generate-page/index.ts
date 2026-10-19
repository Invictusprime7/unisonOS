// A transport adapter, never a second author, renderer or canonical writer.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { handleAssistant } from '../ai-code-assistant/handler.ts';

serve(async (req: Request) => {
  const response = await handleAssistant(req, true);
  return new Response(response.body, {
    status: response.status,
    headers: { ...corsHeaders, ...Object.fromEntries(response.headers.entries()) },
  });
});