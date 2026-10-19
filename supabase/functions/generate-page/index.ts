// A transport adapter, never a second author, renderer or canonical writer.
// CORS headers come from the shared assistant handler (same as ai-code-assistant).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleAssistant } from '../ai-code-assistant/handler.ts';

serve((req: Request) => handleAssistant(req, true));
