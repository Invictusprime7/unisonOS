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
  for (const r of seen.slice(0, 2)) { const p = aiComposerRequestSchema.safeParse(r); console.log(p.success ? 'OK' : JSON.stringify(p.error.issues.map(i => [i.path.join('.'), i.message])).slice(0, 1500)); }
}, 120000);
