import { describe, it, expect } from 'vitest';
import {
  parseVaultMetadata,
  serializeVaultMetadata,
  probeRemoteVault,
  deleteVaultMetadata,
  VAULT_METADATA_FILENAME,
  type VaultMetadata,
} from './vault-metadata.ts';
import { createMockCloudProvider } from './mock-cloud-provider.ts';

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
