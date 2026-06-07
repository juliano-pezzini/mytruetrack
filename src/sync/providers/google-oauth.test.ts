import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  parseAuthCallback,
  exchangeCodeForToken,
  refreshAccessToken,
} from './google-oauth.ts';

describe('google-oauth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateCodeVerifier produces a base64url string within RFC length bounds', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('generateCodeChallenge is deterministic for a given verifier', async () => {
    const a = await generateCodeChallenge('verifier-abc');
    const b = await generateCodeChallenge('verifier-abc');
    const c = await generateCodeChallenge('verifier-xyz');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('buildAuthUrl includes PKCE + appdata scope parameters', () => {
    const url = new URL(buildAuthUrl('client-1', 'https://app/cb', 'challenge-1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/cb');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.appdata');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('parseAuthCallback extracts the code, or null when absent', () => {
    expect(parseAuthCallback('https://app/cb?code=xyz&scope=drive')).toBe('xyz');
    expect(parseAuthCallback('https://app/cb?error=access_denied')).toBeNull();
  });

  it('exchangeCodeForToken posts PKCE params and returns tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'at',
        expires_in: 3600,
        token_type: 'Bearer',
        refresh_token: 'rt',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await exchangeCodeForToken('client', 'https://app/cb', 'the-code', 'verifier');

    expect(tokens.access_token).toBe('at');
    expect(tokens.refresh_token).toBe('rt');
    const body = fetchMock.mock.calls[0]![1].body as string;
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=the-code');
    expect(body).toContain('code_verifier=verifier');
  });

  it('refreshAccessToken posts refresh grant and returns a new access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-at', expires_in: 3600, token_type: 'Bearer' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await refreshAccessToken('client', 'rt-1');

    expect(tokens.access_token).toBe('new-at');
    const body = fetchMock.mock.calls[0]![1].body as string;
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=rt-1');
    expect(body).toContain('client_id=client');
  });

  it('refreshAccessToken throws on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant' }),
    );
    await expect(refreshAccessToken('client', 'bad')).rejects.toThrow(/Token refresh failed/);
  });
});
