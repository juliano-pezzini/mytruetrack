import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

async function createAccount(
  page: import('@playwright/test').Page,
  name: string,
  initialBalance = '1000.00',
) {
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill(initialBalance);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
  await createAccount(page, 'Test Bank');
  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();
});

test('shows empty state when no transactions', async ({ page }) => {
  await expect(page.getByText(/No transactions for/i)).toBeVisible();
});

test('create a credit transaction', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Transaction' }).click();

  await page.getByLabel('Amount').fill('500.00');
  await page.getByLabel('Description').fill('Salary');
  await page.getByLabel('Date').fill('2026-06-01');
  await page.getByLabel('Type').selectOption('credit');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Salary' })).toBeVisible();
  await expect(page.getByText('+500.00')).toBeVisible();
});

test('create a debit transaction', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Transaction' }).click();

  await page.getByLabel('Amount').fill('85.50');
  await page.getByLabel('Description').fill('Groceries');
  await page.getByLabel('Date').fill('2026-06-15');
  await page.getByLabel('Type').selectOption('debit');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByText('−85.50')).toBeVisible();
});

test('running balance is shown in the table', async ({ page }) => {
  // Create a credit
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('200.00');
  await page.getByLabel('Description').fill('Credit entry');
  await page.getByLabel('Date').fill('2026-06-01');
  await page.getByLabel('Type').selectOption('credit');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Credit entry' }).waitFor();

  // Balance column header
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
  // Running balance = initial 1000 + 200 = 1200
  await expect(page.getByRole('cell', { name: '1,200.00' })).toBeVisible();
});

test('edit a transaction', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('100.00');
  await page.getByLabel('Description').fill('Original Desc');
  await page.getByLabel('Date').fill('2026-06-01');
  await page.getByLabel('Type').selectOption('debit');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Original Desc' }).waitFor();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Description').fill('Updated Desc');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'Updated Desc' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Original Desc' })).not.toBeVisible();
});

test('delete a transaction with confirmation', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('50.00');
  await page.getByLabel('Description').fill('To Delete');
  await page.getByLabel('Date').fill('2026-06-01');
  await page.getByLabel('Type').selectOption('debit');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'To Delete' }).waitFor();

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).last().click();

  await expect(page.getByRole('cell', { name: 'To Delete' })).not.toBeVisible();
});

test('month navigation changes displayed period', async ({ page }) => {
  // Current month label is visible
  const now = new Date();
  const currentLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  await expect(page.getByText(currentLabel, { exact: true })).toBeVisible();

  // Navigate to previous month
  await page.getByRole('button', { name: '◀' }).click();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1);
  const prevLabel = prevDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  await expect(page.getByText(prevLabel, { exact: true })).toBeVisible();

  // Navigate back to current
  await page.getByRole('button', { name: '▶' }).click();
  await expect(page.getByText(currentLabel, { exact: true })).toBeVisible();
});
