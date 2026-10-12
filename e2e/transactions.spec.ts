import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

/** Return a date string (YYYY-MM-DD) for day `d` of the current month. */
function thisMonth(d: number): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

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

/** Create a transaction while All accounts is selected (form account picker required). */
async function createTxnWithPicker(
  page: import('@playwright/test').Page,
  opts: {
    account: string;
    amount: string;
    description: string;
    date: string;
    type: 'credit' | 'debit';
  },
) {
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Account', { exact: true }).selectOption({ label: opts.account });
  await page.getByLabel('Amount').fill(opts.amount);
  await page.getByLabel('Description').fill(opts.description);
  await page.getByLabel('Date').fill(opts.date);
  await page.getByLabel('Type').selectOption(opts.type);
  await page.getByRole('button', { name: 'Create' }).click();
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
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '500.00',
    description: 'Salary',
    date: thisMonth(1),
    type: 'credit',
  });

  await expect(page.getByRole('cell', { name: 'Salary' })).toBeVisible();
  await expect(page.getByText('+500.00')).toBeVisible();
});

test('create a debit transaction', async ({ page }) => {
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '85.50',
    description: 'Groceries',
    date: thisMonth(15),
    type: 'debit',
  });

  await expect(page.getByRole('cell', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByText('−85.50')).toBeVisible();
});

test('running balance is shown in the table', async ({ page }) => {
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '200.00',
    description: 'Credit entry',
    date: thisMonth(1),
    type: 'credit',
  });
  await page.getByRole('cell', { name: 'Credit entry' }).waitFor();

  // Balance column only appears for a single-account filter
  await page.getByLabel('Account filter').selectOption({ label: 'Test Bank' });
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
  // Running balance = initial 1000 + 200 = 1200
  await expect(page.getByRole('cell', { name: '1,200.00' })).toBeVisible();
});

test('edit a transaction', async ({ page }) => {
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '100.00',
    description: 'Original Desc',
    date: thisMonth(1),
    type: 'debit',
  });
  await page.getByRole('cell', { name: 'Original Desc' }).waitFor();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Account', { exact: true })).toHaveCount(0);
  await page.getByLabel('Description').fill('Updated Desc');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'Updated Desc' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Original Desc' })).not.toBeVisible();
});

test('delete a transaction with confirmation', async ({ page }) => {
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '50.00',
    description: 'To Delete',
    date: thisMonth(1),
    type: 'debit',
  });
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
  await page.getByRole('button', { name: 'Previous month' }).click();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1);
  const prevLabel = prevDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  await expect(page.getByText(prevLabel, { exact: true })).toBeVisible();

  // Navigate back to current
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByText(currentLabel, { exact: true })).toBeVisible();
});

test('All accounts shows rows from every account with Account column', async ({ page }) => {
  await createAccount(page, 'Second Bank', '500.00');
  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();

  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '10.00',
    description: 'From Test',
    date: thisMonth(2),
    type: 'debit',
  });
  await createTxnWithPicker(page, {
    account: 'Second Bank',
    amount: '20.00',
    description: 'From Second',
    date: thisMonth(3),
    type: 'debit',
  });

  await expect(page.getByLabel('Account filter')).toHaveValue('');
  await expect(page.getByRole('columnheader', { name: 'Account' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'From Test' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'From Second' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Test Bank', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Second Bank', exact: true })).toBeVisible();

  await page.getByLabel('Account filter').selectOption({ label: 'Test Bank' });
  await expect(page.getByRole('cell', { name: 'From Test' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'From Second' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Account' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
});

test('create from All accounts uses account picker', async ({ page }) => {
  await createAccount(page, 'Picker Bank', '200.00');
  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();

  await expect(page.getByLabel('Account filter')).toHaveValue('');
  await createTxnWithPicker(page, {
    account: 'Picker Bank',
    amount: '33.00',
    description: 'Picker Created',
    date: thisMonth(5),
    type: 'credit',
  });

  await expect(page.getByRole('cell', { name: 'Picker Created' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Picker Bank', exact: true })).toBeVisible();
});
