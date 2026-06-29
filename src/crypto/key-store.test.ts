import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveKeyData,
  loadKeyData,
  hasKeyData,
  clearKeyData,
  saveCredentialId,
  loadCredentialId,
  clearCredentialId,
  saveBiometricVault,
  loadBiometricVault,
  clearBiometricVault,
} from './key-store.ts';

describe('key-store', () => {
  beforeEach(async () => {
    // Clear between tests
    await clearKeyData();
  });

  it('returns null when no key data exists', async () => {
    const data = await loadKeyData();
    expect(data).toBeNull();
  });

  it('hasKeyData returns false when empty', async () => {
    expect(await hasKeyData()).toBe(false);
  });

  it('saves and loads key data', async () => {
    const keyData = {
      wrappedDek: new Uint8Array([1, 2, 3, 4, 5]),
      salt: new Uint8Array([10, 20, 30, 40]),
      iterations: 600_000,
    };

    await saveKeyData(keyData);

    const loaded = await loadKeyData();
    expect(loaded).not.toBeNull();
    expect(loaded!.wrappedDek).toEqual(keyData.wrappedDek);
    expect(loaded!.salt).toEqual(keyData.salt);
    expect(loaded!.iterations).toBe(600_000);
  });

  it('hasKeyData returns true after save', async () => {
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: new Uint8Array([2]),
      iterations: 1000,
    });

    expect(await hasKeyData()).toBe(true);
  });

  it('clearKeyData removes all data', async () => {
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: new Uint8Array([2]),
      iterations: 1000,
    });
    await saveCredentialId(new Uint8Array([99]));

    await clearKeyData();

    expect(await loadKeyData()).toBeNull();
    expect(await hasKeyData()).toBe(false);
    expect(await loadCredentialId()).toBeNull();
  });

  it('overwrites existing key data on save', async () => {
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: new Uint8Array([2]),
      iterations: 1000,
    });

    await saveKeyData({
      wrappedDek: new Uint8Array([10, 20]),
      salt: new Uint8Array([30, 40]),
      iterations: 600_000,
    });

    const loaded = await loadKeyData();
    expect(loaded!.wrappedDek).toEqual(new Uint8Array([10, 20]));
    expect(loaded!.iterations).toBe(600_000);
  });

  it('saves and loads credential ID', async () => {
    const credId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    await saveCredentialId(credId);

    const loaded = await loadCredentialId();
    expect(loaded).toEqual(credId);
  });

  it('returns null for credential when not set', async () => {
    expect(await loadCredentialId()).toBeNull();
  });

  it('clearCredentialId removes only the credential', async () => {
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: new Uint8Array([2]),
      iterations: 1000,
    });
    await saveCredentialId(new Uint8Array([99]));

    await clearCredentialId();

    expect(await loadCredentialId()).toBeNull();
    expect(await hasKeyData()).toBe(true); // key data still present
  });

  it('returns null when no biometric vault exists', async () => {
    expect(await loadBiometricVault()).toBeNull();
  });

  it('saves and loads biometric vault', async () => {
    const vault = {
      credentialId: new Uint8Array([1, 2, 3]),
      prfSalt: new Uint8Array([4, 5, 6, 7]),
      wrappedDek: new Uint8Array([8, 9, 10, 11, 12]),
    };
    await saveBiometricVault(vault);

    const loaded = await loadBiometricVault();
    expect(loaded).not.toBeNull();
    expect(loaded!.credentialId).toEqual(vault.credentialId);
    expect(loaded!.prfSalt).toEqual(vault.prfSalt);
    expect(loaded!.wrappedDek).toEqual(vault.wrappedDek);
  });

  it('clearBiometricVault removes only the biometric vault', async () => {
    await saveKeyData({
      wrappedDek: new Uint8Array([1]),
      salt: new Uint8Array([2]),
      iterations: 1000,
    });
    await saveBiometricVault({
      credentialId: new Uint8Array([1]),
      prfSalt: new Uint8Array([2]),
      wrappedDek: new Uint8Array([3]),
    });

    await clearBiometricVault();

    expect(await loadBiometricVault()).toBeNull();
    expect(await hasKeyData()).toBe(true);
  });

  it('clearKeyData also removes the biometric vault', async () => {
    await saveBiometricVault({
      credentialId: new Uint8Array([1]),
      prfSalt: new Uint8Array([2]),
      wrappedDek: new Uint8Array([3]),
    });

    await clearKeyData();

    expect(await loadBiometricVault()).toBeNull();
  });
});
