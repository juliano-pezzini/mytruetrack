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
 * Generate a fresh Data Encryption Key (DEK).
 * Extractable so it can be wrapped by the KEK.
 */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
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
