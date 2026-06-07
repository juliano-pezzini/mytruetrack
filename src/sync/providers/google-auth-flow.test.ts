import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureValidGoogleTokens } from './google-auth-flow.ts';
import type { GoogleTokens } from '../sync-config.ts';

describe('google-auth-flow / ensureValidGoogleTokens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the same tokens when the access token is still valid', async () => {
    const tokens: GoogleTokens = {
      accessToken: 'valid',
      refreshToken: 'rt',
      expiresAt: Date.now() + 10 * 60_000,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureValidGoogleTokens(tokens);

    expect(result).toBe(tokens);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes when expired and a refresh token is present', async () => {
    const tokens: GoogleTokens = {
      accessToken: 'old',
      refreshToken: 'rt-1',
      expiresAt: Date.now() - 1000,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'fresh', expires_in: 3600, token_type: 'Bearer' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureValidGoogleTokens(tokens);

    expect(result.accessToken).toBe('fresh');
    expect(result.refreshToken).toBe('rt-1'); // preserved across refresh
    expect(result.expiresAt).toBe(Date.now() + 3600 * 1000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns tokens unchanged when expired but no refresh token exists', async () => {
    const tokens: GoogleTokens = {
      accessToken: 'old',
      refreshToken: null,
      expiresAt: Date.now() - 1000,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await ensureValidGoogleTokens(tokens);

    expect(result).toBe(tokens);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
