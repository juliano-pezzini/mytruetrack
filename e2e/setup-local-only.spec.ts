import { test, expect } from '@playwright/test';
import { clearStorage, gotoApp } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await gotoApp(page);
});

test('welcome screen shows Get Started button', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'mytruetrack' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
});

test('skip passphrase → lands on dashboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: /Skip.*locally/i }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('skip passphrase → sidebar navigation is visible', async ({ page }) => {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: /Skip.*locally/i }).click();

  await expect(page.getByRole('link', { name: /Accounts/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Transactions/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Categories/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible();
});
