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
  type SyncProviderType,
  type GoogleTokens,
} from '../../sync/sync-config.ts';
import { createWebDavProvider, type WebDavConfig } from '../../sync/providers/webdav-provider.ts';
import { connectGoogleDrive, isGoogleConfigured } from '../../sync/providers/google-auth-flow.ts';
import { resolveActiveProvider } from '../../sync/active-provider.ts';
import type { CloudProvider } from '../../sync/cloud-provider.ts';
import { probeRemoteVault, restoreVaultFromRemote, type RemoteVaultStatus } from '../../sync/vault-metadata.ts';
import { clearCloudSyncData, startFreshVault } from '../../sync/sync-engine.ts';

type Step =
  | 'welcome'
  | 'choice'
  | 'passphrase'
  | 'recovery'
  | 'biometric'
  | 'done'
  | 'restore'
  | 'connect-cloud';

const DEFAULT_WEBDAV: WebDavConfig = {
  endpoint: '',
  syncFolder: 'mytruetrack/',
  username: '',
  password: '',
};

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

  const [connectProvider, setConnectProvider] = useState<SyncProviderType>('google-drive');
  const [webdav, setWebdav] = useState<WebDavConfig>(DEFAULT_WEBDAV);
  const [googleTokens, setGoogleTokens] = useState<GoogleTokens | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');

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
    if (sessionStorage.getItem('setup-after-fresh') === 'create') {
      sessionStorage.removeItem('setup-after-fresh');
      setStep('passphrase');
    }
  }, []);

  useEffect(() => {
    if (step === 'choice') {
      void runProbe();
    }
  }, [step, runProbe]);

  useEffect(() => {
    if (step !== 'connect-cloud') return;
    void loadSyncConfig().then((config) => {
      setSyncConfig(config);
      if (config.provider) setConnectProvider(config.provider);
      if (config.webdav) setWebdav(config.webdav);
      setGoogleTokens(config.google);
    });
  }, [step]);

  function beginRestore() {
    setError(null);
    setRestorePassphrase('');
    const config = syncConfig;
    if (!config?.provider) {
      setStep('connect-cloud');
      return;
    }
    if (config.provider === 'google-drive' && !config.google) {
      setStep('connect-cloud');
      return;
    }
    setStep('restore');
  }

  async function handleSaveConnectAndRestore() {
    setLoading(true);
    setError(null);
    try {
      if (connectProvider === 'webdav') {
        const testProvider = createWebDavProvider(webdav);
        await testProvider.list();
        await saveSyncConfig({ provider: 'webdav', webdav, google: null });
        setSyncConfig({ provider: 'webdav', webdav, google: null });
      } else if (connectProvider === 'google-drive') {
        if (!googleTokens) {
          setError('Connect with Google before continuing.');
          return;
        }
        await saveSyncConfig({ provider: 'google-drive', webdav: null, google: googleTokens });
        setSyncConfig({ provider: 'google-drive', webdav: null, google: googleTokens });
      } else {
        setError('Choose a cloud provider to restore from.');
        return;
      }
      await runProbe();
      setStep('restore');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to cloud.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectGoogleSetup() {
    setLoading(true);
    setError(null);
    try {
      const tokens = await connectGoogleDrive();
      setGoogleTokens(tokens);
      await saveSyncConfig({ provider: 'google-drive', webdav: null, google: tokens });
      setSyncConfig({ provider: 'google-drive', webdav: null, google: tokens });
      setConnectProvider('google-drive');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google connect failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreVault() {
    if (restorePassphrase.length < 1) {
      setError('Enter your vault passphrase.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cloudProvider = await resolveCloudProvider();
      if (!cloudProvider) {
        setStep('connect-cloud');
        setError('Connect your cloud provider first.');
        return;
      }
      const restoredDek = await restoreVaultFromRemote(cloudProvider, restorePassphrase);
      unlock(restoredDek);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setLoading(false);
    }
  }

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
                  onClick={beginRestore}
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
                  onClick={beginRestore}
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

        {step === 'connect-cloud' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connect cloud storage</h2>
            <p className="text-sm text-gray-500 mb-6">
              Restore downloads your vault key from the same cloud folder you use for sync.
            </p>

            <div className="space-y-2 mb-4">
              {(
                [
                  ['google-drive', 'Google Drive'],
                  ['webdav', 'WebDAV (Nextcloud, ownCloud, etc.)'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="setup-connect-provider"
                    checked={connectProvider === value}
                    onChange={() => setConnectProvider(value)}
                    className="text-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>

            {connectProvider === 'google-drive' && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                {!isGoogleConfigured() ? (
                  <p className="text-sm text-gray-600">
                    Google Drive is not configured in this build. Use WebDAV or set{' '}
                    <code className="px-1 bg-gray-200 rounded">VITE_GOOGLE_CLIENT_ID</code> and
                    rebuild.
                  </p>
                ) : googleTokens ? (
                  <p className="text-sm text-green-700">✓ Connected to Google Drive.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleConnectGoogleSetup()}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Connecting…' : 'Connect with Google'}
                  </button>
                )}
              </div>
            )}

            {connectProvider === 'webdav' && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                <input
                  type="url"
                  value={webdav.endpoint}
                  onChange={(e) => setWebdav({ ...webdav, endpoint: e.target.value })}
                  placeholder="Server URL"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={webdav.syncFolder}
                  onChange={(e) => setWebdav({ ...webdav, syncFolder: e.target.value })}
                  placeholder="Sync folder"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={webdav.username}
                    onChange={(e) => setWebdav({ ...webdav, username: e.target.value })}
                    placeholder="Username"
                    autoComplete="username"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={webdav.password}
                    onChange={(e) => setWebdav({ ...webdav, password: e.target.value })}
                    placeholder="Password / app token"
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <button
              type="button"
              onClick={() => void handleSaveConnectAndRestore()}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-3"
            >
              {loading ? 'Connecting…' : 'Continue to restore'}
            </button>
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          </div>
        )}

        {step === 'restore' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Restore existing vault</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the passphrase from your first device. This downloads the vault key from your
              cloud sync folder.
            </p>

            <div className="space-y-4">
              <PassphraseInput
                value={restorePassphrase}
                onChange={setRestorePassphrase}
                label="Vault passphrase"
                autoFocus
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={() => void handleRestoreVault()}
                disabled={loading || restorePassphrase.length < 1}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Restoring…' : 'Restore vault'}
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
