/**
 * OAuth 2.0 Authorization Code + PKCE flow helpers for Google.
 *
 * Browser-only. No unit tests — token exchange requires network + Google servers.
 * Verified manually and via Playwright in Phase 8.8.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export type TokenResponse = {
  readonly access_token: string;
  readonly expires_in: number;
  readonly token_type: string;
  readonly refresh_token?: string;
};

/**
 * Generate a cryptographically random code verifier (43–128 chars, base64url).
 */
export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64url(bytes);
}

/**
 * Generate a code challenge from a verifier (SHA-256, base64url-encoded).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded.buffer as ArrayBuffer);
  return base64url(new Uint8Array(digest));
}

/**
 * Build the Google OAuth authorization URL with PKCE parameters.
 */
export function buildAuthUrl(clientId: string, redirectUri: string, codeChallenge: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

/**
 * Exchange an authorization code for tokens via the token endpoint.
 */
export async function exchangeCodeForToken(
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  const params: Record<string, string> = {
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
  };
  if (clientSecret) params['client_secret'] = clientSecret;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Exchange a refresh token for a fresh access token via the token endpoint.
 *
 * Google requires the client_secret for Web application clients even on refresh.
 */
export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  const params: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  if (clientSecret) params['client_secret'] = clientSecret;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Parse the authorization callback URL to extract the code parameter.
 * Returns null if no code is present.
 */
export function parseAuthCallback(url: string): string | null {
  const parsed = new URL(url);
  return parsed.searchParams.get('code');
}

/**
 * Base64url encode without padding (per RFC 7636).
 */
function base64url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
