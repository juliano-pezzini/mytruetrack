import { useState, useEffect } from 'react';
import { useVault } from '../hooks/useVault.ts';
import { PassphraseInput } from '../components/PassphraseInput.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { loadKeyData } from '../../crypto/key-store.ts';
import { deriveKek, unwrapDek } from '../../crypto/key-derivation.ts';
import {
  isBiometricAvailable,
  unlockWithBiometric,
  hasBiometricUnlock,
} from '../../crypto/webauthn.ts';

export function UnlockPage() {
  const { unlock, reset } = useVault();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  useEffect(() => {
    async function checkBio() {
      const enrolled = await hasBiometricUnlock();
      if (enrolled) {
        const avail = await isBiometricAvailable();
        setBioAvailable(avail);
      } else {
        setShowPassphrase(true);
      }
    }
    void checkBio();
  }, []);

  async function handleUnlock() {
    if (!passphrase) return;

    setError(null);
    setLoading(true);

    try {
      const keyData = await loadKeyData();
      if (!keyData) {
        setError('No vault found. Please set up a new one.');
        return;
      }

      const kek = await deriveKek(passphrase, keyData.salt, keyData.iterations);
      const dek = await unwrapDek(keyData.wrappedDek, kek);
      unlock(dek);
    } catch {
      setError('Incorrect passphrase. Please try again.');
      setPassphrase('');
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometric() {
    setError(null);
    setLoading(true);

    try {
      const dek = await unlockWithBiometric();
      if (!dek) {
        setError('Biometric unlock is unavailable. Please use your passphrase.');
        setShowPassphrase(true);
        return;
      }
      unlock(dek);
    } catch {
      setError('Biometric verification failed. You can use your passphrase instead.');
      setShowPassphrase(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    await reset();
    setShowReset(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      void handleUnlock();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">mytruetrack</h1>
            <p className="text-sm text-gray-500">
              {bioAvailable && !showPassphrase
                ? 'Unlock with your fingerprint or face'
                : 'Enter your passphrase to unlock'}
            </p>
          </div>

          {error && <p className="text-sm text-red-600 mb-4 text-center">{error}</p>}

          {bioAvailable && (
            <button
              type="button"
              onClick={handleBiometric}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Unlocking…' : 'Unlock with biometric'}
            </button>
          )}

          {bioAvailable && !showPassphrase && (
            <button
              type="button"
              onClick={() => {
                setShowPassphrase(true);
                setError(null);
              }}
              className="w-full mt-3 py-2 px-4 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Use passphrase instead
            </button>
          )}

          {showPassphrase && (
            <div className={`space-y-4 ${bioAvailable ? 'mt-4' : ''}`} onKeyDown={handleKeyDown}>
              <PassphraseInput
                value={passphrase}
                onChange={setPassphrase}
                label="Passphrase"
                autoFocus
              />

              <button
                type="button"
                onClick={handleUnlock}
                disabled={loading || !passphrase}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Unlocking…' : 'Unlock'}
              </button>
            </div>
          )}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Reset vault (deletes all data)
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showReset}
        title="Reset Vault"
        message="This will permanently delete all your data in this browser, including accounts, transactions, and encryption keys. This cannot be undone."
        onConfirm={handleReset}
        onCancel={() => setShowReset(false)}
      />
    </div>
  );
}
