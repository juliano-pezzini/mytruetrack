import { describe, it, expect } from 'vitest';
import { vaultActionsForProbe } from './storage-choice.ts';
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
