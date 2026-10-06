import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  freezeStorageChoice,
  inferStorageChoice,
  persistInferredStorageChoice,
  vaultActionsForProbe,
} from './storage-choice.ts';
import { clearSyncConfig, loadSyncConfig, saveSyncConfig } from './sync-config.ts';
import type { VaultMetadata } from './vault-metadata.ts';

const readyMetadata: VaultMetadata = {
  version: 1,
  wrappedDek: 'd2rhcHBlZA==',
  salt: 'c2FsdA==',
  iterations: 600_000,
  devices: {},
};

describe('vaultActionsForProbe', () => {
  it('allows create and skip for this-device-only, not restore', () => {
    expect(vaultActionsForProbe({ kind: 'local-only' })).toEqual({
      create: true,
      restore: false,
      skip: true,
    });
  });

  it('allows create and skip for an empty cloud folder, not restore', () => {
    expect(vaultActionsForProbe({ kind: 'empty' })).toEqual({
      create: true,
      restore: false,
      skip: true,
    });
  });

  it('offers restore only when vault metadata is ready', () => {
    expect(vaultActionsForProbe({ kind: 'ready', metadata: readyMetadata })).toEqual({
      create: false,
      restore: true,
      skip: false,
    });
  });

  it('blocks create, restore, and skip for leftover legacy segments', () => {
    expect(vaultActionsForProbe({ kind: 'legacy', segmentCount: 2 })).toEqual({
      create: false,
      restore: false,
      skip: false,
    });
  });

  it('blocks create, restore, and skip when vault metadata is corrupt', () => {
    expect(
      vaultActionsForProbe({ kind: 'corrupt', reason: 'Vault metadata is not valid JSON' }),
    ).toEqual({
      create: false,
      restore: false,
      skip: false,
    });
  });
});

const incomplete = { hasVault: false, skipped: false };

describe('inferStorageChoice', () => {
  it('returns an explicit storageChoice even when provider differs', () => {
    expect(
      inferStorageChoice(
        { storageChoice: 'local-only', provider: 'google-drive' },
        { hasVault: true, skipped: false },
      ),
    ).toBe('local-only');
  });

  it('infers google-drive from provider when storageChoice is missing', () => {
    expect(inferStorageChoice({ provider: 'google-drive' }, incomplete)).toBe('google-drive');
  });

  it('infers webdav from provider when storageChoice is missing', () => {
    expect(inferStorageChoice({ provider: 'webdav' }, incomplete)).toBe('webdav');
  });

  it('infers local-only when a vault exists and no provider is set', () => {
    expect(inferStorageChoice({ provider: null }, { hasVault: true, skipped: false })).toBe(
      'local-only',
    );
  });

  it('infers local-only when encryption was skipped and no provider is set', () => {
    expect(inferStorageChoice({ provider: null }, { hasVault: false, skipped: true })).toBe(
      'local-only',
    );
  });

  it('returns null during incomplete setup', () => {
    expect(inferStorageChoice({ provider: null }, incomplete)).toBeNull();
    expect(inferStorageChoice({ storageChoice: null, provider: null }, incomplete)).toBeNull();
  });
});

describe('freezeStorageChoice', () => {
  beforeEach(async () => {
    await clearSyncConfig();
  });

  it('sets storageChoice and keeps existing provider tokens', async () => {
    await saveSyncConfig({
      provider: 'google-drive',
      webdav: null,
      google: { accessToken: 'tok', expiresAt: 1_700_000_000_000 },
    });
    await freezeStorageChoice('google-drive');
    const loaded = await loadSyncConfig();
    expect(loaded.storageChoice).toBe('google-drive');
    expect(loaded.provider).toBe('google-drive');
    expect(loaded.google).toEqual({ accessToken: 'tok', expiresAt: 1_700_000_000_000 });
  });
});

describe('persistInferredStorageChoice', () => {
  beforeEach(async () => {
    await clearSyncConfig();
  });

  it('writes inferred local-only when a vault exists and nothing is stored', async () => {
    const choice = await persistInferredStorageChoice({ hasVault: true, skipped: false });
    expect(choice).toBe('local-only');
    expect((await loadSyncConfig()).storageChoice).toBe('local-only');
  });

  it('does not rewrite when stored choice already matches', async () => {
    await saveSyncConfig({
      storageChoice: 'google-drive',
      provider: 'google-drive',
      webdav: null,
      google: { accessToken: 'tok', expiresAt: 1 },
    });
    const choice = await persistInferredStorageChoice({ hasVault: true, skipped: false });
    expect(choice).toBe('google-drive');
    expect((await loadSyncConfig()).google).toEqual({ accessToken: 'tok', expiresAt: 1 });
  });

  it('does not freeze incomplete setup', async () => {
    const choice = await persistInferredStorageChoice({ hasVault: false, skipped: false });
    expect(choice).toBeNull();
    expect((await loadSyncConfig()).storageChoice).toBeNull();
  });
});
