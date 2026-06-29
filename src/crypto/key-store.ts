/**
 * Key store — IndexedDB persistence for wrapped DEK + salt + iterations.
 *
 * Uses the `idb` library for a typed IndexedDB interface.
 * The wrapped DEK is the only secret stored; it requires the user's
 * passphrase-derived KEK to unwrap.
 */

import { openDB } from 'idb';

const DB_NAME = 'mytruetrack-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_DATA_KEY = 'vault';
const CREDENTIAL_KEY = 'webauthn-credential';
const BIOMETRIC_VAULT_KEY = 'biometric-vault';

export type KeyData = {
  readonly wrappedDek: Uint8Array;
  readonly salt: Uint8Array;
  readonly iterations: number;
};

/**
 * Biometric unlock material. The DEK is wrapped under a KEK derived from the
 * WebAuthn PRF output, so it can be unwrapped after a fingerprint/face prompt
 * without ever caching the passphrase or a plaintext key.
 */
export type BiometricVault = {
  readonly credentialId: Uint8Array;
  readonly prfSalt: Uint8Array;
  readonly wrappedDek: Uint8Array;
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

/** Persist wrapped DEK + salt + iterations. */
export async function saveKeyData(data: KeyData): Promise<void> {
  const db = await getDb();
  await db.put(
    STORE_NAME,
    {
      wrappedDek: data.wrappedDek,
      salt: data.salt,
      iterations: data.iterations,
    },
    KEY_DATA_KEY,
  );
}

/** Load persisted key data, or null if no vault exists. */
export async function loadKeyData(): Promise<KeyData | null> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, KEY_DATA_KEY);
  if (!stored) return null;
  return {
    wrappedDek: stored.wrappedDek as Uint8Array,
    salt: stored.salt as Uint8Array,
    iterations: stored.iterations as number,
  };
}

/** Check if a vault has been set up on this device. */
export async function hasKeyData(): Promise<boolean> {
  const data = await loadKeyData();
  return data !== null;
}

/** Remove all key data (for reset/recovery flow). */
export async function clearKeyData(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, KEY_DATA_KEY);
  await db.delete(STORE_NAME, CREDENTIAL_KEY);
  await db.delete(STORE_NAME, BIOMETRIC_VAULT_KEY);
}

/** Persist a WebAuthn credential ID. */
export async function saveCredentialId(id: Uint8Array): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, { credentialId: id }, CREDENTIAL_KEY);
}

/** Load the stored WebAuthn credential ID, or null. */
export async function loadCredentialId(): Promise<Uint8Array | null> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, CREDENTIAL_KEY);
  if (!stored) return null;
  return stored.credentialId as Uint8Array;
}

/** Remove only the WebAuthn credential. */
export async function clearCredentialId(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, CREDENTIAL_KEY);
}

/** Persist the biometric (PRF-wrapped) vault material. */
export async function saveBiometricVault(vault: BiometricVault): Promise<void> {
  const db = await getDb();
  await db.put(
    STORE_NAME,
    {
      credentialId: vault.credentialId,
      prfSalt: vault.prfSalt,
      wrappedDek: vault.wrappedDek,
    },
    BIOMETRIC_VAULT_KEY,
  );
}

/** Load biometric vault material, or null if biometric unlock is not set up. */
export async function loadBiometricVault(): Promise<BiometricVault | null> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, BIOMETRIC_VAULT_KEY);
  if (!stored) return null;
  return {
    credentialId: stored.credentialId as Uint8Array,
    prfSalt: stored.prfSalt as Uint8Array,
    wrappedDek: stored.wrappedDek as Uint8Array,
  };
}

/** Remove only the biometric vault material. */
export async function clearBiometricVault(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, BIOMETRIC_VAULT_KEY);
}
