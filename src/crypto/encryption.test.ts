import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encodeBlob, decodeBlob, IV_LENGTH } from './encryption.ts';
import { generateDek } from './key-derivation.ts';

describe('encryption', () => {
  it('encrypts and decrypts a small blob', async () => {
    const dek = await generateDek();
    const plaintext = new TextEncoder().encode('hello world');

    const blob = await encrypt(dek, plaintext);
    expect(blob.iv.length).toBe(IV_LENGTH);
    expect(blob.ciphertext.length).toBeGreaterThan(0);

    const decrypted = await decrypt(dek, blob);
    expect(decrypted).toEqual(plaintext);
  });

  it('encrypts and decrypts a 1 MB blob', { timeout: 30000 }, async () => {
    const dek = await generateDek();
    const plaintext = new Uint8Array(1024 * 1024);
    // Fill with a pattern instead of random (avoids slow getRandomValues in chunks)
    for (let i = 0; i < plaintext.length; i++) {
      plaintext[i] = i % 256;
    }

    const blob = await encrypt(dek, plaintext);
    const decrypted = await decrypt(dek, blob);
    expect(decrypted).toEqual(plaintext);
  });

  it('uses a unique IV per encryption', async () => {
    const dek = await generateDek();
    const data = new TextEncoder().encode('same data');

    const blob1 = await encrypt(dek, data);
    const blob2 = await encrypt(dek, data);

    expect(blob1.iv).not.toEqual(blob2.iv);
  });

  it('throws on decryption with wrong key', async () => {
    const dek1 = await generateDek();
    const dek2 = await generateDek();
    const plaintext = new TextEncoder().encode('secret');

    const blob = await encrypt(dek1, plaintext);

    await expect(decrypt(dek2, blob)).rejects.toThrow(/wrong key|tampered/i);
  });

  it('throws on tampered ciphertext', async () => {
    const dek = await generateDek();
    const plaintext = new TextEncoder().encode('tamper test');

    const blob = await encrypt(dek, plaintext);
    // Flip a byte in the ciphertext
    const tampered = new Uint8Array(blob.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;

    await expect(decrypt(dek, { iv: blob.iv, ciphertext: tampered })).rejects.toThrow(
      /wrong key|tampered/i,
    );
  });

  it('encodeBlob packs IV + ciphertext', async () => {
    const dek = await generateDek();
    const plaintext = new TextEncoder().encode('pack test');

    const blob = await encrypt(dek, plaintext);
    const packed = encodeBlob(blob);

    expect(packed.length).toBe(IV_LENGTH + blob.ciphertext.length);
    expect(packed.slice(0, IV_LENGTH)).toEqual(blob.iv);
    expect(packed.slice(IV_LENGTH)).toEqual(blob.ciphertext);
  });

  it('decodeBlob unpacks back to EncryptedBlob', async () => {
    const dek = await generateDek();
    const plaintext = new TextEncoder().encode('round-trip');

    const blob = await encrypt(dek, plaintext);
    const packed = encodeBlob(blob);
    const unpacked = decodeBlob(packed);

    expect(unpacked.iv).toEqual(blob.iv);
    expect(unpacked.ciphertext).toEqual(blob.ciphertext);

    // Full round-trip
    const decrypted = await decrypt(dek, unpacked);
    expect(decrypted).toEqual(plaintext);
  });

  it('decodeBlob throws on too-short input', () => {
    const short = new Uint8Array(IV_LENGTH); // needs at least IV_LENGTH + 1
    expect(() => decodeBlob(short)).toThrow(/too short/);
  });
});
