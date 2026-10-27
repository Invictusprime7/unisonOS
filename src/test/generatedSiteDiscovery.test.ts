import { describe, expect, it } from 'vitest';
import {
  discoverGeneratedSiteArtifacts,
  renderGeneratedSiteDiscoveryForPrompt,
  sourceTargetsForCartWiring,
} from '@/services/builder/generatedSiteDiscovery';
import { selectSourceKnowledgeWithReport } from '@/services/builder/sourceKnowledgeContext';

describe('generated site source discovery', () => {
  const files = {
    '/src/pages/Home.tsx': `
      export default function Home() {
        return <a href="#/shop">Shop now</a>;
      }
    `,
    '/src/pages/Shop.tsx': `
      const products = [
        { id: 'vessel', name: 'Editorial Atelier Vessel No. 04', price: 185 },
        { id: 'throw', title: 'Linen Monograph Studio Throw', price: '$240.00' },
      ];
      export function Shop() {
        return <button data-ut-intent="commerce.addToCart">Add to bag</button>;
      }
    `,
    '/src/context/CartContext.tsx': `
      export const CartProvider = ({ children }) => children;
      export const useCart = () => ({ addToCart() {}, cartItems: [] });
    `,
    '/src/pages/Journal.tsx': 'export const Journal = () => <article>Editorial notes</article>;',
  };

  it('keeps source-authored products distinct from managed catalog records', () => {
    const discovery = discoverGeneratedSiteArtifacts(files);
    expect(discovery.authoredCatalogItems).toEqual([
      expect.objectContaining({ name: 'Editorial Atelier Vessel No. 04', price: 185, sourcePath: '/src/pages/Shop.tsx' }),
      expect.objectContaining({ name: 'Linen Monograph Studio Throw', price: 240, sourcePath: '/src/pages/Shop.tsx' }),
    ]);
    expect(discovery.cartRuntimeFiles).toEqual(['/src/context/CartContext.tsx']);
    expect(discovery.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Add to bag', intent: 'commerce.addToCart', sourcePath: '/src/pages/Shop.tsx' }),
    ]));
    expect(renderGeneratedSiteDiscoveryForPrompt(discovery)).toContain('authored VFS fixtures; not saved database catalog rows');
  });

  it('targets the cart provider and product page for a scoped cart edit', () => {
    expect(sourceTargetsForCartWiring(files, '/src/pages/Home.tsx')).toEqual(expect.arrayContaining([
      '/src/pages/Home.tsx',
      '/src/pages/Shop.tsx',
      '/src/context/CartContext.tsx',
    ]));
  });

  it('does not make unrelated large pages mandatory context for a cart edit', () => {
    const expandedFiles = {
      ...files,
      '/src/pages/CartEditorial.tsx': `// editorial note: cart is mentioned but has no commerce controls or data\n${'Long editorial copy. '.repeat(3500)}`,
      ...Object.fromEntries(Array.from({ length: 5 }, (_, index) => [
        `/src/pages/Editorial${index}.tsx`,
        `export default function Editorial${index}(){return <main>${'Editorial content '.repeat(3500)}</main>}`,
      ])),
    };
    const targets = sourceTargetsForCartWiring(expandedFiles, '/src/pages/Home.tsx');
    const report = selectSourceKnowledgeWithReport(expandedFiles, targets, 240_000, { scoped: true });

    expect(targets).not.toContain('/src/pages/Editorial0.tsx');
    expect(targets).not.toContain('/src/pages/CartEditorial.tsx');
    expect(report.completeTargets).toBe(true);
    expect(report.omitted.some((item) => item.path.startsWith('/src/pages/Editorial'))).toBe(false);
  });
});
