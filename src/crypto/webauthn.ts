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
import { deriveKekFromPrf, wrapDek, unwrapDek } from './key-derivation.ts';

export type BiometricRegistration = {
  readonly credentialId: Uint8Array;
  readonly prfOutput: Uint8Array | null;
};

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
        id: userId.buffer as ArrayBuffer,
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
        ? { prf: { eval: { first: prfSalt.buffer as ArrayBuffer } } }
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

  const ext = pkc.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const prfFirst = ext.prf?.results?.first;

  return { credentialId, prfOutput: prfFirst ? new Uint8Array(prfFirst) : null };
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
          id: credentialId.buffer as ArrayBuffer,
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
      allowCredentials: [{ id: credentialId.buffer as ArrayBuffer, type: 'public-key' }],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: prfSalt.buffer as ArrayBuffer } },
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
 * Enrol biometric unlock: re-wrap the in-memory DEK under a KEK derived from
 * the authenticator's PRF output. Returns true on success, false if the
 * platform authenticator does not support the PRF extension (in which case any
 * orphan credential is cleaned up). Throws if the user cancels.
 */
export async function enrollBiometricUnlock(
  userId: Uint8Array,
  userName: string,
  dek: CryptoKey,
): Promise<boolean> {
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const { credentialId, prfOutput } = await registerBiometric(userId, userName, prfSalt);

  // Prefer PRF output from creation (single prompt); fall back to an assertion.
  const prf = prfOutput ?? (await evaluatePrf(credentialId, prfSalt));
  if (!prf) {
    // PRF unsupported on this authenticator — drop the unusable credential.
    await clearBiometricVault();
    return false;
  }

  const kek = await deriveKekFromPrf(prf);
  const wrappedDek = await wrapDek(dek, kek);
  await saveBiometricVault({ credentialId, prfSalt, wrappedDek });
  return true;
}

/**
 * Unlock via biometric: prompt for fingerprint/face, derive the KEK from PRF,
 * and unwrap the DEK. Returns the non-extractable DEK, or null if biometric
 * unlock is not set up or PRF is unavailable. Throws if the user cancels.
 */
export async function unlockWithBiometric(): Promise<CryptoKey | null> {
  const vault = await loadBiometricVault();
  if (!vault) return null;
  const prfOutput = await evaluatePrf(vault.credentialId, vault.prfSalt);
  if (!prfOutput) return null;
  const kek = await deriveKekFromPrf(prfOutput);
  return unwrapDek(vault.wrappedDek, kek);
}

/** Remove the biometric credential from this device. */
export { clearCredentialId as removeBiometricCredential };
