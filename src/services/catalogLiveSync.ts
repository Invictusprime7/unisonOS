/**
 * Live catalog sync: subscribes to saved-record changes for one business and
 * forwards each as the existing RESOURCE_INVALIDATED signal, so the preview,
 * other open builder tabs and panels refresh within a second of any save
 * (toolbar, Assets panel, AI, another device). Realtime delivery is filtered
 * by the tables' own RLS, so only rows the signed-in member may read arrive.
 */
import { supabase } from '@/integrations/supabase/client';
import { refreshDataOperationResources } from '@/services/dataOperationRefresh';

export const LIVE_CATALOG_TABLES = [
  'products', 'services', 'menu_items', 'pricing_plans',
  'featured_offers', 'testimonials', 'portfolio_projects', 'content_entries',
] as const;

export function startCatalogLiveSync(input: { businessId: string; projectId?: string | null }): () => void {
  let seq = 0;
  let channel = supabase.channel(`catalog-live:${input.businessId}`);
  for (const table of LIVE_CATALOG_TABLES) {
    channel = channel.on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter: `business_id=eq.${input.businessId}` },
      (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
        const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
        refreshDataOperationResources({
          projectId: input.projectId ?? null,
          businessId: input.businessId,
          results: [{
            operationId: `live:${table}:${++seq}`,
            status: 'applied',
            surfaceId: table,
            sourceTable: table,
            rowId: row?.id != null ? String(row.id) : undefined,
          }],
        });
      },
    );
  }
  channel.subscribe();
  return () => { void supabase.removeChannel(channel); };
}
