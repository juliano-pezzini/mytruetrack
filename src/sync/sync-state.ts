/**
 * Sync state — tracks what has been synced to avoid redundant operations.
 * Persisted in IndexedDB.
 */

import { openDB } from 'idb';

const DB_NAME = 'mytruetrack-sync-state';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const STATE_KEY = 'sync';

export type SyncState = {
  readonly lastPushedVersion: number;
  readonly lastPushedAt: string | null;
  readonly lastPulledAt: string | null;
};

const DEFAULT_STATE: SyncState = {
  lastPushedVersion: 0,
  lastPushedAt: null,
  lastPulledAt: null,
};

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

/** Get the current sync state, or defaults if never synced. */
export async function getSyncState(): Promise<SyncState> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, STATE_KEY);
  if (!stored) return DEFAULT_STATE;
  return stored as SyncState;
}

/** Update push state after a successful push. */
export async function savePushState(version: number): Promise<void> {
  const db = await getDb();
  const current = await getSyncState();
  await db.put(
    STORE_NAME,
    {
      lastPushedVersion: version,
      lastPushedAt: new Date().toISOString(),
      lastPulledAt: current.lastPulledAt,
    },
    STATE_KEY,
  );
}

/** Update pull state after a successful pull. */
export async function savePullState(): Promise<void> {
  const db = await getDb();
  const current = await getSyncState();
  await db.put(
    STORE_NAME,
    {
      lastPushedVersion: current.lastPushedVersion,
      lastPushedAt: current.lastPushedAt,
      lastPulledAt: new Date().toISOString(),
    },
    STATE_KEY,
  );
}

/** Reset sync state to defaults. */
export async function clearSyncState(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, STATE_KEY);
}
