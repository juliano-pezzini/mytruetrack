import { describe, it, expect } from 'vitest';
import {
  parseVaultMetadata,
  serializeVaultMetadata,
  type VaultMetadata,
} from './vault-metadata.ts';

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
