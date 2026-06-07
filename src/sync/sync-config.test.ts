import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { saveSyncConfig, loadSyncConfig, clearSyncConfig, type SyncConfig } from './sync-config.ts';

describe('sync-config', () => {
  beforeEach(async () => {
    await clearSyncConfig();
  });

  it('loadSyncConfig returns default when nothing saved', async () => {
    const config = await loadSyncConfig();
    expect(config.provider).toBeNull();
    expect(config.webdav).toBeNull();
  });

  it('saveSyncConfig + loadSyncConfig round-trips webdav config', async () => {
    const config: SyncConfig = {
      provider: 'webdav',
      webdav: {
        endpoint: 'https://cloud.example.com/dav/',
        syncFolder: 'mytruetrack/',
        username: 'user',
        password: 'pass',
      },
      google: null,
    };

    await saveSyncConfig(config);
    const loaded = await loadSyncConfig();

    expect(loaded.provider).toBe('webdav');
    expect(loaded.webdav).toEqual(config.webdav);
  });

  it('saveSyncConfig + loadSyncConfig round-trips google-drive tokens', async () => {
    const config: SyncConfig = {
      provider: 'google-drive',
      webdav: null,
      google: {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresAt: 1_700_000_000_000,
      },
    };

    await saveSyncConfig(config);
    const loaded = await loadSyncConfig();

    expect(loaded.provider).toBe('google-drive');
    expect(loaded.google).toEqual(config.google);
  });

  it('saveSyncConfig + loadSyncConfig round-trips google-drive config', async () => {
    const config: SyncConfig = {
      provider: 'google-drive',
      webdav: null,
      google: null,
    };

    await saveSyncConfig(config);
    const loaded = await loadSyncConfig();

    expect(loaded.provider).toBe('google-drive');
    expect(loaded.webdav).toBeNull();
  });

  it('loadSyncConfig normalizes records missing the google field', async () => {
    const db = await openDB('mytruetrack-sync-config', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('config')) {
          database.createObjectStore('config');
        }
      },
    });
    await db.put('config', { provider: 'webdav', webdav: null }, 'active');

    const loaded = await loadSyncConfig();

    expect(loaded.provider).toBe('webdav');
    expect(loaded.google).toBeNull();
  });

  it('clearSyncConfig resets to default', async () => {
    await saveSyncConfig({
      provider: 'webdav',
      webdav: {
        endpoint: 'https://example.com',
        syncFolder: 'test/',
        username: 'u',
        password: 'p',
      },
      google: null,
    });

    await clearSyncConfig();
    const config = await loadSyncConfig();

    expect(config.provider).toBeNull();
    expect(config.webdav).toBeNull();
  });

  it('overwriting config replaces previous value', async () => {
    await saveSyncConfig({
      provider: 'webdav',
      webdav: { endpoint: 'https://old.com', syncFolder: 'old/', username: 'a', password: 'b' },
      google: null,
    });

    await saveSyncConfig({
      provider: 'google-drive',
      webdav: null,
      google: null,
    });

    const loaded = await loadSyncConfig();
    expect(loaded.provider).toBe('google-drive');
    expect(loaded.webdav).toBeNull();
  });
});
