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
 * Biometric unlock material. Two modes:
 *
 * - `prf`: the DEK is wrapped under a KEK derived from the WebAuthn PRF output.
 *   Nothing extra is persisted — the KEK only exists during a biometric prompt.
 *   Preferred; requires authenticator PRF/hmac-secret support.
 *
 * - `wrapped-key`: fallback for authenticators without PRF (e.g. many Windows
 *   Hello configs). The DEK is wrapped under a random **non-extractable**
 *   AES-KW key stored as a `CryptoKey` in IndexedDB. The key is not bound to a
 *   biometric assertion: while the app's unlock flow prompts for biometric
 *   first, any same-origin script (including an XSS payload) can read this
 *   record and call `crypto.subtle.unwrapKey` directly without proving user
 *   presence. The only hard protection is non-extractability — the raw key
 *   bytes can never be exported. Weaker than PRF (which binds the KEK to the
 *   assertion), but still far stronger than caching a plaintext key.
 */
export type PrfBiometricVault = {
  readonly mode: 'prf';
  readonly credentialId: Uint8Array;
  readonly prfSalt: Uint8Array;
  readonly wrappedDek: Uint8Array;
};

export type WrappedKeyBiometricVault = {
  readonly mode: 'wrapped-key';
  readonly credentialId: Uint8Array;
  readonly kek: CryptoKey;
  readonly wrappedDek: Uint8Array;
};

export type BiometricVault = PrfBiometricVault | WrappedKeyBiometricVault;

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

/** Persist the biometric vault material (PRF or wrapped-key fallback). */
export async function saveBiometricVault(vault: BiometricVault): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, vault, BIOMETRIC_VAULT_KEY);
}

/** Load biometric vault material, or null if biometric unlock is not set up. */
export async function loadBiometricVault(): Promise<BiometricVault | null> {
  const db = await getDb();
  const stored = (await db.get(STORE_NAME, BIOMETRIC_VAULT_KEY)) as BiometricVault | undefined;
  return stored ?? null;
}

/** Remove only the biometric vault material. */
export async function clearBiometricVault(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, BIOMETRIC_VAULT_KEY);
}
