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

export type KeyData = {
  readonly wrappedDek: Uint8Array;
  readonly salt: Uint8Array;
  readonly iterations: number;
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
  await db.put(STORE_NAME, {
    wrappedDek: data.wrappedDek,
    salt: data.salt,
    iterations: data.iterations,
  }, KEY_DATA_KEY);
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
