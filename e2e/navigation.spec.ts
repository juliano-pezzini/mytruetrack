import { test, expect } from '@playwright/test';
import { setupLocalOnly } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await setupLocalOnly(page);
});

test('sidebar links navigate to correct pages', async ({ page }) => {
  const navItems: Array<{ link: string; heading: string }> = [
    { link: 'Accounts', heading: 'Accounts' },
    { link: 'Transactions', heading: 'Transactions' },
    { link: 'Categories', heading: 'Categories & Tags' },
    { link: 'Settings', heading: 'Settings' },
    { link: 'Dashboard', heading: 'Dashboard' },
  ];

  for (const { link, heading } of navItems) {
    await page.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('page header shows correct title for each route', async ({ page }) => {
  const routes: Array<{ path: string; title: string }> = [
    { path: '/', title: 'Dashboard' },
    { path: '/accounts', title: 'Accounts' },
    { path: '/transactions', title: 'Transactions' },
    { path: '/categories', title: 'Categories & Tags' },
    { path: '/settings', title: 'Settings' },
  ];

  for (const { path, title } of routes) {
    await page.goto(path);
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
      timeout: 10_000,
    });
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
});

test('active nav link is highlighted', async ({ page }) => {
  await page.getByRole('link', { name: 'Accounts' }).click();
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();

  // The active link should have the blue styling class
  const accountsLink = page.getByRole('link', { name: 'Accounts' });
  await expect(accountsLink).toHaveClass(/text-blue-700/);
});

test('mobile: hamburger button is visible at small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });

  const hamburger = page.getByRole('button', { name: 'Toggle navigation' });
  await expect(hamburger).toBeVisible();
});

test('mobile: hamburger opens sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });

  // Sidebar is initially hidden on mobile
  const sidebar = page.locator('aside');
  await expect(sidebar).toHaveClass(/-translate-x-full/);

  // Open it
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(sidebar).not.toHaveClass(/-translate-x-full/);

  // Navigate via sidebar link
  await page.getByRole('link', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
});
