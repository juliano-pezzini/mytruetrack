import { test, expect } from '@playwright/test';
import { setupLocalOnly, gotoApp } from './helpers.ts';

/**
 * Local persistence (Phase 8.11). cr-sqlite 0.16 persists through its Asyncify
 * `IDBBatchAtomicVFS` (IndexedDB) build — it does NOT use OPFS or SharedArrayBuffer,
 * so the app intentionally does NOT require cross-origin isolation (which would
 * otherwise break the Google sign-in popup). These tests verify that data written
 * through the cr-sqlite database survives a full page reload — i.e. it is persisted,
 * not merely held in memory.
 */

test('the app is NOT cross-origin isolated (IndexedDB VFS needs no COOP/COEP)', async ({
  page,
}) => {
  await gotoApp(page);
  const isolated = await page.evaluate(() => self.crossOriginIsolated);
  expect(isolated).toBe(false);
});

test('account data survives a full page reload', async ({ page }) => {
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
  // from durable storage — proving the write was persisted, not just held in memory.
  await page.reload();
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });

  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  await expect(page.getByRole('cell', { name: 'Persisted Account' })).toBeVisible();
});

test('a transaction survives a full page reload', async ({ page }) => {
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
  await page.getByLabel('Date').fill(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-10`,
  );
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
