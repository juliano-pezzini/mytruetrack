import { test, expect } from '@playwright/test';
import { clearStorage, gotoApp } from './helpers.ts';

test('vault locked after reload → unlock page shown', async ({ page }) => {
  await clearStorage(page);
  await gotoApp(page);

  // Setup with passphrase
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Create a passphrase' }).click();
  await page.getByLabel('Passphrase', { exact: true }).fill('correct-horse-battery-staple');
  await page.getByLabel('Confirm passphrase').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Save your recovery sheet').waitFor({ timeout: 10_000 });
  await page.getByLabel(/saved my recovery sheet/i).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Skip biometric if present
  const skipBtn = page.getByRole('button', { name: /Skip for now/i });
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click();
  }
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();

  // Reload → should need unlock
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('p')?.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });

  await expect(page.getByText('Enter your passphrase to unlock')).toBeVisible();
});

test('unlock with correct passphrase → dashboard', async ({ page }) => {
  await clearStorage(page);
  await gotoApp(page);

  // Setup
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Create a passphrase' }).click();
  await page.getByLabel('Passphrase', { exact: true }).fill('correct-horse-battery-staple');
  await page.getByLabel('Confirm passphrase').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Save your recovery sheet').waitFor({ timeout: 10_000 });
  await page.getByLabel(/saved my recovery sheet/i).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  const skipBtn = page.getByRole('button', { name: /Skip for now/i });
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click();
  }
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();

  // Reload and unlock
  await page.reload();
  await page.getByText('Enter your passphrase to unlock').waitFor({ timeout: 10_000 });
  await page.getByLabel('Passphrase').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Unlock' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 });
});

test('unlock with wrong passphrase → error', async ({ page }) => {
  await clearStorage(page);
  await gotoApp(page);

  // Setup
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Create a passphrase' }).click();
  await page.getByLabel('Passphrase', { exact: true }).fill('correct-horse-battery-staple');
  await page.getByLabel('Confirm passphrase').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Save your recovery sheet').waitFor({ timeout: 10_000 });
  await page.getByLabel(/saved my recovery sheet/i).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  const skipBtn = page.getByRole('button', { name: /Skip for now/i });
  if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipBtn.click();
  }
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();

  // Reload and try wrong passphrase
  await page.reload();
  await page.getByText('Enter your passphrase to unlock').waitFor({ timeout: 10_000 });
  await page.getByLabel('Passphrase').fill('wrong-passphrase');
  await page.getByRole('button', { name: 'Unlock' }).click();

  await expect(page.getByText('Incorrect passphrase')).toBeVisible({ timeout: 10_000 });
});
