import { describe, it, expect } from 'vitest';
import {
  deriveKek,
  deriveKekFromPrf,
  generateDek,
  generateWrappingKey,
  wrapDek,
  unwrapDek,
  unwrapDekExtractable,
  generateSalt,
  DEFAULT_ITERATIONS,
  SALT_LENGTH,
} from './key-derivation.ts';
describe('key-derivation', () => {
  const FAST_ITERATIONS = 1000; // fast for tests

  it('generateSalt returns a Uint8Array of correct length', () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(SALT_LENGTH);
  });

  it('generateSalt returns unique values', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toEqual(b);
  });

  it('DEFAULT_ITERATIONS is 600_000', () => {
    expect(DEFAULT_ITERATIONS).toBe(600_000);
  });

  it('deriveKek returns a CryptoKey', async () => {
    const salt = generateSalt();
    const kek = await deriveKek('test-passphrase', salt, FAST_ITERATIONS);
    expect(kek).toBeDefined();
    expect(kek.type).toBe('secret');
    expect(kek.algorithm.name).toBe('AES-KW');
    expect(kek.extractable).toBe(false);
  });

  it('deriveKekFromPrf returns a non-extractable AES-KW key', async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const kek = await deriveKekFromPrf(prf);
    expect(kek.algorithm.name).toBe('AES-KW');
    expect(kek.extractable).toBe(false);
  });

  it('deriveKekFromPrf rejects output shorter than 32 bytes', async () => {
    await expect(deriveKekFromPrf(new Uint8Array(16))).rejects.toThrow();
  });

  it('DEK wrapped with a PRF-derived KEK round-trips', async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const kek = await deriveKekFromPrf(prf);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek);
    const kek2 = await deriveKekFromPrf(prf);
    const unwrapped = await unwrapDek(wrapped, kek2);
    expect(unwrapped.algorithm.name).toBe('AES-GCM');
    expect(unwrapped.extractable).toBe(false);
  });

  it('generateWrappingKey returns a non-extractable AES-KW key', async () => {
    const kek = await generateWrappingKey();
    expect(kek.algorithm.name).toBe('AES-KW');
    expect(kek.extractable).toBe(false);
  });

  it('DEK wrapped with a generated wrapping key round-trips', async () => {
    const kek = await generateWrappingKey();
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek);
    const unwrapped = await unwrapDek(wrapped, kek);
    expect(unwrapped.algorithm.name).toBe('AES-GCM');
    expect(unwrapped.extractable).toBe(false);
  });

  it('unwrapDekExtractable yields an extractable DEK that can be re-wrapped', async () => {
    const salt = generateSalt();
    const kek = await deriveKek('pass', salt, FAST_ITERATIONS);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek);

    const extractable = await unwrapDekExtractable(wrapped, kek);
    expect(extractable.extractable).toBe(true);

    // The extractable copy can be re-wrapped under a different (biometric) KEK.
    const bioKek = await generateWrappingKey();
    const rewrapped = await wrapDek(extractable, bioKek);
    const back = await unwrapDek(rewrapped, bioKek);
    expect(back.algorithm.name).toBe('AES-GCM');
    expect(back.extractable).toBe(false);
  });

  it('unwrapDekExtractable throws on wrong KEK', async () => {
    const salt = generateSalt();
    const kek = await deriveKek('pass', salt, FAST_ITERATIONS);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek);
    const wrongKek = await deriveKek('other', salt, FAST_ITERATIONS);
    await expect(unwrapDekExtractable(wrapped, wrongKek)).rejects.toThrow();
  });

  it('rejects empty passphrase', async () => {
    const salt = generateSalt();
    await expect(deriveKek('', salt, FAST_ITERATIONS)).rejects.toThrow(
      'Passphrase must not be empty',
    );
  });

  it('generateDek returns an extractable AES-GCM key', async () => {
    const dek = await generateDek();
    expect(dek.type).toBe('secret');
    expect(dek.algorithm.name).toBe('AES-GCM');
    expect(dek.extractable).toBe(true);
  });

  it('wrap + unwrap round-trip produces a working DEK', async () => {
    const salt = generateSalt();
    const kek = await deriveKek('my-passphrase', salt, FAST_ITERATIONS);
    const dek = await generateDek();

    const wrapped = await wrapDek(dek, kek);
    expect(wrapped).toBeInstanceOf(Uint8Array);
    expect(wrapped.length).toBeGreaterThan(0);

    const unwrapped = await unwrapDek(wrapped, kek);
    expect(unwrapped.type).toBe('secret');
    expect(unwrapped.algorithm.name).toBe('AES-GCM');
    expect(unwrapped.extractable).toBe(false);

    // Verify the unwrapped DEK can actually encrypt/decrypt
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode('hello crypto');
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, unwrapped, data);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, unwrapped, ct);
    expect(new Uint8Array(pt)).toEqual(data);
  });

  it('unwrapDek throws with wrong passphrase', async () => {
    const salt = generateSalt();
    const correctKek = await deriveKek('correct-passphrase', salt, FAST_ITERATIONS);
    const wrongKek = await deriveKek('wrong-passphrase', salt, FAST_ITERATIONS);
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, correctKek);

    await expect(unwrapDek(wrapped, wrongKek)).rejects.toThrow(/incorrect passphrase|corrupted/i);
  });

  it('same passphrase + salt produces same KEK (deterministic)', async () => {
    const salt = generateSalt();
    const kek1 = await deriveKek('same-pass', salt, FAST_ITERATIONS);
    const kek2 = await deriveKek('same-pass', salt, FAST_ITERATIONS);

    // Both should unwrap the same wrapped DEK
    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek1);
    const unwrapped = await unwrapDek(wrapped, kek2);
    expect(unwrapped.type).toBe('secret');
  });

  it('different salts produce different KEKs', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const kek1 = await deriveKek('same-pass', salt1, FAST_ITERATIONS);
    const kek2 = await deriveKek('same-pass', salt2, FAST_ITERATIONS);

    const dek = await generateDek();
    const wrapped = await wrapDek(dek, kek1);

    await expect(unwrapDek(wrapped, kek2)).rejects.toThrow();
  });
});
