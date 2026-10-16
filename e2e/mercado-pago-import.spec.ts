import { test, expect, type Page } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

async function createAccount(
  page: Page,
  name: string,
  institution: 'Mercado Pago' | 'Outros bancos' = 'Outros bancos',
): Promise<void> {
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Institution').selectOption({ label: institution });
  await page.getByLabel('Initial Balance').fill('0.00');
  await page.getByRole('button', { name: 'Create' }).click();
}

async function goDashboard(page: Page): Promise<void> {
  await page.getByRole('link', { name: /Dashboard/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
});

test('saves Mercado Pago institution and shows both import actions on the card', async ({
  page,
}) => {
  await createAccount(page, 'MP Wallet', 'Mercado Pago');
  await expect(page.getByRole('cell', { name: 'MP Wallet' })).toBeVisible();

  await goDashboard(page);

  const card = page
    .locator('div')
    .filter({ hasText: 'MP Wallet' })
    .filter({
      has: page.getByRole('button', { name: 'Import', exact: true }),
    });
  await expect(card.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Import from Mercado Pago' })).toBeVisible();
});

test('missing companion extension explains how to install it', async ({ page }) => {
  await createAccount(page, 'MP Install', 'Mercado Pago');
  await goDashboard(page);

  await page.getByRole('button', { name: 'Import from Mercado Pago' }).click();
  await expect(page.getByRole('heading', { name: /Import from Mercado Pago/ })).toBeVisible();

  await page.getByTestId('mp-import-button').click();

  await expect(page.getByTestId('mp-import-error')).toHaveText('Import extension not available');
  const guide = page.getByTestId('mp-extension-install');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Install the mytruetrack Import extension');
  await expect(guide).toContainText('chrome://extensions');
  await expect(guide).toContainText('edge://extensions');
  await expect(guide).toContainText('Developer mode');
  await expect(guide).toContainText('Load unpacked');
  await expect(guide.getByRole('link', { name: 'Extension folder on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/juliano-pezzini/mytruetrack/tree/main/extension',
  );

  await expect(page.getByText('No Mercado Pago imports yet.')).toBeVisible();
});

test('rejects a second active Mercado Pago account', async ({ page }) => {
  await createAccount(page, 'First MP', 'Mercado Pago');
  await expect(page.getByRole('cell', { name: 'First MP' })).toBeVisible();

  await createAccount(page, 'Second MP', 'Mercado Pago');
  await expect(page.getByText('An active Mercado Pago account already exists.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Second MP' })).toHaveCount(0);
});

test('non-323 account shows file Import only', async ({ page }) => {
  await createAccount(page, 'Other Bank', 'Outros bancos');
  await expect(page.getByRole('cell', { name: 'Other Bank' })).toBeVisible();

  await goDashboard(page);

  const card = page
    .locator('div')
    .filter({ hasText: 'Other Bank' })
    .filter({
      has: page.getByRole('button', { name: 'Import', exact: true }),
    });
  await expect(card.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import from Mercado Pago' })).toHaveCount(0);
});

test('toggling institution hides Mercado Pago action and keeps the account', async ({ page }) => {
  await createAccount(page, 'Toggle MP', 'Mercado Pago');
  await expect(page.getByRole('cell', { name: 'Toggle MP' })).toBeVisible();

  await goDashboard(page);
  await expect(page.getByRole('button', { name: 'Import from Mercado Pago' })).toBeVisible();

  await page.getByRole('link', { name: /Accounts/i }).click();
  const row = page.getByRole('row').filter({ hasText: 'Toggle MP' });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Institution').selectOption({ label: 'Outros bancos' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'Toggle MP' })).toBeVisible();

  await goDashboard(page);
  await expect(page.getByText('Toggle MP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import from Mercado Pago' })).toHaveCount(0);
});

test('toggling back to Mercado Pago restores the action; mark never loads MP CDN', async ({
  page,
}) => {
  const mercadopagoImageRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (
      /mercadopago/i.test(url) &&
      (req.resourceType() === 'image' || /\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(url))
    ) {
      mercadopagoImageRequests.push(url);
    }
  });

  await createAccount(page, 'Toggle Back MP', 'Mercado Pago');
  await expect(page.getByRole('cell', { name: 'Toggle Back MP' })).toBeVisible();

  await goDashboard(page);
  const mpButton = page.getByRole('button', { name: 'Import from Mercado Pago' });
  await expect(mpButton).toBeVisible();
  await expect(mpButton.locator('img')).toHaveCount(0);
  await expect(mpButton.locator('svg')).toHaveCount(1);

  await page.getByRole('link', { name: /Accounts/i }).click();
  let row = page.getByRole('row').filter({ hasText: 'Toggle Back MP' });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Institution').selectOption({ label: 'Outros bancos' });
  await page.getByRole('button', { name: 'Save' }).click();

  await goDashboard(page);
  await expect(page.getByRole('button', { name: 'Import from Mercado Pago' })).toHaveCount(0);

  await page.getByRole('link', { name: /Accounts/i }).click();
  row = page.getByRole('row').filter({ hasText: 'Toggle Back MP' });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Institution').selectOption({ label: 'Mercado Pago' });
  await page.getByRole('button', { name: 'Save' }).click();

  await goDashboard(page);
  await expect(page.getByRole('button', { name: 'Import from Mercado Pago' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Import from Mercado Pago' }).locator('img'),
  ).toHaveCount(0);

  expect(mercadopagoImageRequests).toEqual([]);
});
