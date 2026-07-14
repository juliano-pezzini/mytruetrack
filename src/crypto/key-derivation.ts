/**
 * Key derivation — PBKDF2 passphrase → KEK → wrap/unwrap DEK.
 *
 * Pipeline:
 *   passphrase + salt → PBKDF2 (600k iterations, SHA-256) → KEK (AES-KW-256)
 *   KEK wraps/unwraps DEK (AES-GCM-256)
 *
 * The DEK is the data encryption key used for all encrypt/decrypt operations.
 * The KEK never leaves memory; the wrapped DEK is persisted in IndexedDB.
 */

export const DEFAULT_ITERATIONS = 600_000;
export const SALT_LENGTH = 16;

const encoder = new TextEncoder();

/** Generate a random salt for key derivation. */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Derive a Key Encryption Key (KEK) from a passphrase via PBKDF2.
 * Returns a non-extractable AES-KW key.
 */
export async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<CryptoKey> {
  if (passphrase.length === 0) {
    throw new Error('Passphrase must not be empty');
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/**
 * Derive a Key Encryption Key (KEK) from WebAuthn PRF output bytes.
 *
 * The PRF extension yields 32 high-entropy bytes that are bound to the
 * platform authenticator and never persisted. We stretch them with HKDF
 * (cheap, since the input is already strong) into a non-extractable AES-KW
 * key used only to wrap/unwrap the DEK.
 *
 * @throws {Error} If `prfOutput` is shorter than 32 bytes.
 */
export async function deriveKekFromPrf(prfOutput: Uint8Array): Promise<CryptoKey> {
  if (prfOutput.length < 32) {
    throw new Error('PRF output too short to derive a key');
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(prfOutput).buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: encoder.encode('mytruetrack-biometric-kek'),
    },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/**
 * Generate a fresh random **non-extractable** AES-KW wrapping key.
 *
 * Used by the biometric wrapped-key fallback (authenticators without PRF): the
 * key can wrap/unwrap the DEK but can never be exported from the CryptoKey, so
 * it is safe to persist as a `CryptoKey` in IndexedDB.
 */
export async function generateWrappingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-KW', length: 256 }, false, [
    'wrapKey',
    'unwrapKey',
  ]);
}

/**
 * Generate a fresh Data Encryption Key (DEK).
 * Extractable so it can be wrapped by the KEK.
 */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Wrap (encrypt) the DEK using the KEK.
 * Returns the wrapped key bytes for storage.
 */
export async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<Uint8Array> {
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, 'AES-KW');
  return new Uint8Array(wrapped);
}

/**
 * Unwrap a wrapped DEK as an **extractable** AES-GCM key.
 *
 * Scoped for flows that must immediately re-wrap the DEK under a different KEK
 * (e.g. enrolling biometric unlock) — the extractable copy is transient and
 * must never be stored or handed to the app. The app's working DEK stays
 * non-extractable (see `unwrapDek`).
 */
export async function unwrapDekExtractable(
  wrappedDek: Uint8Array,
  kek: CryptoKey,
): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      new Uint8Array(wrappedDek).buffer as ArrayBuffer,
      kek,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true, // extractable — needed to re-wrap under another KEK
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new Error('Failed to unwrap key — incorrect passphrase or corrupted key data');
  }
}

/**
 * Re-wrap the DEK under a new KEK (passphrase change).
 * Unwraps with the current KEK as extractable (scoped here only), then
 * immediately re-wraps with the new KEK. The DEK itself never changes.
 */
export async function rewrapDek(
  wrappedDek: Uint8Array,
  currentKek: CryptoKey,
  newKek: CryptoKey,
): Promise<Uint8Array> {
  let extractableDek: CryptoKey;
  try {
    extractableDek = await crypto.subtle.unwrapKey(
      'raw',
      new Uint8Array(wrappedDek).buffer as ArrayBuffer,
      currentKek,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true, // extractable — needed for re-wrap, scoped to this function
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new Error('Failed to unwrap key — incorrect current passphrase');
  }
  const rewrapped = await crypto.subtle.wrapKey('raw', extractableDek, newKek, 'AES-KW');
  return new Uint8Array(rewrapped);
}

/**
 * Unwrap (decrypt) a wrapped DEK using the KEK.
 * Returns a non-extractable AES-GCM key for encrypt/decrypt operations.
 * Throws if the passphrase (and thus KEK) is wrong.
 */
export async function unwrapDek(wrappedDek: Uint8Array, kek: CryptoKey): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      wrappedDek.buffer as ArrayBuffer,
      kek,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new Error('Failed to unwrap key — incorrect passphrase or corrupted key data');
  }
}
