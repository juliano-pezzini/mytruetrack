import { test, expect } from '@playwright/test';
import { setupLocalOnly, gotoApp } from './helpers.ts';

/**
 * OPFS persistence (Phase 8.11). Verifies that data written through the cr-sqlite
 * OPFS-backed database survives a full page reload — i.e. it is persisted to disk,
 * not merely held in memory.
 */

test('the app is cross-origin isolated (required for cr-sqlite OPFS)', async ({ page }) => {
  await gotoApp(page);
  const isolated = await page.evaluate(() => self.crossOriginIsolated);
  expect(isolated).toBe(true);
});

test('account data survives a full page reload (OPFS)', async ({ page }) => {
  await setupLocalOnly(page);

  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();

  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill('Persisted Account');
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('1234.56');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('cell', { name: 'Persisted Account' })).toBeVisible();

  // Full reload: in local-only mode the vault auto-unlocks, and the row must reappear
  // from OPFS — proving the write was persisted to disk.
  await page.reload();
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });

  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  await expect(page.getByRole('cell', { name: 'Persisted Account' })).toBeVisible();
});

test('a transaction survives a full page reload (OPFS)', async ({ page }) => {
  await setupLocalOnly(page);

  // Create an account to hold the transaction.
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill('Checking');
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('100.00');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Checking' }).waitFor();

  // Add a transaction.
  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('42.00');
  await page.getByLabel('Description').fill('Persisted Txn');
  await page.getByLabel('Date').fill('2026-06-10');
  await page.getByLabel('Type').selectOption('debit');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('cell', { name: 'Persisted Txn' })).toBeVisible();

  // Reload and confirm the transaction is still there.
  await page.reload();
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });
  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();
  await expect(page.getByRole('cell', { name: 'Persisted Txn' })).toBeVisible();
});
