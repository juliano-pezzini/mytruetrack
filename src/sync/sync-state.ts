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
  /** Highest local cr-sqlite `db_version` already shipped in a pushed delta segment. */
  readonly lastPushedVersion: number;
  /** Per-peer high-water mark: peer site id → highest segment version already applied. */
  readonly appliedPeerVersions: Readonly<Record<string, number>>;
  readonly lastPushedAt: string | null;
  readonly lastPulledAt: string | null;
};

const DEFAULT_STATE: SyncState = {
  lastPushedVersion: 0,
  appliedPeerVersions: {},
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
  // Merge over defaults so records written before `appliedPeerVersions` existed still load.
  return { ...DEFAULT_STATE, ...(stored as Partial<SyncState>) };
}

/** Update push state after a successful push (records the shipped `db_version` watermark). */
export async function savePushState(version: number): Promise<void> {
  const db = await getDb();
  const current = await getSyncState();
  await db.put(
    STORE_NAME,
    {
      ...current,
      lastPushedVersion: version,
      lastPushedAt: new Date().toISOString(),
    },
    STATE_KEY,
  );
}

/**
 * Update pull state after a successful pull. Pass the updated per-peer applied versions to
 * advance the high-water marks; omit to only refresh the `lastPulledAt` timestamp.
 */
export async function savePullState(
  appliedPeerVersions?: Readonly<Record<string, number>>,
): Promise<void> {
  const db = await getDb();
  const current = await getSyncState();
  await db.put(
    STORE_NAME,
    {
      ...current,
      appliedPeerVersions: appliedPeerVersions ?? current.appliedPeerVersions,
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
