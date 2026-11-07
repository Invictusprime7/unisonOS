/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useEffect } from 'react';
import { RESPONSIVE_CSS } from './theme';
import { usePublishedFormRuntime } from './formRuntime';
import { usePublishedActionRuntime } from './publishedActionRuntime';

/**
 * SiteLayout installs structural responsive rules and published runtimes.
 * Stage 4b remains the only owner of global presentation.
 */
export default function SiteLayout({ children, pageRole }: { children: React.ReactNode; pageRole?: string }) {
  usePublishedFormRuntime();
  usePublishedActionRuntime();
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = RESPONSIVE_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  // data-ut-page-role scopes the page archetype's rhythm and density, which
  // Stage 4b emits into index.css. Nothing else is page-scoped.
  return <div data-ut-page-role={pageRole || 'custom'} data-ut-source-locator="/src/components/SiteLayout.tsx:22:10" data-ut-source-ast="/src/components/SiteLayout.tsx#6a0f14eca3633c68" data-ut-source-hash="73ae1d99a3636c4d">{children}</div>;
}
