import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
  await page.getByRole('link', { name: /Accounts/i }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
});

test('empty state shows prompt to create an account', async ({ page }) => {
  await expect(page.getByText('No accounts yet')).toBeVisible();
});

test('create a bank account', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Account' }).click();

  await page.getByLabel('Name').fill('Main Checking');
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('1000.00');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Main Checking' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bank' })).toBeVisible();
});

test('create a credit card account', async ({ page }) => {
  await page.getByRole('button', { name: '+ New Account' }).click();

  await page.getByLabel('Name').fill('Visa Card');
  await page.getByLabel('Type').selectOption('credit_card');
  await page.getByLabel('Initial Balance').fill('0.00');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Visa Card' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Credit Card' })).toBeVisible();
});

test('edit an account name', async ({ page }) => {
  // Create first
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill('Old Name');
  await page.getByLabel('Type').selectOption('bank');
  await page.getByLabel('Initial Balance').fill('0.00');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'Old Name' }).waitFor();

  // Edit
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Name').fill('New Name');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('cell', { name: 'New Name' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Old Name' })).not.toBeVisible();
});

test('delete an account with confirmation', async ({ page }) => {
  // Create first
  await page.getByRole('button', { name: '+ New Account' }).click();
  await page.getByLabel('Name').fill('To Be Deleted');
  await page.getByLabel('Type').selectOption('wallet');
  await page.getByLabel('Initial Balance').fill('50.00');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('cell', { name: 'To Be Deleted' }).waitFor();

  // Delete
  await page.getByRole('button', { name: 'Delete' }).click();
  // Confirm dialog
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).last().click();

  await expect(page.getByRole('cell', { name: 'To Be Deleted' })).not.toBeVisible();
});

test('type filter narrows visible accounts', async ({ page }) => {
  // Create bank and wallet
  for (const [name, type] of [
    ['My Bank', 'bank'],
    ['My Wallet', 'wallet'],
  ]) {
    await page.getByRole('button', { name: '+ New Account' }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Type').selectOption(type);
    await page.getByLabel('Initial Balance').fill('0.00');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('cell', { name }).waitFor();
  }

  // Filter by Bank
  await page.getByRole('button', { name: 'Bank' }).click();
  await expect(page.getByRole('cell', { name: 'My Bank' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'My Wallet' })).not.toBeVisible();

  // Filter by Wallet
  await page.getByRole('button', { name: 'Wallet' }).click();
  await expect(page.getByRole('cell', { name: 'My Wallet' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'My Bank' })).not.toBeVisible();
});
