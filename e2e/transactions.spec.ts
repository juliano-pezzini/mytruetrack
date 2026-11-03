import { test, expect, type Page } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Return a date string (YYYY-MM-DD) for day `d` of the current month. */
function thisMonth(d: number): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function shortMonth(year: number, month: number): string {
  return `${SHORT_MONTHS[month - 1]} ${year}`;
}

function spanLabel(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): string {
  const start = shortMonth(startYear, startMonth);
  const end = shortMonth(endYear, endMonth);
  return start === end ? start : `${start} \u2013 ${end}`;
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const monthIndex = ((index % 12) + 12) % 12;
  return { year: nextYear, month: monthIndex + 1 };
}

async function stepGridToYear(page: Page, gridName: 'From' | 'To', targetYear: number) {
  const grid = page.getByRole('group', { name: gridName });
  let year = Number(await grid.locator('span').innerText());
  while (year !== targetYear) {
    const buttonName = year > targetYear ? 'Previous year' : 'Next year';
    await grid.getByRole('button', { name: buttonName }).click();
    year += year > targetYear ? -1 : 1;
  }
}

async function pickMonthSpan(
  page: Page,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
) {
  await page.getByRole('button', { name: 'Period' }).click();
  await stepGridToYear(page, 'From', startYear);
  await stepGridToYear(page, 'To', endYear);
  await page
    .getByRole('group', { name: 'From' })
    .getByRole('button', { name: `${LONG_MONTHS[startMonth - 1]} ${startYear}` })
    .click();
  await page
    .getByRole('group', { name: 'To' })
    .getByRole('button', { name: `${LONG_MONTHS[endMonth - 1]} ${endYear}` })
    .click();
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
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();
});

test('shows empty state when no transactions', async ({ page }) => {
  const now = new Date();
  const label = shortMonth(now.getFullYear(), now.getMonth() + 1);
  await expect(page.getByRole('button', { name: 'Period' })).toHaveText(label);
  await expect(page.getByText(`No transactions for ${label}.`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous month' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next month' })).toHaveCount(0);
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

test('period span filters rows and keeps the shortcut windows', async ({ page }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const current = shortMonth(year, month);
  const last12Start = addMonths(year, month, -11);
  const last12 = spanLabel(last12Start.year, last12Start.month, year, month);

  await expect(page.getByRole('button', { name: 'Period' })).toHaveText(current);

  await page.getByRole('button', { name: 'Period' }).click();
  await page.getByRole('button', { name: 'Last 12 months' }).click();
  await expect(page.getByRole('button', { name: 'Period' })).toHaveText(last12);
  await expect(page.getByRole('button', { name: 'Last 12 months' })).toHaveCount(0);

  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '10.00',
    description: 'May Edge',
    date: '2024-05-31',
    type: 'debit',
  });
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '10.00',
    description: 'June Early',
    date: '2024-06-01',
    type: 'debit',
  });
  await createTxnWithPicker(page, {
    account: 'Test Bank',
    amount: '25.00',
    description: 'June Late',
    date: '2024-06-15',
    type: 'credit',
  });
  await expect(page.getByRole('cell', { name: 'June Early' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'May Edge' })).toHaveCount(0);

  await pickMonthSpan(page, 2024, 6, 2024, 6);
  await expect(page.getByRole('button', { name: 'Period' })).toHaveText('Jun 2024');
  await expect(page.getByRole('cell', { name: 'June Early' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'June Late' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'May Edge' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toHaveCount(0);
  await expect(page.locator('tbody tr').nth(0)).toContainText('June Late');
  await expect(page.locator('tbody tr').nth(1)).toContainText('June Early');

  await page.getByLabel('Account filter').selectOption({ label: 'Test Bank' });
  await expect(page.getByRole('button', { name: 'Period' })).toHaveText('Jun 2024');
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
  await expect(page.locator('tbody tr').nth(0)).toContainText('June Early');
  await expect(page.locator('tbody tr').nth(1)).toContainText('June Late');
  await expect(page.getByRole('cell', { name: '980.00' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '1,005.00' })).toBeVisible();

  await pickMonthSpan(page, 2020, 1, 2020, 1);
  await expect(page.getByText('No transactions for Jan 2020.')).toBeVisible();
});

test('leaving Transactions resets the span', async ({ page }) => {
  const now = new Date();
  const current = shortMonth(now.getFullYear(), now.getMonth() + 1);
  await page.getByRole('button', { name: 'Period' }).click();
  await page.getByRole('button', { name: 'Last 12 months' }).click();
  await expect(page.getByRole('button', { name: 'Period' })).not.toHaveText(current);

  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();
  await expect(page.getByRole('button', { name: 'Period' })).toHaveText(current);
});

test('All accounts shows rows from every account with Account column', async ({ page }) => {
  await createAccount(page, 'Second Bank', '500.00');
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
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
  // Newest first (day 3 before day 2)
  await expect(page.locator('tbody tr').nth(0)).toContainText('From Second');
  await expect(page.locator('tbody tr').nth(1)).toContainText('From Test');

  await page.getByLabel('Account filter').selectOption({ label: 'Test Bank' });
  await expect(page.getByRole('cell', { name: 'From Test' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'From Second' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Account' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
});

test('create from All accounts uses account picker', async ({ page }) => {
  await createAccount(page, 'Picker Bank', '200.00');
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
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

test('create under All without account does not add a row', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await page.getByLabel('Amount').fill('1.00');
  await page.getByLabel('Description').fill('Should Not Appear');
  await page.getByLabel('Date').fill(thisMonth(1));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('cell', { name: 'Should Not Appear' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'New Transaction' })).toBeVisible();
});

test('create under single account has no picker', async ({ page }) => {
  await page.getByLabel('Account filter').selectOption({ label: 'Test Bank' });
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await expect(page.getByLabel('Account', { exact: true })).toHaveCount(0);
  await page.getByLabel('Amount').fill('7.00');
  await page.getByLabel('Description').fill('Single Filter Create');
  await page.getByLabel('Date').fill(thisMonth(4));
  await page.getByLabel('Type').selectOption('debit');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('cell', { name: 'Single Filter Create' })).toBeVisible();
});

test('switching filter closes open create form', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Transaction' }).click();
  await expect(page.getByRole('heading', { name: 'New Transaction' })).toBeVisible();
  await page.getByLabel('Account filter').selectOption({ label: 'Test Bank' });
  await expect(page.getByRole('heading', { name: 'New Transaction' })).toHaveCount(0);
});

test.describe('no accounts yet', () => {
  test.beforeEach(async ({ page }) => {
    await setupLocalOnly(page);
  });

  test('shows create-account guidance without All accounts option', async ({ page }) => {
    await page.getByRole('link', { name: 'Transactions', exact: true }).click();
    await page.getByRole('heading', { name: 'Transactions' }).waitFor();
    await expect(page.getByText('Create an account first to add transactions.')).toBeVisible();
    await expect(
      page.getByLabel('Account filter').locator('option', { hasText: 'All accounts' }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel('Account filter').locator('option', { hasText: 'No accounts' }),
    ).toHaveCount(1);
  });
});
