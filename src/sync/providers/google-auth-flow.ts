/**
 * Google Drive OAuth connect flow + token lifecycle.
 *
 * Uses the Google Identity Services (GIS) token model: the GIS library opens
 * its own consent popup, obtains an access token directly (no auth code, no
 * PKCE, no client secret), and returns it to the app via a callback. Tokens
 * last ~1 hour with no refresh token; we re-request silently when expired and
 * fall back to an interactive prompt if needed.
 */

import { loadGisClient, requestAccessToken } from './google-gis.ts';
import type { GoogleTokens } from '../sync-config.ts';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** Refresh the access token this many ms before it actually expires. */
const EXPIRY_SKEW_MS = 60_000;

/** Read the configured OAuth client ID (empty string if unset). */
export function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
}

/** Whether a client ID is configured at build time. */
export function isGoogleConfigured(): boolean {
  return getClientId().length > 0;
}

function toTokens(accessToken: string, expiresIn: number): GoogleTokens {
  return {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Run the interactive connect flow. Loads the GIS library (if needed), then
 * requests an access token with `prompt:'consent'` which shows Google's
 * consent popup.
 *
 * Must be called from a user gesture (click) so the popup is not blocked.
 */
export async function connectGoogleDrive(): Promise<GoogleTokens> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google client ID is not configured (set VITE_GOOGLE_CLIENT_ID).');
  }

  await loadGisClient();
  const result = await requestAccessToken(clientId, SCOPE, 'consent');
  return toTokens(result.accessToken, result.expiresIn);
}

/**
 * Return tokens with a valid (non-expired) access token, re-requesting
 * silently if possible. When silent re-request fails (no active Google
 * session or revoked grant), returns `null` to signal that an interactive
 * reconnect is needed.
 */
export async function ensureValidGoogleTokens(tokens: GoogleTokens): Promise<GoogleTokens | null> {
  if (Date.now() < tokens.expiresAt - EXPIRY_SKEW_MS) {
    return tokens;
  }

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google client ID is not configured (set VITE_GOOGLE_CLIENT_ID).');
  }

  try {
    await loadGisClient();
    const result = await requestAccessToken(clientId, SCOPE, '');
    return toTokens(result.accessToken, result.expiresIn);
  } catch {
    // Silent re-request failed — caller should prompt interactive reconnect.
    return null;
  }
}
