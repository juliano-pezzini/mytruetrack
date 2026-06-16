import { test, expect, type Page } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

const OFX_FIXTURE = fixture('sample.ofx');
const BR_CSV_FIXTURE = fixture('brazilian-statement.csv');
const US_XLSX_FIXTURE = fixture('statement-us.xlsx');

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

test('OFX import still works through the modal', async ({ page }) => {
  await openImport(page);
  await page.getByLabel('Statement File').setInputFiles(OFX_FIXTURE);

  await expect(page.getByText(/3 transactions? found/i)).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /Import 3 Transactions/i }).click();

  await expect(page.getByText('Import Complete')).toBeVisible();
  await expect(page.getByText(/3 imported, 0 skipped/i)).toBeVisible();
});
