import { test, expect } from '@playwright/test';
import { clearStorage, gotoApp } from './helpers.ts';

const ENDPOINT = 'http://127.0.0.1:8765';

const EMPTY_PROPFIND = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/mytruetrack/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

test('empty WebDAV folder enables create and skip after continue', async ({ page }) => {
  let propfinds = 0;
  await page.route(`${ENDPOINT}/**`, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PROPFIND, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth',
        },
      });
      return;
    }
    if (method === 'PROPFIND') {
      propfinds += 1;
      await route.fulfill({
        status: 207,
        contentType: 'application/xml',
        body: EMPTY_PROPFIND,
      });
      return;
    }
    await route.fulfill({ status: 404, body: '' });
  });

  await clearStorage(page);
  await gotoApp(page);
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Connect cloud storage' }).click();
  await page.getByRole('radio', { name: /WebDAV/ }).check();
  await page.getByPlaceholder('Server URL').fill(`${ENDPOINT}/`);
  await page.getByPlaceholder('Username').fill('uat');
  await page.getByPlaceholder('Password / app token').fill('secret');
  await page.getByRole('button', { name: 'Continue' }).click();

  const create = page.getByRole('button', { name: 'Create a passphrase' });
  const skip = page.getByRole('button', { name: /Skip.*passphrase/i });
  await expect(page.getByText('Could not check the cloud folder')).toHaveCount(0);
  await expect
    .poll(async () => {
      const before = propfinds;
      const enabled = (await create.isEnabled()) && (await skip.isEnabled());
      await new Promise((resolve) => setTimeout(resolve, 300));
      return enabled && (await create.isEnabled()) && propfinds === before;
    })
    .toBe(true);
});
