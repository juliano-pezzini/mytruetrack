import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../hooks/useDatabase.ts';
import { useVault } from '../hooks/useVault.ts';
import {
  loadSyncConfig,
  saveSyncConfig,
  type SyncConfig,
  type SyncProviderType,
} from '../../sync/sync-config.ts';
import { createWebDavProvider, type WebDavConfig } from '../../sync/providers/webdav-provider.ts';
import {
  createGoogleDriveProvider,
  DriveAuthError,
} from '../../sync/providers/google-drive-provider.ts';
import {
  connectGoogleDrive,
  ensureValidGoogleTokens,
  isGoogleConfigured,
  forceRefreshGoogleTokens,
} from '../../sync/providers/google-auth-flow.ts';
import { loadGisClient, revokeAccessToken } from '../../sync/providers/google-gis.ts';
import type { GoogleTokens } from '../../sync/sync-config.ts';
import { pushChanges, pullChanges } from '../../sync/sync-engine.ts';
import type { CloudProvider } from '../../sync/cloud-provider.ts';
import { getSyncState, type SyncState } from '../../sync/sync-state.ts';

const DEFAULT_WEBDAV: WebDavConfig = {
  endpoint: '',
  syncFolder: 'mytruetrack/',
  username: '',
  password: '',
};

export function SyncSection() {
  const db = useDatabase();
  const { dek } = useVault();
  const [provider, setProvider] = useState<SyncProviderType>(null);
  const [webdav, setWebdav] = useState<WebDavConfig>(DEFAULT_WEBDAV);
  const [googleTokens, setGoogleTokens] = useState<GoogleTokens | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showUnencryptedWarning, setShowUnencryptedWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<'push' | 'pull' | 'save' | null>(null);

  useEffect(() => {
    async function load() {
      const config = await loadSyncConfig();
      setProvider(config.provider);
      if (config.webdav) setWebdav(config.webdav);
      setGoogleTokens(config.google);
      const state = await getSyncState();
      setSyncState(state);
    }
    void load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!dek && provider !== null) {
      setShowUnencryptedWarning(true);
      setPendingAction('save');
      return;
    }
    await doSave();
  }, [provider, webdav, googleTokens, dek]);

  async function doSave() {
    const config: SyncConfig = {
      provider,
      webdav: provider === 'webdav' ? webdav : null,
      google: googleTokens,
    };
    await saveSyncConfig(config);
    setStatus('Configuration saved.');
    setShowUnencryptedWarning(false);
    setPendingAction(null);
  }

  async function handleTestConnection() {
    setTestResult(null);
    setLoading(true);
    try {
      const testProvider = createWebDavProvider(webdav);
      await testProvider.list();
      setTestResult('Connection successful.');
    } catch (err) {
      setTestResult(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectGoogle() {
    setStatus(null);
    setLoading(true);
    try {
      const tokens = await connectGoogleDrive();
      setGoogleTokens(tokens);
      await saveSyncConfig({ provider: 'google-drive', webdav: null, google: tokens });
      setProvider('google-drive');
      setStatus('Connected to Google Drive.');
    } catch (err) {
      setStatus(`Google connect failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnectGoogle() {
    // Revoke the granted token at Google so it can't be used until expiry,
    // then clear it locally. Revocation is best-effort.
    if (googleTokens) {
      try {
        await loadGisClient();
        revokeAccessToken(googleTokens.accessToken);
      } catch {
        // Ignore — the token is cleared locally regardless.
      }
    }
    setGoogleTokens(null);
    await saveSyncConfig({ provider: 'google-drive', webdav: null, google: null });
    setStatus('Disconnected from Google Drive.');
  }

  async function handlePush() {
    if (!dek && provider !== null) {
      setShowUnencryptedWarning(true);
      setPendingAction('push');
      return;
    }
    await doPush();
  }

  async function doPush() {
    setLoading(true);
    setStatus(null);
    setShowUnencryptedWarning(false);
    setPendingAction(null);
    try {
      const cloudProvider = await getActiveProvider();
      if (!cloudProvider) {
        setStatus((prev) => prev ?? 'Connect a cloud provider before syncing.');
        return;
      }
      await pushChanges(db, cloudProvider, dek);
      const state = await getSyncState();
      setSyncState(state);
      setStatus('Push complete.');
    } catch (err) {
      if (err instanceof DriveAuthError) {
        const retryProvider = await refreshAndRetryProvider();
        if (retryProvider) {
          try {
            await pushChanges(db, retryProvider, dek);
            const state = await getSyncState();
            setSyncState(state);
            setStatus('Push complete.');
            return;
          } catch (retryErr) {
            setStatus(`Push failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
            return;
          }
        }
      }
      setStatus(`Push failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePull() {
    if (!dek && provider !== null) {
      setShowUnencryptedWarning(true);
      setPendingAction('pull');
      return;
    }
    await doPull();
  }

  async function doPull() {
    setLoading(true);
    setStatus(null);
    setShowUnencryptedWarning(false);
    setPendingAction(null);
    try {
      const cloudProvider = await getActiveProvider();
      if (!cloudProvider) {
        setStatus((prev) => prev ?? 'Connect a cloud provider before syncing.');
        return;
      }
      await pullChanges(db, cloudProvider, dek);
      const state = await getSyncState();
      setSyncState(state);
      setStatus('Pull complete.');
    } catch (err) {
      if (err instanceof DriveAuthError) {
        const retryProvider = await refreshAndRetryProvider();
        if (retryProvider) {
          try {
            await pullChanges(db, retryProvider, dek);
            const state = await getSyncState();
            setSyncState(state);
            setStatus('Pull complete.');
            return;
          } catch (retryErr) {
            setStatus(`Pull failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
            return;
          }
        }
      }
      setStatus(`Pull failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function getActiveProvider(): Promise<CloudProvider | null> {
    if (provider === 'webdav') {
      return createWebDavProvider(webdav);
    }
    if (provider === 'google-drive') {
      if (!googleTokens) return null;
      const valid = await ensureValidGoogleTokens(googleTokens);
      if (!valid) {
        // Silent re-request failed — session expired, need interactive reconnect.
        setGoogleTokens(null);
        await saveSyncConfig({ provider: 'google-drive', webdav: null, google: null });
        setStatus('Google session expired. Please reconnect.');
        return null;
      }
      if (valid.accessToken !== googleTokens.accessToken) {
        setGoogleTokens(valid);
        await saveSyncConfig({ provider: 'google-drive', webdav: null, google: valid });
      }
      return createGoogleDriveProvider(valid.accessToken);
    }
    return null;
  }

  /** Force-refresh the Google token and return a new provider. Used as 401 retry. */
  async function refreshAndRetryProvider(): Promise<CloudProvider | null> {
    if (provider !== 'google-drive') return null;
    try {
      const refreshed = await forceRefreshGoogleTokens();
      if (!refreshed) {
        setGoogleTokens(null);
        await saveSyncConfig({ provider: 'google-drive', webdav: null, google: null });
        setStatus('Google session expired. Please reconnect.');
        return null;
      }
      setGoogleTokens(refreshed);
      await saveSyncConfig({ provider: 'google-drive', webdav: null, google: refreshed });
      return createGoogleDriveProvider(refreshed.accessToken);
    } catch {
      setGoogleTokens(null);
      await saveSyncConfig({ provider: 'google-drive', webdav: null, google: null });
      setStatus('Google session expired. Please reconnect.');
      return null;
    }
  }

  function confirmUnencrypted() {
    if (pendingAction === 'push') void doPush();
    else if (pendingAction === 'pull') void doPull();
    else if (pendingAction === 'save') void doSave();
  }

  function cancelUnencrypted() {
    setShowUnencryptedWarning(false);
    setPendingAction(null);
  }

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Cloud Provider</label>
        <div className="space-y-2">
          {(
            [
              ['none', 'None — local only'],
              ['webdav', 'WebDAV (Nextcloud, ownCloud, etc.)'],
              ['google-drive', 'Google Drive'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="sync-provider"
                value={value}
                checked={provider === (value === 'none' ? null : value)}
                onChange={() => setProvider(value === 'none' ? null : (value as SyncProviderType))}
                className="text-blue-600"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* WebDAV config */}
      {provider === 'webdav' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label
              htmlFor="webdav-endpoint"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Server URL
            </label>
            <input
              id="webdav-endpoint"
              type="url"
              value={webdav.endpoint}
              onChange={(e) => setWebdav({ ...webdav, endpoint: e.target.value })}
              placeholder="https://cloud.example.com/remote.php/dav/files/user/"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="webdav-folder" className="block text-xs font-medium text-gray-600 mb-1">
              Sync Folder
            </label>
            <input
              id="webdav-folder"
              type="text"
              value={webdav.syncFolder}
              onChange={(e) => setWebdav({ ...webdav, syncFolder: e.target.value })}
              placeholder="mytruetrack/"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="webdav-user" className="block text-xs font-medium text-gray-600 mb-1">
                Username
              </label>
              <input
                id="webdav-user"
                type="text"
                value={webdav.username}
                onChange={(e) => setWebdav({ ...webdav, username: e.target.value })}
                autoComplete="username"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="webdav-pass" className="block text-xs font-medium text-gray-600 mb-1">
                Password / App Token
              </label>
              <input
                id="webdav-pass"
                type="password"
                value={webdav.password}
                onChange={(e) => setWebdav({ ...webdav, password: e.target.value })}
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={loading || !webdav.endpoint || !webdav.username}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
          </div>

          {testResult && (
            <p
              className={`text-sm ${testResult.startsWith('Connection successful') ? 'text-green-600' : 'text-red-600'}`}
            >
              {testResult}
            </p>
          )}
        </div>
      )}

      {/* Google Drive */}
      {provider === 'google-drive' && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {!isGoogleConfigured() ? (
            <p className="text-sm text-gray-600">
              Google Drive sync is not configured for this build. Set{' '}
              <code className="px-1 bg-gray-200 rounded">VITE_GOOGLE_CLIENT_ID</code> (see{' '}
              <code className="px-1 bg-gray-200 rounded">.env.example</code>) and rebuild.
            </p>
          ) : googleTokens ? (
            <div className="space-y-2">
              <p className="text-sm text-green-700">✓ Connected to Google Drive.</p>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Connecting…' : 'Connect with Google'}
            </button>
          )}
        </div>
      )}

      {/* Unencrypted warning */}
      {showUnencryptedWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800 mb-2">⚠️ Unencrypted sync</p>
          <p className="text-sm text-amber-700 mb-3">
            Your data will be synced to the cloud <strong>without encryption</strong>. Anyone with
            access to your cloud storage can read your financial data. We strongly recommend setting
            a passphrase first.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmUnencrypted}
              className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200"
            >
              I understand, continue
            </button>
            <button
              type="button"
              onClick={cancelUnencrypted}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sync controls */}
      {provider && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePush}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Push Now
            </button>
            <button
              type="button"
              onClick={handlePull}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Pull Now
            </button>
          </div>

          {syncState && (
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>Last pushed: {syncState.lastPushedAt ?? 'Never'}</p>
              <p>Last pulled: {syncState.lastPulledAt ?? 'Never'}</p>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      {status && (
        <p className={`text-sm ${status.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
          {status}
        </p>
      )}
    </div>
  );
}
