import { describe, expect, it } from 'vitest';
import { closureRepairTargets } from '@/services/app-builder/closureRepairTargets';

const pages = [
  { pageId: 'home', title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx' },
  { pageId: 'contact', title: 'Contact', route: '/contact', role: 'contact', filePath: '/src/pages/Contact.tsx' },
];
const files = {
  '/src/pages/Home.tsx': 'import Card from "../project-components/Card"; export default Card;',
  '/src/pages/Contact.tsx': 'export default function Contact(){ return <main/>; }',
  '/src/project-components/Card.tsx': 'export default function Card(){return <article/>;}',
  '/src/App.tsx': 'canonical router',
};
const issue = (path?: string) => ({ severity: 'blocker', code: 'layout', path, message: 'Layout check failed.' });

describe('final-check repair ownership', () => {
  it('does not spend AI requests on registration or connection setup', () => {
    const issues = ['registered-component-not-ready', 'intent-binding-component-unregistered', 'intent-binding-guide-missing']
      .map(code => ({ ...issue('/src/pages/Contact.tsx'), code }));
    expect(closureRepairTargets(files, pages, issues)).toEqual([]);
  });
  it('targets the failing page rather than all completed pages', () => {
    expect(closureRepairTargets(files, pages, [issue('/src/pages/Contact.tsx')]))
      .toEqual([{ page: pages[1], target: '/src/pages/Contact.tsx', diagnostics: ['layout (/src/pages/Contact.tsx): Layout check failed.'] }]);
  });
  it('repairs an imported shared object without resending every page that uses it', () => {
    const groups = closureRepairTargets(files, pages, [issue('/src/project-components/Card.tsx')]);
    expect(groups.map(group => group.target)).toEqual(['/src/project-components/Card.tsx']);
    expect(groups[0].page).toEqual(pages[0]);
  });
  it('never falls back to all pages for unknown or protected diagnostics', () => {
    expect(closureRepairTargets(files, pages, [issue(), issue('/src/App.tsx'), issue('/missing')])).toEqual([]);
  });
  it('keeps multiple source owners separate and combines repeated diagnostics', () => {
    const groups = closureRepairTargets(files, pages, [issue('/'), issue('/contact'), issue('/')]);
    expect(groups.map(group => group.target)).toEqual(['/src/pages/Home.tsx', '/src/pages/Contact.tsx']);
    expect(groups[0].diagnostics).toHaveLength(2);
  });
});