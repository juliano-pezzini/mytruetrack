/**
 * WebAuthn biometric unlock — platform authenticator (Touch ID, Windows Hello, etc.)
 *
 * This module is browser-only. All functions gracefully degrade when the
 * WebAuthn API is absent (e.g., in Node.js tests or unsupported browsers).
 *
 * Biometric unlock uses the WebAuthn PRF extension: a fingerprint/face
 * assertion yields 32 secret bytes (never persisted) from which we derive a
 * KEK and unwrap the DEK. No passphrase or plaintext key is ever cached, so a
 * tab discard/reload can be unlocked by biometric without re-entering the
 * passphrase. The passphrase remains the fallback. Flow:
 *   1. User enters passphrase → DEK unwrapped in memory
 *   2. User enrols biometric → DEK re-wrapped under a PRF-derived KEK
 *   3. On later opens, biometric assertion derives the KEK → DEK unwrapped
 *   4. If PRF is unavailable, fall back to passphrase
 */

import {
  saveCredentialId,
  loadCredentialId,
  clearCredentialId,
  saveBiometricVault,
  loadBiometricVault,
  clearBiometricVault,
} from './key-store.ts';
import { deriveKekFromPrf, generateWrappingKey, wrapDek, unwrapDek } from './key-derivation.ts';

export type BiometricRegistration = {
  readonly credentialId: Uint8Array;
  readonly prfEnabled: boolean;
  readonly prfOutput: Uint8Array | null;
};

/** Extract exact bytes from a Uint8Array, safe for views with non-zero byteOffset. */
function toBuffer(view: Uint8Array): ArrayBuffer {
  return new Uint8Array(view).buffer as ArrayBuffer;
}

/** Check if a platform authenticator (fingerprint, face, etc.) is available. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a WebAuthn platform authenticator credential. When a prfSalt is
 * given, the PRF extension is requested at creation; if the authenticator
 * returns PRF output immediately, it is included (avoids a second prompt).
 * Stores the credential ID in IndexedDB for future assertions.
 */
export async function registerBiometric(
  userId: Uint8Array,
  userName: string,
  prfSalt?: Uint8Array,
): Promise<BiometricRegistration> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn is not available in this environment');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'mytruetrack' },
      user: {
        id: toBuffer(userId),
        name: userName,
        displayName: userName,
      },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required', // discoverable credential — required for PRF on Windows Hello
      },
      extensions: (prfSalt
        ? { prf: { eval: { first: toBuffer(prfSalt) } } }
        : { prf: {} }) as AuthenticationExtensionsClientInputs,
      timeout: 60000,
    },
  });

  if (!credential) {
    throw new Error('WebAuthn registration cancelled or failed');
  }

  const pkc = credential as PublicKeyCredential;
  const credentialId = new Uint8Array(pkc.rawId);
  await saveCredentialId(credentialId);

  const ext = pkc.getClientExtensionResults() as {
    prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
  };
  const prfFirst = ext.prf?.results?.first;

  return {
    credentialId,
    prfEnabled: ext.prf?.enabled === true,
    prfOutput: prfFirst ? new Uint8Array(prfFirst) : null,
  };
}

/**
 * Assert (verify) the user's identity via biometric.
 * Returns true on success, throws on failure or cancellation.
 */
export async function assertBiometric(credentialId: Uint8Array): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn is not available in this environment');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          id: toBuffer(credentialId),
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  if (!assertion) {
    throw new Error('WebAuthn assertion cancelled or failed');
  }

  return true;
}

/** Check if a biometric credential has been registered on this device. */
export async function hasBiometricCredential(): Promise<boolean> {
  const id = await loadCredentialId();
  return id !== null;
}

/** Get the stored credential ID, or null if not registered. */
export { loadCredentialId as getCredentialId };

/** True if biometric PRF unlock has been enrolled on this device. */
export async function hasBiometricUnlock(): Promise<boolean> {
  return (await loadBiometricVault()) !== null;
}

/**
 * Run a WebAuthn assertion that evaluates the PRF extension and returns its
 * 32-byte output, or null if the authenticator did not provide PRF results.
 */
async function evaluatePrf(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<Uint8Array | null> {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    return null;
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: toBuffer(credentialId), type: 'public-key' }],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: toBuffer(prfSalt) } },
      } as AuthenticationExtensionsClientInputs,
      timeout: 60000,
    },
  });

  if (!assertion) return null;

  const results = (assertion as PublicKeyCredential).getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const first = results.prf?.results?.first;
  if (!first) return null;
  return new Uint8Array(first);
}

/**
 * Enrol biometric unlock. Prefers the PRF extension (nothing extra persisted);
 * if the authenticator lacks PRF, falls back to wrapping the DEK under a random
 * non-extractable AES-KW key stored in IndexedDB, gated by a biometric
 * assertion. Throws if the user cancels the prompt.
 */
export async function enrollBiometricUnlock(
  userId: Uint8Array,
  userName: string,
  dek: CryptoKey,
): Promise<void> {
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const { credentialId, prfEnabled, prfOutput } = await registerBiometric(
    userId,
    userName,
    prfSalt,
  );

  // Preferred path: PRF output from creation, or an assertion when the
  // authenticator advertised PRF support but didn't return it at creation.
  const prf = prfOutput ?? (prfEnabled ? await evaluatePrf(credentialId, prfSalt) : null);
  if (prf) {
    const kek = await deriveKekFromPrf(prf);
    const wrappedDek = await wrapDek(dek, kek);
    await saveBiometricVault({ mode: 'prf', credentialId, prfSalt, wrappedDek });
    return;
  }

  // Fallback: wrap the DEK under a non-extractable AES-KW key persisted in
  // IndexedDB. The biometric assertion gates unlock; the key never leaves the
  // CryptoKey and cannot be exported by page script.
  const kek = await generateWrappingKey();
  const wrappedDek = await wrapDek(dek, kek);
  await saveBiometricVault({ mode: 'wrapped-key', credentialId, kek, wrappedDek });
}

/**
 * Unlock via biometric: prompt for fingerprint/face and unwrap the DEK.
 * Returns the non-extractable DEK, or null if biometric unlock is not set up
 * or its key material is unavailable. Throws if the user cancels.
 */
export async function unlockWithBiometric(): Promise<CryptoKey | null> {
  const vault = await loadBiometricVault();
  if (!vault) return null;

  if (vault.mode === 'prf') {
    const prfOutput = await evaluatePrf(vault.credentialId, vault.prfSalt);
    if (!prfOutput) return null;
    const kek = await deriveKekFromPrf(prfOutput);
    return unwrapDek(vault.wrappedDek, kek);
  }

  // wrapped-key fallback: require a biometric assertion to gate the unlock,
  // then unwrap with the stored non-extractable key.
  await assertBiometric(vault.credentialId);
  return unwrapDek(vault.wrappedDek, vault.kek);
}

/** Remove all biometric unlock material (credential ID + vault record). */
export async function removeBiometricCredential(): Promise<void> {
  await clearBiometricVault();
  await clearCredentialId();
}
