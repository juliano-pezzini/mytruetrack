/**
 * Google Drive OAuth connect flow + token lifecycle.
 *
 * Uses the Google Identity Services (GIS) token model: the GIS library opens
 * its own consent popup, obtains an access token directly (no auth code, no
 * PKCE, no client secret), and returns it to the app via a callback. Tokens
 * last ~1 hour with no refresh token; we re-request silently when expired and
 * fall back to an interactive prompt if needed.
 */

import { loadGisClient, requestAccessToken, GisTokenError } from './google-gis.ts';
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
 * GIS error types that indicate the popup opened and the user may have even
 * completed sign-in, but the result never returned to the app.
 */
const POPUP_RESULT_LOST_TYPES = new Set(['popup_closed', 'popup_failed_to_open']);

/**
 * When the document is cross-origin isolated (COOP `same-origin` + COEP `require-corp`,
 * a possible hosting mode for some SQLite VFS variants), the browser severs the popup's
 * `window.opener` link, so GIS cannot deliver the token back and reports the popup as
 * "closed" even when sign-in actually succeeded. Detect this so we can show an accurate
 * message instead of the misleading "popup window closed". This app does not enable
 * isolation (cr-sqlite uses an IndexedDB VFS), but a host might.
 */
function isCrossOriginIsolated(): boolean {
  return typeof globalThis !== 'undefined' && globalThis.crossOriginIsolated === true;
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
  try {
    const result = await requestAccessToken(clientId, SCOPE, 'consent');
    return toTokens(result.accessToken, result.expiresIn);
  } catch (err) {
    if (err instanceof GisTokenError && POPUP_RESULT_LOST_TYPES.has(err.type)) {
      if (isCrossOriginIsolated()) {
        throw new Error(
          'Sign-in could not complete: this app runs in a cross-origin-isolated context ' +
            '(required for local encrypted storage), which prevents the Google popup from ' +
            'returning its result — even though your Google login may have succeeded. This is ' +
            'a known limitation; Google Drive sync needs a configuration change to work here. ' +
            'WebDAV sync is unaffected.',
          { cause: err },
        );
      }
      throw new Error('Sign-in was cancelled before it completed. Please try again.', {
        cause: err,
      });
    }
    throw err;
  }
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

/**
 * Force a token refresh regardless of local expiry. Used when the Drive API
 * returns 401 (token invalidated server-side before local expiry).
 * Returns null if the silent re-request fails.
 */
export async function forceRefreshGoogleTokens(): Promise<GoogleTokens | null> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google client ID is not configured (set VITE_GOOGLE_CLIENT_ID).');
  }

  try {
    await loadGisClient();
    const result = await requestAccessToken(clientId, SCOPE, '');
    return toTokens(result.accessToken, result.expiresIn);
  } catch {
    return null;
  }
}
