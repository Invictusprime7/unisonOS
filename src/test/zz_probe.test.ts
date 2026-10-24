import { it, vi } from 'vitest';
const seen: unknown[] = [];
vi.mock('@/services/builderBrainClient', async () => ({ ...(await vi.importActual<any>('@/services/builderBrainClient')), runBuilderTurn: async (req: unknown) => { seen.push(req); throw new Error('stop'); } }));
vi.mock('@/marketplace/materializePreviewImages', () => ({ materializePreviewImages: async (f: any) => f }));
import { aiComposerRequestSchema } from '@/contracts/aiComposerContract';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';
import { buildConceptDraftSource } from '@/marketplace/conceptDraftSource';
import { materializeTemplateWithAppBuilder } from '@/marketplace/materializeTemplateWithAppBuilder';
it('probe', async () => {
  const t = AUTHORED_MARKETPLACE_TEMPLATES.find(x => x.id === 'aster-skin-studio')!;
  try { await materializeTemplateWithAppBuilder(buildConceptDraftSource(t) as any, { projectId: 'p', businessId: 'b', siteId: 's', draftId: 'd', buildId: 'x', bundleId: 'y' }); } catch (e) { console.log('ERR', String(e).slice(0, 600)); }
  console.log('requests', seen.length);
  for (const r of seen.slice(0, 2)) { console.log(Object.keys(r as any)); const inner:any = (r as any).context ? JSON.parse((r as any).context) : (r as any).request ?? r; const p = aiComposerRequestSchema.safeParse(inner); if(!p.success) for (const [k,v] of Object.entries(inner.files??{})) if(String(v).length>60000) console.log("BIG",k,String(v).length); console.log("rt", inner.runtimeContext?.length, "brief", inner.brief?.length); console.log(p.success ? 'OK' : JSON.stringify(p.error.issues.map(i => [i.path.join('.'), i.message])).slice(0, 1500)); }
}, 120000);
