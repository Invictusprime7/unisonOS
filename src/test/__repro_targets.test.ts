import { it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { sourceProjectEditTargets } from '@/services/source-authoring/sourceProjectEditTargets';
import { selectSourceKnowledgeWithReport } from '@/services/builder/sourceKnowledgeContext';
function walk(d: string, base = d, out: Record<string,string> = {}) {
  for (const n of readdirSync(d)) { if (n==='node_modules'||n==='.git') continue; const p = join(d,n);
    if (statSync(p).isDirectory()) walk(p, base, out); else if (/\.(tsx?|jsx?|css|json|html)$/.test(n)) out['/'+p.slice(base.length+1)] = readFileSync(p,'utf8'); }
  return out;
}
it('targets', () => {
  const files = walk('/tmp/aria');
  const t = sourceProjectEditTargets(files, '/src/routes/index.tsx');
  const total = t.reduce((s,p)=>s+files[p].length,0);
  console.log('targets', t.length, 'chars', total);
  console.log(t.map(p=>`${p} ${files[p].length}`).join('\n'));
  const r = selectSourceKnowledgeWithReport(files, t, 240_000, { scoped: true });
  console.log('complete', r.completeTargets, 'omitted', r.omitted.map(o=>o.path));
});
