import { expect, test } from 'playwright/test';

const testUser = {
  id: 'playwright-site-discovery-user',
  email: 'site-discovery@example.test',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
};

test('natural-language portfolio intent stays coherent through App Builder failure', async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  const origin = new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1:4173').origin;
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const tokenPayload = Buffer.from(JSON.stringify({
    sub: testUser.id,
    aud: 'authenticated',
    role: 'authenticated',
    exp: expiresAt,
  })).toString('base64url');
  const session = {
    access_token: `eyJhbGciOiJub25lIn0.${tokenPayload}.playwright`,
    refresh_token: 'playwright-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: expiresAt,
    user: testUser,
  };
  const durableWrites: string[] = [];
  let pageAuthorRequests = 0;

  await page.addInitScript(({ key, value, origin }) => {
    if (location.origin === origin) localStorage.setItem(key, JSON.stringify(value));
  }, {
    key: 'sb-nfrdomdvyrbwuokathtw-auth-token',
    value: session,
    origin,
  });

  await page.route('**/__supabase/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/__supabase', '');

    if (path === '/auth/v1/user') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testUser) });
      return;
    }

    if (path === '/functions/v1/ai-code-assistant') {
      const payload = request.postDataJSON() as { mode?: string };
      if (payload.mode === 'site-discovery') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            mode: 'site-discovery',
            wizardStep: 'confirm',
            content: [
              'Here is the proposed plan for your website:',
              '- Brand Name: ARIA',
              '- Purpose: creative portfolio and work showcase',
              '- Visitor action: explore an interactive experience',
              '- Pages: Home, Gallery, FAQ, and Blog',
              '- Visual direction: bold and motion-rich',
              'Does this sound like the right direction?',
              '<UNISON_SITE_CONFIRMATION>',
            ].join('\n'),
          }),
        });
        return;
      }

      pageAuthorRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Playwright simulated App Builder provider outage' }),
      });
      return;
    }

    if (path === '/functions/v1/universal-creation-plan') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          proposal: { pages: [], requestedCapabilities: [], capabilityEvidence: [] },
        }),
      });
      return;
    }

    if (path.startsWith('/functions/v1/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    if (path === '/rest/v1/rpc/cleanup_empty_projects') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '0' });
      return;
    }

    if (path.startsWith('/rest/v1/')) {
      if (request.method() !== 'GET' && request.method() !== 'HEAD') durableWrites.push(`${request.method()} ${path}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: request.method() === 'HEAD' ? '' : '[]',
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  const composer = page.getByPlaceholder('Tell Affinity about your idea...');
  await expect(composer).toBeVisible();

  const prompt = [
    'I am an artist building a professional portfolio for my studio ARIA.',
    'The goal is to showcase my work and let visitors explore an interactive experience.',
    'Include Home, Gallery, FAQ, and Blog pages with a bold, motion-rich visual style.',
  ].join(' ');
  await composer.fill(prompt);
  await composer.press('Enter');

  const wizard = page.getByRole('region', { name: 'Guided site setup' });
  await expect(wizard).toBeVisible();
  const businessName = wizard.getByRole('textbox', { name: 'Business name' });
  if (await businessName.count()) {
    await businessName.fill('ARIA');
    await wizard.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  await expect(wizard).toContainText('Ready to create ARIA');
  await expect(wizard).toContainText('Creative portfolio and work showcase');
  await expect(wizard).toContainText('Gallery, FAQ, Blog');
  await expect(wizard).not.toContainText('Experience');
  await expect(wizard.getByRole('button', { name: 'Create site', exact: true })).toBeEnabled();
  await wizard.getByRole('button', { name: 'Create site', exact: true }).click();

  await expect(wizard.getByRole('alert')).toContainText('app-build.failed', { timeout: 120_000 });
  await expect(wizard.getByRole('alert')).toContainText('Your selections are preserved.');
  await expect(wizard.getByRole('button', { name: 'Build without AI' })).toBeVisible();
  expect(pageAuthorRequests).toBeGreaterThan(0);
  expect(durableWrites).toEqual([]);
});