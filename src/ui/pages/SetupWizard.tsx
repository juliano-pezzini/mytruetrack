import { useState, useEffect, useCallback } from 'react';
import { useVault } from '../hooks/useVault.ts';
import { PassphraseInput } from '../components/PassphraseInput.tsx';
import { StrengthMeter } from '../components/StrengthMeter.tsx';
import { generateSalt, deriveKek, generateDek, wrapDek } from '../../crypto/key-derivation.ts';
import { saveKeyData } from '../../crypto/key-store.ts';
import { generateRecoverySheet } from '../../crypto/recovery-sheet.ts';
import { isBiometricAvailable, enrollBiometricUnlock } from '../../crypto/webauthn.ts';
import {
  loadSyncConfig,
  saveSyncConfig,
  type SyncConfig,
} from '../../sync/sync-config.ts';
import { resolveActiveProvider } from '../../sync/active-provider.ts';
import type { CloudProvider } from '../../sync/cloud-provider.ts';
import { probeRemoteVault, type RemoteVaultStatus } from '../../sync/vault-metadata.ts';
import { clearCloudSyncData, startFreshVault } from '../../sync/sync-engine.ts';

type Step = 'welcome' | 'choice' | 'passphrase' | 'recovery' | 'biometric' | 'done' | 'restore';

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

  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteVaultStatus | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const resolveCloudProvider = useCallback(async (): Promise<CloudProvider | null> => {
    const config = syncConfig ?? (await loadSyncConfig());
    if (!syncConfig) setSyncConfig(config);
    if (!config.provider) return null;

    const resolved = await resolveActiveProvider(config);
    if (resolved.kind === 'ok') {
      if (resolved.config !== config) {
        await saveSyncConfig(resolved.config);
        setSyncConfig(resolved.config);
      }
      return resolved.provider;
    }
    return null;
  }, [syncConfig]);

  const runProbe = useCallback(async () => {
    setProbeLoading(true);
    setProbeError(null);
    try {
      const config = await loadSyncConfig();
      setSyncConfig(config);
      if (!config.provider) {
        setRemoteStatus(null);
        return;
      }
      const cloudProvider = await resolveCloudProvider();
      if (!cloudProvider) {
        setRemoteStatus(null);
        return;
      }
      const status = await probeRemoteVault(cloudProvider);
      setRemoteStatus(status);
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : String(err));
      setRemoteStatus(null);
    } finally {
      setProbeLoading(false);
    }
  }, [resolveCloudProvider]);

  useEffect(() => {
    if (step === 'choice') {
      void runProbe();
    }
  }, [step, runProbe]);

  async function handleClearCloudFromSetup() {
    setLoading(true);
    setError(null);
    try {
      const cloudProvider = await resolveCloudProvider();
      if (!cloudProvider) {
        setError('Connect a cloud provider first in Settings, or configure sync below.');
        return;
      }
      await clearCloudSyncData(cloudProvider);
      await runProbe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cloud sync data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartFreshFromSetup() {
    setLoading(true);
    setError(null);
    try {
      const cloudProvider = await resolveCloudProvider();
      if (!cloudProvider) {
        setError('Connect a cloud provider first in Settings.');
        return;
      }
      await startFreshVault(cloudProvider);
      await runProbe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start fresh.');
    } finally {
      setLoading(false);
    }
  }

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
      await enrollBiometricUnlock(userId, 'mytruetrack', dek);
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

  const hasConfiguredProvider = Boolean(syncConfig?.provider);
  const remoteReady = remoteStatus?.kind === 'ready';
  const remoteBlocked =
    remoteStatus?.kind === 'legacy' ||
    remoteStatus?.kind === 'corrupt' ||
    remoteReady;
  const createDisabled = remoteBlocked || probeLoading;
  const restoreDisabled =
    remoteStatus?.kind === 'legacy' ||
    remoteStatus?.kind === 'corrupt' ||
    probeLoading;

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

        {/* Choice: create, restore, or skip */}
        {step === 'choice' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Secure your data</h2>
            <p className="text-sm text-gray-500 mb-4">
              A passphrase encrypts your data end-to-end. Without one, your data is stored
              unencrypted — even in the cloud.
            </p>

            {probeLoading && (
              <p className="text-sm text-gray-500 mb-4">Checking cloud vault…</p>
            )}
            {probeError && (
              <p className="text-sm text-amber-700 mb-4">
                Could not check cloud: {probeError}. You can still create a new local vault.
              </p>
            )}

            {remoteReady && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  An encrypted vault already exists in your cloud sync folder. Restore it with
                  your passphrase — creating a new vault here would desync your devices.
                </p>
              </div>
            )}

            {remoteStatus?.kind === 'legacy' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  Found {remoteStatus.segmentCount} sync file
                  {remoteStatus.segmentCount === 1 ? '' : 's'} but no vault metadata — likely
                  from an older app version. Clear cloud sync data or start fresh before setting
                  up this device.
                </p>
              </div>
            )}

            {remoteStatus?.kind === 'corrupt' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  Cloud vault metadata is unreadable ({remoteStatus.reason}). Clear cloud sync
                  data or start fresh to continue.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {remoteReady && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('restore');
                  }}
                  disabled={restoreDisabled}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Restore existing vault
                </button>
              )}

              <button
                type="button"
                onClick={() => setStep('passphrase')}
                disabled={createDisabled}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create a passphrase
              </button>

              {!remoteReady && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('restore');
                  }}
                  disabled={restoreDisabled}
                  className="w-full py-3 px-4 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Restore existing vault
                </button>
              )}

              <button
                type="button"
                onClick={skipToLocalOnly}
                disabled={remoteBlocked}
                className="w-full py-3 px-4 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Skip — continue without a passphrase
              </button>
            </div>

            {(remoteStatus?.kind === 'legacy' || remoteStatus?.kind === 'corrupt') &&
              hasConfiguredProvider && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <p className="text-xs text-gray-500">Fix cloud state:</p>
                  <button
                    type="button"
                    onClick={() => void handleClearCloudFromSetup()}
                    disabled={loading}
                    className="w-full py-2 px-3 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {loading ? 'Working…' : 'Clear cloud sync data'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleStartFreshFromSetup()}
                    disabled={loading}
                    className="w-full py-2 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Start fresh vault (clears cloud + local keys)
                  </button>
                </div>
              )}

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

            <p className="text-xs text-gray-400 mt-4 text-center">
              You can always add a passphrase later in Settings.
            </p>
          </div>
        )}

        {/* Restore placeholder — completed in restore task */}
        {step === 'restore' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Restore existing vault</h2>
            <p className="text-sm text-gray-500 mb-6">Loading restore flow…</p>
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
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
