/**
 * Sync configuration persistence — stores the active cloud provider config in IndexedDB.
 */

import { openDB } from 'idb';
import type { WebDavConfig } from './providers/webdav-provider.ts';

const DB_NAME = 'mytruetrack-sync-config';
const DB_VERSION = 1;
const STORE_NAME = 'config';
const CONFIG_KEY = 'active';

export type SyncProviderType = 'google-drive' | 'webdav' | null;

export type SyncConfig = {
  readonly provider: SyncProviderType;
  readonly webdav: WebDavConfig | null;
};

const DEFAULT_CONFIG: SyncConfig = {
  provider: null,
  webdav: null,
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

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, config, CONFIG_KEY);
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, CONFIG_KEY);
  if (!stored) return DEFAULT_CONFIG;
  return stored as SyncConfig;
}

export async function clearSyncConfig(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, CONFIG_KEY);
}
