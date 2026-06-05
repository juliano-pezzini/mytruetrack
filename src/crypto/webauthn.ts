/**
 * WebAuthn biometric unlock — platform authenticator (Touch ID, Windows Hello, etc.)
 *
 * This module is browser-only. All functions gracefully degrade when the
 * WebAuthn API is absent (e.g., in Node.js tests or unsupported browsers).
 *
 * The biometric does NOT produce a cryptographic key (PRF not yet widely supported).
 * Instead, it gates access to the session-scoped DEK that was already unlocked
 * via passphrase. The flow is:
 *   1. User enters passphrase → DEK unwrapped and held in memory
 *   2. User registers biometric (WebAuthn credential created)
 *   3. On subsequent opens, biometric assertion confirms identity → DEK stays accessible
 *   4. If session expires, user must re-enter passphrase
 */

import { saveCredentialId, loadCredentialId, clearCredentialId } from './key-store.ts';

export type BiometricRegistration = {
  readonly credentialId: Uint8Array;
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
 * Register a WebAuthn platform authenticator credential.
 * Stores the credential ID in IndexedDB for future assertions.
 */
export async function registerBiometric(
  userId: Uint8Array,
  userName: string,
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
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  });

  if (!credential) {
    throw new Error('WebAuthn registration cancelled or failed');
  }

  const credentialId = new Uint8Array((credential as PublicKeyCredential).rawId);
  await saveCredentialId(credentialId);

  return { credentialId };
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

/** Remove the biometric credential from this device. */
export { clearCredentialId as removeBiometricCredential };
