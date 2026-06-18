import { type Page } from '@playwright/test';

/**
 * Clear all browser storage (localStorage, sessionStorage, IndexedDB) so each test
 * starts with a clean slate. Navigates to the app first to operate in the right origin.
 */
export async function clearStorage(page: Page): Promise<void> {
  // Navigate to a static asset (NOT the SPA entry) so the app never boots and never
  // opens the OPFS database — otherwise cr-sqlite holds SyncAccessHandle locks and the
  // OPFS files cannot be removed.
  await page.goto('/manifest.json');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    // Delete all IndexedDB databases (sync state, key store, etc.)
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
    // Wipe OPFS (cr-sqlite persists the SQLite database file here).
    const storage = navigator.storage as StorageManager & {
      getDirectory?: () => Promise<FileSystemDirectoryHandle>;
    };
    if (storage.getDirectory) {
      try {
        const root = await storage.getDirectory();
        const names: string[] = [];
        for await (const name of (
          root as FileSystemDirectoryHandle & { keys: () => AsyncIterable<string> }
        ).keys()) {
          names.push(name);
        }
        await Promise.all(
          names.map((name) => root.removeEntry(name, { recursive: true }).catch(() => {})),
        );
      } catch {
        // OPFS unavailable or busy — ignore.
      }
    }
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
