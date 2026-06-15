import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveActiveProvider } from './active-provider.ts';
import type { SyncConfig, GoogleTokens } from './sync-config.ts';
import type { CloudProvider } from './cloud-provider.ts';

const fakeWebDavProvider = { _kind: 'webdav' } as unknown as CloudProvider;
const fakeDriveProvider = { _kind: 'drive' } as unknown as CloudProvider;

vi.mock('./providers/webdav-provider.ts', () => ({
  createWebDavProvider: vi.fn(() => fakeWebDavProvider),
}));
vi.mock('./providers/google-drive-provider.ts', () => ({
  createGoogleDriveProvider: vi.fn(() => fakeDriveProvider),
}));
vi.mock('./providers/google-auth-flow.ts', () => ({
  ensureValidGoogleTokens: vi.fn(),
}));

import { createWebDavProvider } from './providers/webdav-provider.ts';
import { createGoogleDriveProvider } from './providers/google-drive-provider.ts';
import { ensureValidGoogleTokens } from './providers/google-auth-flow.ts';

const mockEnsure = vi.mocked(ensureValidGoogleTokens);

const webdavConfig: SyncConfig = {
  provider: 'webdav',
  webdav: { endpoint: 'https://x', syncFolder: 'mytruetrack/', username: 'u', password: 'p' },
  google: null,
};

const googleTokens: GoogleTokens = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };

const googleConfig: SyncConfig = {
  provider: 'google-drive',
  webdav: null,
  google: googleTokens,
};

describe('resolveActiveProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns none when no provider configured', async () => {
    const result = await resolveActiveProvider({ provider: null, webdav: null, google: null });
    expect(result.kind).toBe('none');
  });

  it('builds a webdav provider from config', async () => {
    const result = await resolveActiveProvider(webdavConfig);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.provider).toBe(fakeWebDavProvider);
    expect(result.config).toBe(webdavConfig);
    expect(createWebDavProvider).toHaveBeenCalledWith(webdavConfig.webdav);
  });

  it('returns none when google selected but no tokens', async () => {
    const result = await resolveActiveProvider({
      provider: 'google-drive',
      webdav: null,
      google: null,
    });
    expect(result.kind).toBe('none');
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('builds a drive provider with unchanged config when tokens still valid', async () => {
    mockEnsure.mockResolvedValue(googleTokens);
    const result = await resolveActiveProvider(googleConfig);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.provider).toBe(fakeDriveProvider);
    expect(result.config).toBe(googleConfig); // same reference, no refresh
    expect(createGoogleDriveProvider).toHaveBeenCalledWith('tok');
  });

  it('returns refreshed config when tokens were silently renewed', async () => {
    const refreshed: GoogleTokens = { accessToken: 'tok2', expiresAt: Date.now() + 600_000 };
    mockEnsure.mockResolvedValue(refreshed);
    const result = await resolveActiveProvider(googleConfig);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.config).not.toBe(googleConfig);
    expect(result.config.google).toBe(refreshed);
    expect(createGoogleDriveProvider).toHaveBeenCalledWith('tok2');
  });

  it('returns reconnect when google session expired', async () => {
    mockEnsure.mockResolvedValue(null);
    const result = await resolveActiveProvider(googleConfig);
    expect(result.kind).toBe('reconnect');
  });
});
