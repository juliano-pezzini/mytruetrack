import { useState } from 'react';
import { useVault } from '../hooks/useVault.ts';
import { PassphraseInput } from '../components/PassphraseInput.tsx';
import { StrengthMeter } from '../components/StrengthMeter.tsx';
import { generateSalt, deriveKek, generateDek, wrapDek } from '../../crypto/key-derivation.ts';
import { saveKeyData } from '../../crypto/key-store.ts';
import { generateRecoverySheet } from '../../crypto/recovery-sheet.ts';
import { isBiometricAvailable, enrollBiometricUnlock } from '../../crypto/webauthn.ts';

type Step = 'welcome' | 'choice' | 'passphrase' | 'recovery' | 'biometric' | 'done';

export function SetupWizard() {
  const { unlock, skipToLocalOnly } = useVault();
  const [step, setStep] = useState<Step>('welcome');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [recoveryHtml, setRecoveryHtml] = useState<string | null>(null);
  const [savedRecovery, setSavedRecovery] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  async function handleCreatePassphrase() {
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const salt = generateSalt();
      const kek = await deriveKek(passphrase, salt);
      const newDek = await generateDek();
      const wrappedDek = await wrapDek(newDek, kek);
      await saveKeyData({ wrappedDek, salt, iterations: 600_000 });

      setDek(newDek);

      const html = await generateRecoverySheet(passphrase);
      setRecoveryHtml(html);

      const bioAvail = await isBiometricAvailable();
      setBiometricAvailable(bioAvail);

      setStep('recovery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadRecovery() {
    if (!recoveryHtml) return;
    const blob = new Blob([recoveryHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mytruetrack-recovery-sheet.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBiometricEnroll() {
    if (!dek) {
      setError('Vault not ready. Please restart setup.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const result = await enrollBiometricUnlock(userId, 'mytruetrack', dek);
      if (!result.ok) {
        setError(`${result.reason} You’ll use your passphrase instead.`);
        return;
      }
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric enrollment failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    if (dek) {
      unlock(dek);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Welcome */}
        {step === 'welcome' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">mytruetrack</h1>
            <p className="text-gray-500 mb-8">Private, local-first personal finance tracking.</p>
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Choice: passphrase or skip */}
        {step === 'choice' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Secure your data</h2>
            <p className="text-sm text-gray-500 mb-6">
              A passphrase encrypts your data end-to-end. Without one, your data is stored
              unencrypted — even in the cloud.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setStep('passphrase')}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create a passphrase
              </button>
              <button
                type="button"
                onClick={skipToLocalOnly}
                className="w-full py-3 px-4 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Skip — continue without a passphrase
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-4 text-center">
              You can always add a passphrase later in Settings.
            </p>
          </div>
        )}

        {/* Create passphrase */}
        {step === 'passphrase' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Create a passphrase</h2>
            <p className="text-sm text-gray-500 mb-6">
              Choose something memorable. If you lose it, your encrypted data cannot be recovered
              (unless you save the recovery sheet in the next step).
            </p>

            <div className="space-y-4">
              <div>
                <PassphraseInput
                  value={passphrase}
                  onChange={setPassphrase}
                  label="Passphrase"
                  autoFocus
                />
                <StrengthMeter passphrase={passphrase} />
              </div>

              <PassphraseInput
                value={confirm}
                onChange={setConfirm}
                label="Confirm passphrase"
                id="passphrase-confirm"
                placeholder="Enter your passphrase again"
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={handleCreatePassphrase}
                disabled={loading || passphrase.length < 8}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating vault…' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('choice');
                  setError(null);
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Recovery sheet */}
        {step === 'recovery' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Save your recovery sheet</h2>
            <p className="text-sm text-gray-500 mb-6">
              This is your only way to recover your data if you forget your passphrase. Download it
              and store it somewhere safe.
            </p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleDownloadRecovery}
                className="w-full py-3 px-4 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors"
              >
                Download Recovery Sheet
              </button>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savedRecovery}
                  onChange={(e) => setSavedRecovery(e.target.checked)}
                  className="rounded border-gray-300"
                />
                I&apos;ve saved my recovery sheet
              </label>

              <button
                type="button"
                onClick={() => setStep(biometricAvailable ? 'biometric' : 'done')}
                disabled={!savedRecovery}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Biometric enrollment */}
        {step === 'biometric' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Quick unlock</h2>
            <p className="text-sm text-gray-500 mb-6">
              Use your fingerprint or face to unlock the app quickly, instead of typing your
              passphrase every time.
            </p>

            <div className="space-y-3">
              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={handleBiometricEnroll}
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Setting up…' : 'Enable biometric unlock'}
              </button>

              <button
                type="button"
                onClick={() => setStep('done')}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your vault is ready</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your data is encrypted and safe. You&apos;ll need your passphrase to unlock it next
              time.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
