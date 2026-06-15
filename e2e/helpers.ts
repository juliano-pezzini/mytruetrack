import { type Page } from '@playwright/test';

/**
 * Clear all browser storage (localStorage, sessionStorage, IndexedDB) so each test
 * starts with a clean slate. Navigates to the app first to operate in the right origin.
 */
export async function clearStorage(page: Page): Promise<void> {
  // Must be on the app origin to access its IndexedDB
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    // Delete all IndexedDB databases (SQLite-WASM stores data here)
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map((db) =>
        db.name
          ? new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name!);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
          : Promise.resolve(),
      ),
    );
    // Brief pause to let deletions propagate
    await new Promise<void>((r) => setTimeout(r, 50));
  });
}

/**
 * Navigate to the app and wait for the vault gate to finish its initial check.
 */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading…'), {
    timeout: 10_000,
  });
}

/**
 * Set up the vault in local-only mode (no passphrase).
 * Leaves the page on the Dashboard.
 */
export async function setupLocalOnly(page: Page): Promise<void> {
  await clearStorage(page); // navigate to '/' and wipe all storage
  await gotoApp(page); // reload with empty storage → vault shows needs-setup
  // Welcome → Get Started
  await page.getByRole('button', { name: 'Get Started' }).click();
  // Choice → Skip (local-only)
  await page.getByRole('button', { name: /Skip.*passphrase/i }).click();
  await page.waitForURL('/');
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
}
