import { it } from 'vitest';
import { materializeAppBuilderSectionModelsWithDiagnostics } from '@/services/app-builder/appBuilderSectionModel';
it('dbg', () => {
  const impl = {
    'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar' },
    'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer' },
  };
  for (const imp of ['../project-components/MatchCentre', '@/project-components/MatchCentre']) {
  const page = `import Navbar from "@/unison/design-sources/Navbar";
import Footer from "@/unison/design-sources/Footer";
import MatchCentre from "${imp}";
export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{links:[]}} /></header><main><section data-ut-section-id="home:match-centre:0" data-ut-section-type="match-centre" data-ut-variant="custom:match-centre"><MatchCentre fixture="Ghana v Senegal" /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{links:[]}} /></footer></>}`;
  const r = materializeAppBuilderSectionModelsWithDiagnostics({ '/src/pages/Home.tsx': page, '/src/project-components/MatchCentre.tsx': 'export default function MatchCentre({ fixture }: { fixture: string }) {\n  return <article aria-label="Match centre"><h2>{fixture}</h2><p>Live</p></article>;\n}\n' }, [{ id: 'home', filePath: '/src/pages/Home.tsx' }], impl, { home: ['navbar:standard','footer:columns'] }, ['navbar:standard','footer:columns']);
  console.log(imp, JSON.stringify(r.diagnostics), r.files['/src/pages/Home.tsx'].match(/data-ut-variant="custom[^"]*"/)?.[0]);
  }
});
