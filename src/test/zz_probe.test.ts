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
  const r:any = seen[0]; const m = r.messages.at(-1).content; const inner:any = JSON.parse(typeof m==='string'?m:m[0].text);
  const p = aiComposerRequestSchema.safeParse(inner);
  console.log(p.success ? 'OK' : JSON.stringify(p.error.issues.map(i => [i.path.join('.'), i.message])).slice(0, 1500));
  for (const [k,v] of Object.entries(inner.files??{})) if(String(v).length>60000) console.log('BIG',k,String(v).length);
  console.log('rt', inner.runtimeContext?.length, 'brief', inner.brief?.length);
}, 120000);
