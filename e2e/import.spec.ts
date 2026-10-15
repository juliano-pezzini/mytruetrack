import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { setupLocalOnly } from './helpers.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

const OFX_FIXTURE = fixture('sample.ofx');
const BR_CSV_FIXTURE = fixture('brazilian-statement.csv');
const US_XLSX_FIXTURE = fixture('statement-us.xlsx');
const AMBIGUOUS_DATE_FIXTURE = fixture('ambiguous-date.csv');

/** A statement dated in the current month so the transactions page shows the rows. */
function categoryTagsCsv(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dir = mkdtempSync(path.join(tmpdir(), 'mtt-import-'));
  const file = path.join(dir, 'category-tags.csv');
  writeFileSync(
    file,
    [
      'Date;Description;Amount;Categoria;Etiquetas',
      `05/${month}/${year};Groceries;-12.50;market;food, travel`,
      `06/${month}/${year};Gas;-8.00;Fuel;`,
      '',
    ].join('\n'),
  );
  return file;
}

const ACCOUNT = 'Import Account';

/** Create a bank account to import into. */
async function createAccount(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('0.00');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name }).waitFor();
}

/** Open the import modal for the account from the Dashboard. */
async function openImport(page: Page): Promise<void> {
  await page.getByRole('link', { name: /Dashboard/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.getByRole('button', { name: 'Import' }).first().click();
  await page.getByRole('heading', { name: /Import Statement/i }).waitFor();
}

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
  await createAccount(page, ACCOUNT);
});

test('regression: Brazilian CSV (EU decimals, Receita/Despesa) imports without "Invalid decimal format"', async ({
  page,
}) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(BR_CSV_FIXTURE);

  // Wizard auto-detects the columns and previews valid rows.
  await expect(page.getByTestId('preview-summary')).toContainText('3 valid', { timeout: 5_000 });
  // The amount stored in cents must be parsed correctly from "1.234,56".
  await expect(page.getByText('1234.56')).toBeVisible();
  // The bug we are guarding against must never surface.
  await expect(page.getByText(/Invalid decimal format/i)).toHaveCount(0);

  await page.getByRole('button', { name: /Import 3 Transactions/i }).click();

  // The wizard shows a success confirmation in place.
  await expect(page.getByText('Import Complete')).toBeVisible();
  await expect(page.getByText(/3 imported, 0 skipped/i)).toBeVisible();
  await expect(page.getByText(/Invalid decimal format/i)).toHaveCount(0);
});

test('US XLSX imports through the wizard', async ({ page }) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(US_XLSX_FIXTURE);

  await expect(page.getByTestId('preview-summary')).toContainText('3 valid', { timeout: 5_000 });
  await page.getByRole('button', { name: /Import 3 Transactions/i }).click();

  await expect(page.getByText('Import Complete')).toBeVisible();
  await expect(page.getByText(/3 imported, 0 skipped/i)).toBeVisible();
});

test('manual remap: changing the number format updates the preview', async ({ page }) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(BR_CSV_FIXTURE);
  await expect(page.getByTestId('preview-summary')).toContainText('3 valid', { timeout: 5_000 });

  // Forcing the wrong (US) format misreads "1.234,56" → wrong amount, but should not crash.
  await page.getByTestId('map-number-format').selectOption('us');
  await expect(page.getByText('1234.56')).toHaveCount(0);

  // Switching back to EU restores correct parsing.
  await page.getByTestId('map-number-format').selectOption('eu');
  await expect(page.getByText('1234.56')).toBeVisible();
});

test('import button is disabled until required columns are mapped', async ({ page }) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(BR_CSV_FIXTURE);
  await expect(page.getByTestId('preview-summary')).toContainText('3 valid', { timeout: 5_000 });

  // Unset the amount column → required mapping incomplete → import disabled.
  await page.getByTestId('map-amount').selectOption('');
  await expect(page.getByRole('button', { name: /Import .* Transactions/i })).toBeDisabled();
});

test('saved mapping persists and is offered on the next import', async ({ page }) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(BR_CSV_FIXTURE);
  await expect(page.getByTestId('preview-summary')).toContainText('3 valid', { timeout: 5_000 });

  await page.getByLabel('Save this mapping').fill('Brazilian bank');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('saved-mappings')).toContainText('Brazilian bank');

  // Reopen the modal for the same account and confirm the mapping is remembered.
  await page.getByRole('button', { name: 'Close' }).click();
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(BR_CSV_FIXTURE);
  await expect(page.getByTestId('saved-mappings')).toContainText('Brazilian bank', {
    timeout: 5_000,
  });
});

test('month-first reparses 01/02/2026 as 2026-01-02 while category and tags stay unmapped', async ({
  page,
}) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(AMBIGUOUS_DATE_FIXTURE);

  await expect(page.getByTestId('preview-summary')).toContainText('1 valid', { timeout: 5_000 });
  await expect(page.getByText('2026-02-01')).toBeVisible();
  await expect(page.getByTestId('map-category')).toHaveValue('');
  await expect(page.getByTestId('map-tags')).toHaveValue('');
  await expect(page.getByRole('button', { name: /Import 1 Transactions/i })).toBeEnabled();

  await page.getByTestId('map-date-format').selectOption({ label: 'MM/DD/YYYY' });

  await expect(page.getByText('2026-01-02')).toBeVisible();
  await expect(page.getByText('2026-02-01')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Import 1 Transactions/i })).toBeEnabled();
});

test('a CSV category and tags are classified in the preview and imported', async ({ page }) => {
  await page.getByRole('link', { name: /Categories/i }).click();
  await page.getByRole('heading', { name: 'Categories & Tags' }).waitFor();
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Market');
  await page.getByLabel('Type').selectOption('revenue');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Market', exact: true }).waitFor();

  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(categoryTagsCsv());

  await expect(page.getByTestId('preview-summary')).toContainText('2 valid', { timeout: 5_000 });
  await expect(page.getByRole('cell', { name: 'Market', exact: true })).toBeVisible();
  await expect(page.getByText('market (expense)')).toHaveCount(0);
  await expect(page.getByText('Fuel (expense)')).toBeVisible();
  await expect(page.getByText('food, travel')).toBeVisible();
  await expect(page.getByRole('button', { name: /Import 2 Transactions/i })).toBeEnabled();

  await page.getByRole('button', { name: /Import 2 Transactions/i }).click();
  await expect(page.getByText('Import Complete')).toBeVisible();
  await expect(page.getByText(/2 imported, 0 skipped/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: /Import Statement/i })).toHaveCount(0);

  await page.getByRole('link', { name: /Transactions/i }).click();
  await page.getByRole('heading', { name: 'Transactions' }).waitFor();
  await expect(page.getByRole('cell', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Market', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Gas' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Fuel', exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Categories/i }).click();
  await page.getByRole('heading', { name: 'Categories & Tags' }).waitFor();
  await expect(page.getByRole('cell', { name: 'Market', exact: true })).toHaveCount(1);
  await expect(page.getByRole('cell', { name: 'Fuel', exact: true })).toBeVisible();
  await expect(page.getByText('Revenue')).toBeVisible();
  await expect(page.getByText('Expense')).toBeVisible();

  await page.getByRole('button', { name: 'Tags' }).click();
  await expect(page.getByRole('cell', { name: 'food', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'travel', exact: true })).toBeVisible();
});

test('OFX import still works through the modal', async ({ page }) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(OFX_FIXTURE);

  await expect(page.getByText(/3 transactions? found/i)).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /Import 3 Transactions/i }).click();

  await expect(page.getByText('Import Complete')).toBeVisible();
  await expect(page.getByText(/3 imported, 0 skipped/i)).toBeVisible();
});
