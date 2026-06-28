import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
});

test('InvestPass import page loads with expected UI elements', async ({ page }) => {
  await page.getByRole('link', { name: /Settings/i }).click();
  await page.getByRole('link', { name: /InvestPass Import/i }).click();
  await page.waitForURL('/import/investpass');

  // Page heading
  await expect(page.getByRole('heading', { name: 'InvestPass Import' })).toBeVisible();

  // Connection status indicator
  await expect(page.getByTestId('connection-status')).toBeVisible();
  await expect(page.getByTestId('status-text')).toHaveText('Ready');

  // Period selector
  await expect(page.getByTestId('period-start')).toBeVisible();
  await expect(page.getByTestId('period-end')).toBeVisible();

  // Import button
  const importBtn = page.getByTestId('import-button');
  await expect(importBtn).toBeVisible();
  await expect(importBtn).toHaveText('Import from InvestPass');
});

test('clicking import without extension shows error', async ({ page }) => {
  await page.goto('/import/investpass');
  await page.getByRole('heading', { name: 'InvestPass Import' }).waitFor();

  // Click import — chrome.runtime is not available in Playwright, so it should error
  await page.getByTestId('import-button').click();

  // Should show error status
  await expect(page.getByTestId('status-text')).toHaveText('Error');
  await expect(page.getByTestId('import-error')).toContainText('not available');
});

test('navigating to /import/investpass directly works', async ({ page }) => {
  await page.goto('/import/investpass');
  await page.getByRole('heading', { name: 'InvestPass Import' }).waitFor();
  await expect(page.getByTestId('import-button')).toBeVisible();
});
