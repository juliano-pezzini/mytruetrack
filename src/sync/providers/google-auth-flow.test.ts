import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureValidGoogleTokens } from './google-auth-flow.ts';
import type { GoogleTokens } from '../sync-config.ts';

/**
 * Mock the GIS requestAccessToken helper used internally by google-auth-flow.
 * We mock google-gis.ts so no real GIS script is loaded.
 */
vi.mock('./google-gis.ts', () => ({
  loadGisClient: vi.fn().mockResolvedValue(undefined),
  requestAccessToken: vi.fn(),
}));

import { requestAccessToken } from './google-gis.ts';
const mockRequestAccessToken = vi.mocked(requestAccessToken);

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
      expiresAt: Date.now() + 10 * 60_000,
    };

    const result = await ensureValidGoogleTokens(tokens);

    expect(result).toBe(tokens);
    expect(mockRequestAccessToken).not.toHaveBeenCalled();
  });

  it('silently re-requests when expired and GIS succeeds', async () => {
    const tokens: GoogleTokens = {
      accessToken: 'old',
      expiresAt: Date.now() - 1000,
    };
    mockRequestAccessToken.mockResolvedValue({
      accessToken: 'fresh',
      expiresIn: 3600,
    });

    const result = await ensureValidGoogleTokens(tokens);

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('fresh');
    expect(result!.expiresAt).toBe(Date.now() + 3600 * 1000);
    expect(mockRequestAccessToken).toHaveBeenCalledWith('test-client', expect.any(String), '');
  });

  it('returns null when expired and silent re-request fails', async () => {
    const tokens: GoogleTokens = {
      accessToken: 'old',
      expiresAt: Date.now() - 1000,
    };
    mockRequestAccessToken.mockRejectedValue(new Error('popup_closed'));

    const result = await ensureValidGoogleTokens(tokens);

    expect(result).toBeNull();
  });
});
