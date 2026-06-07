import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

async function createAccountAndTransactions(page: import('@playwright/test').Page) {
  // Create account
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill('Dashboard Bank');
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('500.00');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Dashboard Bank' }).waitFor();

  // Add transactions
  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('1000.00');
  await page.getByLabel('Description').fill('Salary Income');
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('Type').selectOption('credit');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Salary Income' }).waitFor();

  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('200.00');
  await page.getByLabel('Description').fill('Rent Payment');
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('Type').selectOption('debit');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Rent Payment' }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
  await createAccountAndTransactions(page);
  await page.getByRole('link', { name: /Dashboard/i }).click();
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
});

test('dashboard shows Net Worth section', async ({ page }) => {
  await expect(page.getByText('Net Worth')).toBeVisible();
  // Net worth = initial 500 + 1000 credit - 200 debit = 1300
  await expect(page.getByText('1,300.00').first()).toBeVisible();
});

test('dashboard shows account card', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard Bank' })).toBeVisible();
});

test('dashboard shows monthly income and expenses', async ({ page }) => {
  const monthLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  await expect(page.getByText(monthLabel)).toBeVisible();
  await expect(page.getByText('Income', { exact: true })).toBeVisible();
  await expect(page.getByText('Expenses', { exact: true })).toBeVisible();
  await expect(page.getByText('+1000.00').first()).toBeVisible();
  await expect(page.getByText('−200.00').first()).toBeVisible();
});

test('dashboard shows recent transactions list', async ({ page }) => {
  await expect(page.getByText('Recent Transactions')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Salary Income' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Rent Payment' })).toBeVisible();
});
