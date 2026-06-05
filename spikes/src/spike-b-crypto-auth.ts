/**
 * Spike B — Passphrase + WebAuthn key management
 *
 * Question: Can we wrap an AES-GCM key with a passphrase-derived key, store it
 * encrypted in IndexedDB, and unlock it via WebAuthn (platform authenticator)?
 *
 * VERDICT: (to be filled after running)
 */

import { openDB } from 'idb';

export async function runSpikeB(): Promise<void> {
  const log = (msg: string) => console.log(`[Spike B] ${msg}`);

  log('=== Crypto + WebAuthn Prototype ===');

  // =========================================================
  // Step 1: Derive KEK from passphrase (PBKDF2)
  // =========================================================
  log('\n--- Step 1: PBKDF2 Key Derivation ---');

  const passphrase = 'test-passphrase-spike-b';
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const kek = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );

  log('KEK derived from passphrase via PBKDF2 (600k iterations)');

  // =========================================================
  // Step 2: Generate DEK (AES-GCM) and wrap with KEK
  // =========================================================
  log('\n--- Step 2: Generate DEK + Wrap ---');

  const dek = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable for wrapping
    ['encrypt', 'decrypt'],
  );

  const wrappedDek = await crypto.subtle.wrapKey('raw', dek, kek, 'AES-KW');
  log(`DEK generated and wrapped (${wrappedDek.byteLength} bytes)`);

  // =========================================================
  // Step 3: Store wrapped DEK + salt in IndexedDB
  // =========================================================
  log('\n--- Step 3: IndexedDB Storage ---');

  const db = await openDB('spike-b-keystore', 1, {
    upgrade(database) {
      database.createObjectStore('keys');
    },
  });

  await db.put('keys', { wrappedDek: new Uint8Array(wrappedDek), salt }, 'dek');
  log('Wrapped DEK + salt stored in IndexedDB');

  // Read back
  const stored = await db.get('keys', 'dek');
  if (!stored) throw new Error('Failed to read back from IndexedDB');
  log('Verified read-back from IndexedDB');

  // =========================================================
  // Step 4: Unwrap DEK with passphrase
  // =========================================================
  log('\n--- Step 4: Unwrap DEK ---');

  const keyMaterial2 = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const kek2 = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: stored.salt,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    keyMaterial2,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );

  const unwrappedDek = await crypto.subtle.unwrapKey(
    'raw',
    stored.wrappedDek.buffer,
    kek2,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  log('DEK unwrapped successfully');

  // =========================================================
  // Step 5: Encrypt / decrypt round-trip (5 MB blob)
  // =========================================================
  log('\n--- Step 5: Encrypt/Decrypt 5 MB Blob ---');

  const blobSize = 5 * 1024 * 1024; // 5 MB
  const plaintext = new Uint8Array(blobSize);
  // getRandomValues max is 65536 bytes per call
  for (let offset = 0; offset < blobSize; offset += 65536) {
    const chunk = Math.min(65536, blobSize - offset);
    crypto.getRandomValues(plaintext.subarray(offset, offset + chunk));
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const t0 = performance.now();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    unwrappedDek,
    plaintext,
  );

  const tEncrypt = performance.now();

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    unwrappedDek,
    ciphertext,
  );

  const tDecrypt = performance.now();

  // Verify round-trip
  const decryptedArr = new Uint8Array(decrypted);
  let match = true;
  for (let i = 0; i < plaintext.length; i++) {
    if (plaintext[i] !== decryptedArr[i]) {
      match = false;
      break;
    }
  }

  log(`5 MB encrypt: ${(tEncrypt - t0).toFixed(1)} ms`);
  log(`5 MB decrypt: ${(tDecrypt - tEncrypt).toFixed(1)} ms`);
  log(`5 MB round-trip: ${(tDecrypt - t0).toFixed(1)} ms`);
  log(
    `Round-trip integrity: ${match ? '✅ PASS' : '❌ FAIL'}`,
  );
  log(
    `Target < 500 ms: ${(tDecrypt - t0) < 500 ? '✅ PASS' : '⚠️ SLOW'}`,
  );

  // =========================================================
  // Step 6: WebAuthn Registration + Assertion
  // =========================================================
  log('\n--- Step 6: WebAuthn Platform Authenticator ---');

  // Check if WebAuthn is available
  if (!window.PublicKeyCredential) {
    log('⚠️ WebAuthn NOT available in this browser');
  } else {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    log(`Platform authenticator available: ${available}`);

    if (available) {
      try {
        // Registration
        const userId = crypto.getRandomValues(new Uint8Array(16));
        const challenge = crypto.getRandomValues(new Uint8Array(32));

        const credential = await navigator.credentials.create({
          publicKey: {
            rp: { name: 'mytruetrack-spike' },
            user: {
              id: userId,
              name: 'spike-user',
              displayName: 'Spike Test User',
            },
            challenge,
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' }, // ES256
              { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            extensions: {
              prf: {
                eval: {
                  first: encoder.encode('mytruetrack-dek-salt'),
                },
              },
            },
          },
        });

        if (credential) {
          log('✅ WebAuthn credential registered');
          const credId = (credential as PublicKeyCredential).rawId;
          log(`Credential ID: ${credId.byteLength} bytes`);

          // Check PRF extension support
          const clientExtResults = (
            credential as PublicKeyCredential
          ).getClientExtensionResults();
          log(
            `Client extensions: ${JSON.stringify(clientExtResults)}`,
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prfEnabled = (clientExtResults as any).prf?.enabled;
          log(
            `PRF extension: ${prfEnabled ? '✅ Supported' : '⚠️ Not supported (fallback needed)'}`,
          );

          // Assertion
          const assertionChallenge = crypto.getRandomValues(
            new Uint8Array(32),
          );
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge: assertionChallenge,
              allowCredentials: [
                {
                  id: credId,
                  type: 'public-key',
                },
              ],
              userVerification: 'required',
              extensions: {
                prf: {
                  eval: {
                    first: encoder.encode('mytruetrack-dek-salt'),
                  },
                },
              },
            },
          });

          if (assertion) {
            log('✅ WebAuthn assertion succeeded');
            const assertExtResults = (
              assertion as PublicKeyCredential
            ).getClientExtensionResults();
            log(
              `Assertion extensions: ${JSON.stringify(assertExtResults)}`,
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const prfResults = (assertExtResults as any).prf?.results;
            if (prfResults?.first) {
              log(
                `✅ PRF output received (${prfResults.first.byteLength} bytes) — can derive key from biometric`,
              );
            } else {
              log(
                '⚠️ PRF output not received — fallback to passphrase-only unlock',
              );
            }
          }
        }
      } catch (err) {
        log(`WebAuthn error: ${err}`);
        log(
          'This may be expected if running on localhost without HTTPS or in a non-interactive context',
        );
      }
    } else {
      log(
        '⚠️ No platform authenticator — biometric unlock not available on this device',
      );
    }
  }

  // =========================================================
  // Step 7: Argon2 Feasibility Check
  // =========================================================
  log('\n--- Step 7: Argon2 Feasibility ---');
  log(
    'Argon2-WASM options: argon2-browser (~200 KB), hash-wasm (~80 KB)',
  );
  log(
    'Assessment: PBKDF2 with 600k iterations is the safe baseline.',
  );
  log(
    'Argon2 is better for passphrase hashing but adds WASM bundle overhead.',
  );
  log(
    'Recommendation: Start with PBKDF2, add Argon2 as optional upgrade if budget allows.',
  );

  // =========================================================
  // Summary
  // =========================================================
  log('\n=== Spike B Summary ===');
  log('PBKDF2 key derivation: ✅');
  log('AES-GCM DEK generation + wrap/unwrap: ✅');
  log('IndexedDB storage: ✅');
  log(`5 MB encrypt/decrypt round-trip: ${(tDecrypt - t0).toFixed(1)} ms`);
  log('WebAuthn: check console output above');
  log('PRF extension: check console output above');

  // Cleanup
  db.close();
  log('Done.');
}
