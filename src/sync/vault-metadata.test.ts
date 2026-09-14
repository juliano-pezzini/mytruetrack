import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  parseVaultMetadata,
  serializeVaultMetadata,
  probeRemoteVault,
  deleteVaultMetadata,
  upsertVaultMetadata,
  restoreVaultFromRemote,
  VAULT_METADATA_FILENAME,
  type VaultMetadata,
} from './vault-metadata.ts';
import { createMockCloudProvider } from './mock-cloud-provider.ts';
import type { KeyData } from '../crypto/key-store.ts';
import { clearKeyData, hasKeyData, loadKeyData } from '../crypto/key-store.ts';
import {
  deriveKek,
  generateDek,
  generateSalt,
  wrapDek,
  DEFAULT_ITERATIONS,
} from '../crypto/key-derivation.ts';

const sampleMeta: VaultMetadata = {
  version: 1,
  wrappedDek: 'd2rhcHBlZA==',
  salt: 'c2FsdA==',
  iterations: 600_000,
  devices: {
    aa: {
      label: 'Chrome · Windows',
      browser: 'chrome',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    },
  },
};

describe('vault-metadata codec', () => {
  it('round-trips serialize → parse preserving fields', () => {
    const bytes = serializeVaultMetadata(sampleMeta);
    const restored = parseVaultMetadata(bytes);
    expect(restored).toEqual(sampleMeta);
  });

  it('rejects invalid JSON', () => {
    const bytes = new TextEncoder().encode('not json');
    expect(() => parseVaultMetadata(bytes)).toThrow(/valid JSON/i);
  });

  it('rejects missing required top-level fields', () => {
    const incomplete = new TextEncoder().encode(JSON.stringify({ version: 1 }));
    expect(() => parseVaultMetadata(incomplete)).toThrow(/wrappedDek/i);
  });

  it('rejects wrong schema version', () => {
    const bytes = serializeVaultMetadata({ ...sampleMeta, version: 2 as 1 });
    expect(() => parseVaultMetadata(bytes)).toThrow(/version must be 1/i);
  });

  it('rejects device entries missing label', () => {
    const bad = {
      ...sampleMeta,
      devices: { aa: { browser: 'chrome', lastSeenAt: '2026-01-01T00:00:00.000Z' } },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(bad));
    expect(() => parseVaultMetadata(bytes)).toThrow(/label is required/i);
  });
});

describe('probeRemoteVault', () => {
  it('returns empty when folder has no metadata or segments', async () => {
    const provider = createMockCloudProvider();
    expect(await probeRemoteVault(provider)).toEqual({ kind: 'empty' });
  });

  it('returns ready when metadata parses', async () => {
    const provider = createMockCloudProvider();
    await provider.upload(VAULT_METADATA_FILENAME, serializeVaultMetadata(sampleMeta));
    const status = await probeRemoteVault(provider);
    expect(status.kind).toBe('ready');
    if (status.kind === 'ready') {
      expect(status.metadata).toEqual(sampleMeta);
    }
  });

  it('returns corrupt when metadata is invalid JSON', async () => {
    const provider = createMockCloudProvider();
    await provider.upload(VAULT_METADATA_FILENAME, new TextEncoder().encode('{'));
    const status = await probeRemoteVault(provider);
    expect(status.kind).toBe('corrupt');
  });

  it('returns legacy when segments exist without metadata', async () => {
    const provider = createMockCloudProvider();
    await provider.upload('changes-aa-1.bin', new Uint8Array([1]));
    expect(await probeRemoteVault(provider)).toEqual({ kind: 'legacy', segmentCount: 1 });
  });
});

describe('upsertVaultMetadata', () => {
  const keyA: KeyData = {
    wrappedDek: new Uint8Array([1, 2, 3]),
    salt: new Uint8Array([9, 9]),
    iterations: 600_000,
  };
  const keyB: KeyData = {
    wrappedDek: new Uint8Array([4, 5, 6]),
    salt: new Uint8Array([8, 8]),
    iterations: 500_000,
  };

  it('creates metadata when remote file is missing', async () => {
    const provider = createMockCloudProvider();
    await upsertVaultMetadata(provider, {
      siteId: 'aa',
      keyData: keyA,
      label: 'Laptop',
      browser: 'chrome',
    });

    const raw = await provider.download(VAULT_METADATA_FILENAME);
    const meta = parseVaultMetadata(raw!);
    expect(meta.wrappedDek).toBe('AQID');
    expect(meta.salt).toBe('CQk=');
    expect(meta.iterations).toBe(600_000);
    expect(meta.devices.aa).toMatchObject({ label: 'Laptop', browser: 'chrome' });
    expect(meta.devices.aa!.lastSeenAt.length).toBeGreaterThan(0);
  });

  it('merges device registry and refreshes key fields from local KeyData', async () => {
    const provider = createMockCloudProvider();
    const existing: VaultMetadata = {
      version: 1,
      wrappedDek: 'old',
      salt: 'old',
      iterations: 1,
      devices: {
        bb: {
          label: 'Phone',
          browser: 'chrome',
          lastSeenAt: '2020-01-01T00:00:00.000Z',
        },
      },
    };
    await provider.upload(VAULT_METADATA_FILENAME, serializeVaultMetadata(existing));

    await upsertVaultMetadata(provider, {
      siteId: 'aa',
      keyData: keyB,
      label: 'Desktop',
      browser: 'firefox',
    });

    const meta = parseVaultMetadata((await provider.download(VAULT_METADATA_FILENAME))!);
    expect(meta.wrappedDek).toBe('BAUG');
    expect(meta.salt).toBe('CAg=');
    expect(meta.iterations).toBe(500_000);
    expect(meta.devices.bb).toEqual(existing.devices.bb);
    expect(meta.devices.aa!.label).toBe('Desktop');
  });
});

describe('restoreVaultFromRemote', () => {
  const passphrase = 'correct horse battery';

  beforeEach(async () => {
    await clearKeyData();
  });

  async function seedRemoteMetadata(provider: ReturnType<typeof createMockCloudProvider>) {
    const dek = await generateDek();
    const salt = generateSalt();
    const kek = await deriveKek(passphrase, salt, DEFAULT_ITERATIONS);
    const wrappedDek = await wrapDek(dek, kek);
    const meta: VaultMetadata = {
      version: 1,
      wrappedDek: btoa(String.fromCharCode(...wrappedDek)),
      salt: btoa(String.fromCharCode(...salt)),
      iterations: DEFAULT_ITERATIONS,
      devices: {},
    };
    await provider.upload(VAULT_METADATA_FILENAME, serializeVaultMetadata(meta));
    return dek;
  }

  it('persists key data and returns DEK on correct passphrase', async () => {
    const provider = createMockCloudProvider();
    const expectedDek = await seedRemoteMetadata(provider);

    const dek = await restoreVaultFromRemote(provider, passphrase);
    expect(await hasKeyData()).toBe(true);
    const stored = await loadKeyData();
    expect(stored).not.toBeNull();

    const { encrypt, decrypt } = await import('../crypto/encryption.ts');
    const payload = new TextEncoder().encode('restore-check');
    const fromExpected = await encrypt(expectedDek, payload);
    expect(await decrypt(dek, fromExpected)).toEqual(payload);

    const kek = await deriveKek(passphrase, stored!.salt, stored!.iterations);
    const { unwrapDek } = await import('../crypto/key-derivation.ts');
    const unwrapped = await unwrapDek(stored!.wrappedDek, kek);
    const roundTrip = await encrypt(unwrapped, payload);
    expect(await decrypt(dek, roundTrip)).toEqual(payload);
  });

  it('throws on wrong passphrase without writing key store', async () => {
    const provider = createMockCloudProvider();
    await seedRemoteMetadata(provider);

    await expect(restoreVaultFromRemote(provider, 'wrong passphrase')).rejects.toThrow(
      /passphrase|unwrap/i,
    );
    expect(await hasKeyData()).toBe(false);
  });

  it('throws on corrupt metadata without writing key store', async () => {
    const provider = createMockCloudProvider();
    await provider.upload(VAULT_METADATA_FILENAME, new TextEncoder().encode('{'));

    await expect(restoreVaultFromRemote(provider, passphrase)).rejects.toThrow(/restore vault/i);
    expect(await hasKeyData()).toBe(false);
  });
});

describe('deleteVaultMetadata', () => {
  it('removes metadata when present and no-ops when absent', async () => {
    const provider = createMockCloudProvider();
    expect(await deleteVaultMetadata(provider)).toBe(false);

    await provider.upload(VAULT_METADATA_FILENAME, serializeVaultMetadata(sampleMeta));
    expect(await deleteVaultMetadata(provider)).toBe(true);
    expect(await provider.download(VAULT_METADATA_FILENAME)).toBeNull();
    expect(await deleteVaultMetadata(provider)).toBe(false);
  });
});
