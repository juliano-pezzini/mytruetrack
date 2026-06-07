/**
 * Google Drive OAuth connect flow + token lifecycle.
 *
 * Browser-only. Drives a popup-based PKCE Authorization Code flow so the app's
 * in-memory database and unlocked vault survive the connect (no full-page
 * redirect). The popup loads a tiny static callback page that posts the auth
 * code back to the opener.
 */

import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  type TokenResponse,
} from './google-oauth.ts';
import type { GoogleTokens } from '../sync-config.ts';

const CALLBACK_PATH = '/oauth2-callback.html';
const POPUP_MESSAGE_SOURCE = 'mtt-google-oauth';

/** Refresh the access token this many ms before it actually expires. */
const EXPIRY_SKEW_MS = 60_000;

type CallbackMessage = {
  readonly source: typeof POPUP_MESSAGE_SOURCE;
  readonly code?: string;
  readonly error?: string;
};

/** Read the configured OAuth client ID (empty string if unset). */
export function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
}

/** Whether a client ID is configured at build time. */
export function isGoogleConfigured(): boolean {
  return getClientId().length > 0;
}

/** The redirect URI registered with the OAuth client. */
export function redirectUri(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

function toTokens(response: TokenResponse, previousRefreshToken: string | null): GoogleTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? previousRefreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
}

/**
 * Run the interactive connect flow. Opens a popup to Google's consent screen,
 * waits for the auth code via postMessage, then exchanges it for tokens.
 *
 * Must be called from a user gesture (click) so the popup is not blocked.
 */
export async function connectGoogleDrive(): Promise<GoogleTokens> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google client ID is not configured (set VITE_GOOGLE_CLIENT_ID).');
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const authUrl = buildAuthUrl(clientId, redirectUri(), challenge);

  const popup = window.open(authUrl, 'mtt-google-oauth', 'width=480,height=640');
  if (!popup) {
    throw new Error('Popup blocked. Allow popups for this site and try again.');
  }

  const code = await waitForAuthCode(popup);
  const response = await exchangeCodeForToken(clientId, redirectUri(), code, verifier);
  return toTokens(response, null);
}

function waitForAuthCode(popup: Window): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as CallbackMessage | undefined;
      if (!data || data.source !== POPUP_MESSAGE_SOURCE) return;

      settled = true;
      cleanup();
      popup.close();

      if (data.error) {
        reject(new Error(`Authorization failed: ${data.error}`));
      } else if (data.code) {
        resolve(data.code);
      } else {
        reject(new Error('Authorization returned no code.'));
      }
    }

    const closedTimer = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(new Error('Authorization cancelled.'));
      }
    }, 500);

    window.addEventListener('message', onMessage);
  });
}

/**
 * Return tokens with a valid (non-expired) access token, refreshing if needed.
 * The returned object may differ from the input; callers should persist it when
 * `tokens.accessToken` changed.
 */
export async function ensureValidGoogleTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (Date.now() < tokens.expiresAt - EXPIRY_SKEW_MS) {
    return tokens;
  }
  if (!tokens.refreshToken) {
    return tokens; // expired and unrefreshable — Drive call will surface the auth error
  }

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google client ID is not configured (set VITE_GOOGLE_CLIENT_ID).');
  }

  const response = await refreshAccessToken(clientId, tokens.refreshToken);
  return toTokens(response, tokens.refreshToken);
}
