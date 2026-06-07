import { test, expect } from '@playwright/test';
import { clearStorage, gotoApp } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await gotoApp(page);
});

test('create passphrase → recovery step → done → dashboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Create a passphrase' }).click();

  // Fill passphrase fields
  await page.getByLabel('Passphrase', { exact: true }).fill('correct-horse-battery-staple');
  await page.getByLabel('Confirm passphrase').fill('correct-horse-battery-staple');

  // This triggers PBKDF2 derivation (~2s)
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Save your recovery sheet').waitFor({ timeout: 10_000 });

  // Check "I've saved my recovery sheet" and continue
  await page.getByLabel(/saved my recovery sheet/i).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Either biometric step or done — skip biometric if shown
  const biometricHeading = page.getByRole('heading', { name: 'Quick unlock' });
  const doneHeading = page.getByRole('heading', { name: 'Your vault is ready' });

  const which = await Promise.race([
    biometricHeading.waitFor({ timeout: 3_000 }).then(() => 'biometric'),
    doneHeading.waitFor({ timeout: 3_000 }).then(() => 'done'),
  ]).catch(() => 'done');

  if (which === 'biometric') {
    await page.getByRole('button', { name: /Skip for now/i }).click();
  }

  await expect(page.getByRole('heading', { name: 'Your vault is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('passphrase too short shows error', async ({ page }) => {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Create a passphrase' }).click();

  await page.getByLabel('Passphrase', { exact: true }).fill('short');
  await page.getByLabel('Confirm passphrase').fill('short');

  // Button should be disabled (< 8 chars)
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

test('mismatched passphrases shows error', async ({ page }) => {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Create a passphrase' }).click();

  await page.getByLabel('Passphrase', { exact: true }).fill('correct-horse-battery-staple');
  await page.getByLabel('Confirm passphrase').fill('different-passphrase-here');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Passphrases do not match')).toBeVisible();
});
