/**
 * Persistence for InvestPass account name → mytruetrack account ID mappings.
 *
 * Stored in IndexedDB so users don't have to re-map accounts on every import.
 */

import { openDB } from 'idb';

const DB_NAME = 'mytruetrack-investpass-account-map';
const DB_VERSION = 1;
const STORE_NAME = 'account-map';

export type AccountMapEntry = {
  readonly investPassAccountName: string;
  readonly mytruetrackAccountId: string;
  readonly lastImportedDate: string | null;
};

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'investPassAccountName' });
      }
    },
  });
}

/** Return all saved account mappings. */
export async function getAccountMap(): Promise<AccountMapEntry[]> {
  const db = await getDb();
  return (await db.getAll(STORE_NAME)) as AccountMapEntry[];
}

/** Return the mapping for a specific InvestPass account name. */
export async function getMapping(investPassName: string): Promise<AccountMapEntry | undefined> {
  const db = await getDb();
  return (await db.get(STORE_NAME, investPassName)) as AccountMapEntry | undefined;
}

/** Save (or overwrite) an account mapping. */
export async function saveMapping(entry: AccountMapEntry): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, entry);
}

/** Update the lastImportedDate for a specific account mapping. */
export async function updateLastImportedDate(
  investPassName: string,
  date: string,
): Promise<void> {
  const db = await getDb();
  const existing = (await db.get(STORE_NAME, investPassName)) as AccountMapEntry | undefined;
  if (!existing) return;
  await db.put(STORE_NAME, { ...existing, lastImportedDate: date });
}

/** Delete a mapping by InvestPass account name. */
export async function deleteMapping(investPassName: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, investPassName);
}
