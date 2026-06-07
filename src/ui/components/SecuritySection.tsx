import { useState, useEffect } from 'react';
import { useVault } from '../hooks/useVault.ts';
import { hasKeyData } from '../../crypto/key-store.ts';
import {
  isBiometricAvailable,
  hasBiometricCredential,
  registerBiometric,
  removeBiometricCredential,
} from '../../crypto/webauthn.ts';

type SecurityState = {
  readonly vaultProtected: boolean;
  readonly bioAvailable: boolean;
  readonly bioEnrolled: boolean;
};

export function SecuritySection() {
  const { status } = useVault();
  const [state, setState] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadState() {
    const [vaultProtected, bioAvailable, bioEnrolled] = await Promise.all([
      hasKeyData(),
      isBiometricAvailable(),
      hasBiometricCredential(),
    ]);
    setState({ vaultProtected, bioAvailable, bioEnrolled });
  }

  useEffect(() => {
    void loadState();
  }, [status]);

  async function handleEnableBiometric() {
    setLoading(true);
    setMessage(null);
    try {
      const userId = crypto.getRandomValues(new Uint8Array(16));
      await registerBiometric(userId, 'mytruetrack');
      setMessage({ type: 'success', text: 'Biometric unlock enabled.' });
      await loadState();
    } catch {
      setMessage({ type: 'error', text: 'Biometric enrollment failed or was cancelled.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveBiometric() {
    setLoading(true);
    setMessage(null);
    try {
      await removeBiometricCredential();
      setMessage({ type: 'success', text: 'Biometric unlock removed.' });
      await loadState();
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove biometric credential.' });
    } finally {
      setLoading(false);
    }
  }

  if (state === null) {
    return <p className="text-sm text-gray-400">Loading security status…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Vault status */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            state.vaultProtected ? 'bg-green-500' : 'bg-yellow-400'
          }`}
        />
        <div>
          {state.vaultProtected ? (
            <>
              <p className="text-sm font-medium text-gray-800">Protected with passphrase</p>
              <p className="text-xs text-gray-500">
                Your data is encrypted. You need your passphrase to unlock it.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800">Data is not encrypted</p>
              <p className="text-xs text-gray-500">
                You chose local-only mode. To enable encryption, reset the vault and create a
                passphrase during setup.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Biometric — only relevant when vault is passphrase-protected */}
      {state.vaultProtected && (
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              state.bioEnrolled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <div className="flex-1">
            {state.bioEnrolled ? (
              <>
                <p className="text-sm font-medium text-gray-800">Biometric unlock enabled</p>
                <p className="text-xs text-gray-500 mb-2">
                  Fingerprint / face ID is registered on this device.
                </p>
                <button
                  type="button"
                  onClick={handleRemoveBiometric}
                  disabled={loading}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove biometric
                </button>
              </>
            ) : state.bioAvailable ? (
              <>
                <p className="text-sm font-medium text-gray-800">Biometric unlock not set up</p>
                <p className="text-xs text-gray-500 mb-2">
                  Your device supports fingerprint or face unlock.
                </p>
                <button
                  type="button"
                  onClick={handleEnableBiometric}
                  disabled={loading}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {loading ? 'Setting up…' : 'Enable biometric unlock'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-800">Biometric unlock</p>
                <p className="text-xs text-gray-500">
                  No platform authenticator detected on this device.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {message && (
        <p
          className={`text-xs ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
