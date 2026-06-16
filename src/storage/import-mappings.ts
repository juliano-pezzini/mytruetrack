/**
 * Persistence for reusable import column mappings.
 *
 * Stored in IndexedDB (mirroring the key-value pattern used by sync-config) so a user
 * can save a bank's column layout once and reuse it on subsequent imports.
 */

import { openDB } from 'idb';
import type { ColumnMapping, SavedMapping } from '../workers/types.ts';

const DB_NAME = 'mytruetrack-import-mappings';
const DB_VERSION = 1;
const STORE_NAME = 'mappings';

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

/** Return all saved mappings, most-recently-used first. */
export async function listMappings(): Promise<SavedMapping[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_NAME)) as SavedMapping[];
  return all.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/**
 * Return saved mappings applicable to an account: those scoped to it plus global
 * mappings (accountId === null), most-recently-used first.
 */
export async function listMappingsForAccount(accountId: string): Promise<SavedMapping[]> {
  const all = await listMappings();
  return all.filter((m) => m.accountId === null || m.accountId === accountId);
}

/**
 * Create and persist a new saved mapping. Returns the stored record.
 */
export async function saveMapping(params: {
  name: string;
  config: ColumnMapping;
  accountId?: string | null;
  isDefault?: boolean;
}): Promise<SavedMapping> {
  const record: SavedMapping = {
    id: crypto.randomUUID(),
    name: params.name.trim(),
    accountId: params.accountId ?? null,
    config: params.config,
    isDefault: params.isDefault ?? false,
    lastUsedAt: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE_NAME, record);
  return record;
}

/** Update the `lastUsedAt` timestamp for a mapping (called when one is reused). */
export async function touchMapping(id: string): Promise<void> {
  const db = await getDb();
  const existing = (await db.get(STORE_NAME, id)) as SavedMapping | undefined;
  if (!existing) return;
  await db.put(STORE_NAME, { ...existing, lastUsedAt: Date.now() });
}

/** Delete a saved mapping by id. */
export async function deleteMapping(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}
