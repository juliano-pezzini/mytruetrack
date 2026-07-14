import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

/**
 * Create a single account so the database has data to wipe.
 * Leaves the page on the Accounts list.
 */
async function seedAccount(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill('Wipe Me');
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('123.45');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('cell', { name: 'Wipe Me' })).toBeVisible();
}

async function gotoDangerZone(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('link', { name: /Settings/i }).click();
  await page.getByRole('heading', { name: 'Danger Zone' }).waitFor();
}

test.describe('Danger Zone — clear all data', () => {
  test.beforeEach(async ({ page }) => {
    await setupLocalOnly(page);
    await seedAccount(page);
    await gotoDangerZone(page);
  });

  test('confirm button stays disabled until the exact word is typed', async ({ page }) => {
    await page.getByRole('button', { name: 'Clear all data…' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const confirm = dialog.getByRole('button', { name: 'Clear all data', exact: true });
    await expect(confirm).toBeDisabled();

    // Wrong text keeps it disabled.
    await dialog.getByRole('textbox').fill('delete');
    await expect(confirm).toBeDisabled();

    // Exact word enables it.
    await dialog.getByRole('textbox').fill('DELETE');
    await expect(confirm).toBeEnabled();

    // Clearing the text disables it again.
    await dialog.getByRole('textbox').fill('');
    await expect(confirm).toBeDisabled();
  });

  test('cancelling makes no changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Clear all data…' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // Data is still present.
    await page.getByRole('link', { name: /Accounts/i }).click();
    await expect(page.getByRole('cell', { name: 'Wipe Me' })).toBeVisible();
  });

  test('clearing all data empties the database but keeps the user signed in', async ({ page }) => {
    await page.getByRole('button', { name: 'Clear all data…' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('DELETE');
    await dialog.getByRole('button', { name: 'Clear all data', exact: true }).click();

    await expect(page.getByText('All data has been deleted.')).toBeVisible();

    // Still inside the app (setup wizard is NOT shown).
    await expect(page.getByRole('button', { name: 'Get Started' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Accounts/i })).toBeVisible();

    // The account is gone.
    await page.getByRole('link', { name: /Accounts/i }).click();
    await expect(page.getByText('No accounts yet')).toBeVisible();

    // Persists across a reload (vault stays ready in local-only mode).
    await page.reload();
    await page.getByRole('link', { name: /Accounts/i }).click();
    await expect(page.getByText('No accounts yet')).toBeVisible();
  });
});

test.describe('Danger Zone — full reset', () => {
  test('full reset wipes data and identity, returning to the setup wizard', async ({ page }) => {
    await setupLocalOnly(page);
    await seedAccount(page);
    await gotoDangerZone(page);

    await page.getByRole('button', { name: 'Full reset…' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const confirm = dialog.getByRole('button', { name: 'Reset everything' });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('DELETE');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // App returns to onboarding (identity + data torn down).
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Settings/i })).toHaveCount(0);
  });
});
