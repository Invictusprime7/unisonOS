import React from 'react';
import * as Babel from '@babel/standalone';
import * as icons from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Dialog from '@radix-ui/react-dialog';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compilePortableRecipes, DESIGN_SOURCE_ROOT } from '@/services/app-builder/design/portableRecipeCompiler';
import { materializeDesignSources } from '@/services/app-builder/design/designSourceMaterializer';
import type { DesignSourceBundle } from '@/services/app-builder/design/DesignSourceBundle';
import { createUnisonBuilderContext } from '@/services/unisonBuilderConnector';
import { PUBLISHED_ACTION_RUNTIME_MODULE } from '@/sections/publishedActionRuntimeModule';
import { LAUNCHER_BASE_THEME as THEME } from '@/sections/themes';

function bundle(ids: string[]): DesignSourceBundle {
  return { implementations: ids.map(id => ({ implementationId: id, sectionType: id.split(':')[0], certification: 'approved' })) } as DesignSourceBundle;
}

function load(source: string, dependencies: Record<string, unknown>): Record<string, any> {
  const code = Babel.transform(source, { presets: ['typescript', 'react'], filename: 'Module.tsx', plugins: ['transform-modules-commonjs'] }).code;
  if (!code) throw new Error('No compiled source');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

function components(ids: string[], family: string) {
  const compiled = compilePortableRecipes(bundle(ids));
  const recipe = load(compiled.files[`${DESIGN_SOURCE_ROOT}/recipes/${family}.ts`], {
    react: React, '@/unison/ui/icons': icons,
    '@/unison/ui/radix/accordion': Accordion, '@/unison/ui/radix/dialog': Dialog,
  });
  return load(compiled.files[`${DESIGN_SOURCE_ROOT}/${family}.tsx`], { react: React, [`./recipes/${family}`]: recipe, './theme': { THEME } });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

describe('App Builder portable recipe behavior', () => {
  it.each([['data-table:striped-rows', 'DataTable'], ['data-table:dashboard-overview', 'DashboardOverview']])('renders bound table values safely in %s', (id, exportName) => {
    const Table = components([id], 'DataTable')[exportName];
    const { container } = render(<Table sourceTable="services" columns={[{ key: 'name', label: 'Name' }, { key: 'price', label: 'Price' }, { key: 'details', label: 'Details' }]} rows={[{ id: 'service-7', name: { label: 'Consultation' }, price: 0, details: { nested: 'Not a React child' } }]} />);
    expect(container.querySelector('[data-ut-row-id="service-7"][data-ut-field="name"]')?.textContent).toBe('Consultation');
    expect(container.querySelector('[data-ut-source-table="services"][data-ut-field="price"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-ut-field="details"]')?.textContent).toBe('');
  });
  it('keeps distinct supplied section and functional instance identities through named exports', () => {
    const { AuthSignIn } = components(['auth-form:split-panel'], 'AuthForm');
    const { container } = render(<><AuthSignIn sectionId="auth-a" componentInstanceId="cmp_a" /><AuthSignIn sectionId="auth-b" componentInstanceId="cmp_b" /></>);
    expect(container.querySelector('[data-ut-section-id="auth-a"]')?.getAttribute('data-ut-component-instance-id')).toBe('cmp_a');
    expect(container.querySelector('[data-ut-section-id="auth-b"]')?.getAttribute('data-ut-component-instance-id')).toBe('cmp_b');
    expect(container.querySelectorAll('form[data-intent-form="auth.login"]')).toHaveLength(2);
    expect(container.querySelectorAll('form [data-ut-intent], form[data-ut-intent]')).toHaveLength(0);
  });

  it('toggles billing locally without dispatching a backend intent', () => {
    const { PricingBillingToggle } = components(['pricing:billing-toggle'], 'Pricing');
    render(<PricingBillingToggle tiers={[{ name: 'Standard', price: '100', features: ['Service'] }]} />);
    const monthly = screen.getByRole('button', { name: 'Monthly' });
    const yearly = screen.getByRole('button', { name: /Yearly/ });
    expect(monthly).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(yearly);
    expect(yearly).toHaveAttribute('aria-pressed', 'true');
    expect(monthly).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(monthly);
    expect(yearly).toHaveAttribute('aria-pressed', 'false');
    expect(yearly).not.toHaveAttribute('data-ut-intent');
  });

  it('projects verified materialized export identity and refuses stale recipe bytes', () => {
    const { files } = materializeDesignSources(bundle(['auth-form:split-panel']));
    const context = createUnisonBuilderContext({ files });
    expect(context.registry.materializedRecipes['auth-form:split-panel']?.exportName).toBe('AuthSignIn');
    expect(createUnisonBuilderContext({ files: { ...files, [`${DESIGN_SOURCE_ROOT}/recipes/AuthForm.ts`]: 'stale' } }).registry.materializedRecipes).toEqual({});
  });

  it.each([['auth.login', 'login'], ['auth.register', 'register']])('submits %s exactly once through the site auth adapter', async (intent, action) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, session: { token: 'test-only' }, user: { id: 'visitor' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const { usePublishedActionRuntime } = load(PUBLISHED_ACTION_RUNTIME_MODULE, {
      react: React,
      '@/unison/publishedRuntime': { PUBLISHED_RUNTIME_CONFIG: { siteId: 'site-1', controllerEndpoints: { 'site-auth': '/site-auth' } } },
      '@/unison/generatedSiteRuntimeManifest': { GENERATED_SITE_RUNTIME_MANIFEST: { enabledCapabilities: ['auth'], controllers: [], components: [] } },
    });
    function Site() {
      usePublishedActionRuntime();
      return <form data-intent-form={intent}><input name="email" defaultValue="visitor@example.test" /><input name="password" defaultValue="Test12345" /><button type="submit">Submit</button></form>;
    }
    const { container } = render(<Site />);
    const form = container.querySelector('form');
    if (!form) throw new Error('Missing form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ siteId: 'site-1', action, email: 'visitor@example.test' });
    await waitFor(() => expect(window.sessionStorage.getItem('unison-site-session:site-1')).toBeTruthy());
    expect(form).not.toHaveAttribute('aria-busy');
  });
});