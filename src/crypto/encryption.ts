/**
 * AES-GCM encrypt/decrypt primitives for arbitrary blobs.
 *
 * Each encryption uses a random 12-byte IV. The IV is prepended to the
 * ciphertext when packed for storage/upload, and stripped when unpacking.
 */

export const IV_LENGTH = 12;

export type EncryptedBlob = {
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
};

/**
 * Encrypt a plaintext blob with AES-GCM using the DEK.
 * Returns IV + ciphertext (IV is random per call).
 */
export async function encrypt(dek: CryptoKey, plaintext: Uint8Array): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    dek,
    plaintext.buffer as ArrayBuffer,
  );
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

/**
 * Decrypt an encrypted blob with AES-GCM using the DEK.
 * Throws on wrong key or tampered ciphertext (GCM auth tag failure).
 */
export async function decrypt(dek: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: blob.iv.buffer as ArrayBuffer },
      dek,
      blob.ciphertext.buffer as ArrayBuffer,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error('Decryption failed — wrong key or tampered data');
  }
}

/**
 * Pack an EncryptedBlob into a single Uint8Array for storage/upload.
 * Format: [IV (12 bytes)] [ciphertext (variable)]
 */
export function encodeBlob(blob: EncryptedBlob): Uint8Array {
  const packed = new Uint8Array(IV_LENGTH + blob.ciphertext.length);
  packed.set(blob.iv, 0);
  packed.set(blob.ciphertext, IV_LENGTH);
  return packed;
}

/**
 * Unpack a single Uint8Array back into an EncryptedBlob.
 * Inverse of encodeBlob.
 */
export function decodeBlob(packed: Uint8Array): EncryptedBlob {
  if (packed.length < IV_LENGTH + 1) {
    throw new Error(`Invalid blob: too short (${packed.length} bytes, need at least ${IV_LENGTH + 1})`);
  }
  return {
    iv: packed.slice(0, IV_LENGTH),
    ciphertext: packed.slice(IV_LENGTH),
  };
}
