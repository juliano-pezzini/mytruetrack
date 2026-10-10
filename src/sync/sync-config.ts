/**
 * Sync configuration persistence — stores the active cloud provider config in IndexedDB.
 */

import { openDB } from 'idb';
import type { WebDavConfig } from './providers/webdav-provider.ts';
import type { StorageChoice } from './storage-choice.ts';

const DB_NAME = 'mytruetrack-sync-config';
const DB_VERSION = 1;
const STORE_NAME = 'config';
const CONFIG_KEY = 'active';

export type SyncProviderType = 'google-drive' | 'webdav' | null;

export type { StorageChoice };

export type GoogleTokens = {
  readonly accessToken: string;
  /** Epoch milliseconds at which the access token expires. */
  readonly expiresAt: number;
};

export type SyncConfig = {
  /** Present on every `loadSyncConfig` result; optional on older in-memory literals. */
  readonly storageChoice?: StorageChoice | null;
  readonly provider: SyncProviderType;
  readonly webdav: WebDavConfig | null;
  readonly google: GoogleTokens | null;
};

const DEFAULT_CONFIG: SyncConfig = {
  storageChoice: null,
  provider: null,
  webdav: null,
  google: null,
};

function parseStorageChoice(value: unknown): StorageChoice | null {
  if (value === 'google-drive' || value === 'webdav' || value === 'local-only') return value;
  return null;
}

function toStoredConfig(config: SyncConfig): SyncConfig {
  return {
    storageChoice: parseStorageChoice(config.storageChoice),
    provider: config.provider,
    webdav: config.webdav,
    google: config.google,
  };
}

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
  await db.put(STORE_NAME, toStoredConfig(config), CONFIG_KEY);
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, CONFIG_KEY);
  if (!stored) return DEFAULT_CONFIG;
  const config = stored as Partial<SyncConfig>;
  // Normalize older records that predate the `google` field or still have `refreshToken`.
  // Only accept a token object when both fields have the expected types; a corrupt or
  // partially-written record is treated as "not connected" rather than producing
  // `{ accessToken: undefined, expiresAt: undefined }` that breaks later expiry logic.
  const rawGoogle = config.google as (GoogleTokens & { refreshToken?: unknown }) | null | undefined;
  const google: GoogleTokens | null =
    rawGoogle &&
    typeof rawGoogle.accessToken === 'string' &&
    typeof rawGoogle.expiresAt === 'number'
      ? { accessToken: rawGoogle.accessToken, expiresAt: rawGoogle.expiresAt }
      : null;
  return {
    storageChoice: parseStorageChoice(config.storageChoice),
    provider: config.provider ?? null,
    webdav: config.webdav ?? null,
    google,
  };
}

export async function clearSyncConfig(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, CONFIG_KEY);
}
