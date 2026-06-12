/**
 * Google Identity Services (GIS) — dynamic script loader & typed wrapper.
 *
 * Loads `https://accounts.google.com/gsi/client` on first use (not at boot),
 * so the app stays functional offline until sync is actually attempted.
 */

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let loadPromise: Promise<void> | null = null;

/**
 * Ensure the GIS client library is loaded. Resolves immediately on subsequent calls.
 */
export function loadGisClient(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    if (typeof google !== 'undefined' && google.accounts?.oauth2?.initTokenClient != null) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      // The script may load but fail to initialize (CSP rewrite, adblock, partial
      // download). Verify the expected API before resolving so callers can retry.
      if (typeof google !== 'undefined' && google.accounts?.oauth2?.initTokenClient != null) {
        resolve();
      } else {
        loadPromise = null; // allow retry
        reject(new Error('Google Identity Services loaded but did not initialize.'));
      }
    };
    script.onerror = () => {
      loadPromise = null; // allow retry
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export type GisTokenResult = {
  readonly accessToken: string;
  readonly expiresIn: number;
};

/**
 * Request an access token via the GIS token model.
 *
 * @param clientId  OAuth 2.0 client ID (Web application type).
 * @param scope     OAuth scope(s), space-separated.
 * @param prompt    '' for silent re-request; 'consent' for interactive.
 * @returns Resolved with the token, or rejected on error / user cancellation.
 */
export function requestAccessToken(
  clientId: string,
  scope: string,
  prompt: '' | 'consent',
): Promise<GisTokenResult> {
  return new Promise<GisTokenResult>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      prompt,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: response.expires_in,
        });
      },
      error_callback: (error) => {
        reject(new Error(error.message ?? 'GIS token request failed.'));
      },
    });

    client.requestAccessToken({ prompt });
  });
}

/**
 * Revoke a previously-granted access token at Google so it becomes unusable
 * immediately (instead of remaining valid until expiry). Best-effort: callers
 * should ignore failures since the token is cleared locally regardless.
 */
export function revokeAccessToken(accessToken: string): void {
  google.accounts.oauth2.revoke(accessToken);
}
