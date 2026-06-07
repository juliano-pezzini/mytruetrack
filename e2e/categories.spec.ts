import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
  await page.getByRole('link', { name: /Categories/i }).click();
  await page.getByRole('heading', { name: 'Categories & Tags' }).waitFor();
});

// ─── Categories tab ───────────────────────────────────────────────────────────

test('empty state shows no categories message', async ({ page }) => {
  await expect(page.getByText('No categories yet')).toBeVisible();
});

test('create a parent category', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Food');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Food' })).toBeVisible();
  await expect(page.getByText('Expense')).toBeVisible();
});

test('create a child category under a parent', async ({ page }) => {
  // Create parent first
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Food');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Food' }).waitFor();

  // Create child
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Restaurants');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByLabel('Parent').selectOption('Food');
  await page.getByRole('button', { name: 'Create' }).click();

  // Child should appear with tree indicator
  await expect(page.getByRole('cell', { name: /Restaurants/ })).toBeVisible();
  await expect(page.getByText('└')).toBeVisible();
});

test('create a revenue category', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Salary');
  await page.getByLabel('Type').selectOption('revenue');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Salary' })).toBeVisible();
  await expect(page.getByText('Revenue')).toBeVisible();
});

test('edit a category', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Old Category');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Old Category' }).waitFor();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('New Category');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'New Category' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Old Category' })).not.toBeVisible();
});

test('delete a category with confirmation', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Category' }).click();
  await page.getByLabel('Name').fill('Temp Category');
  await page.getByLabel('Type').selectOption('expense');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Temp Category' }).waitFor();

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).last().click();

  await expect(page.getByRole('cell', { name: 'Temp Category' })).not.toBeVisible();
});

// ─── Tags tab ─────────────────────────────────────────────────────────────────

test('switch to Tags tab', async ({ page }) => {
  await page.getByRole('button', { name: 'Tags' }).click();
  await expect(page.getByText('No tags yet')).toBeVisible();
});

test('create a tag with a color', async ({ page }) => {
  await page.getByRole('button', { name: 'Tags' }).click();
  await page.getByRole('button', { name: '+ New Tag' }).click();
  await page.getByLabel('Name').fill('Vacation');
  await page.getByLabel('Color').fill('#ff6600');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Vacation' })).toBeVisible();
  // Color swatch should be rendered as a span with background color
  const swatch = page.locator('span.rounded-full[style*="background-color"]');
  await expect(swatch).toBeVisible();
});

test('edit a tag', async ({ page }) => {
  await page.getByRole('button', { name: 'Tags' }).click();
  await page.getByRole('button', { name: '+ New Tag' }).click();
  await page.getByLabel('Name').fill('Old Tag');
  await page.getByLabel('Color').fill('#aabbcc');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Old Tag' }).waitFor();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill('New Tag');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'New Tag' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Old Tag' })).not.toBeVisible();
});

test('delete a tag with confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'Tags' }).click();
  await page.getByRole('button', { name: '+ New Tag' }).click();
  await page.getByLabel('Name').fill('Temp Tag');
  await page.getByLabel('Color').fill('#123456');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Temp Tag' }).waitFor();

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).last().click();

  await expect(page.getByRole('cell', { name: 'Temp Tag' })).not.toBeVisible();
});
