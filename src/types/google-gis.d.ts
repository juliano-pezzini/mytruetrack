/**
 * Ambient type declarations for Google Identity Services (GIS) — token model.
 *
 * Only the subset used by mytruetrack is declared. See:
 * https://developers.google.com/identity/oauth2/web/reference/js-reference
 */

declare namespace google.accounts.oauth2 {
  type TokenResponse = {
    readonly access_token: string;
    readonly expires_in: number;
    readonly token_type: string;
    readonly scope: string;
    readonly error?: string;
    readonly error_description?: string;
    readonly error_uri?: string;
  };

  type TokenClientConfig = {
    readonly client_id: string;
    readonly scope: string;
    readonly callback: (response: TokenResponse) => void;
    readonly error_callback?: (error: { type: string; message: string }) => void;
    /** '' = silent / no prompt; 'consent' = force consent screen. */
    readonly prompt?: '' | 'consent' | 'select_account';
  };

  type OverridableTokenClientConfig = {
    readonly prompt?: '' | 'consent' | 'select_account';
    readonly callback?: (response: TokenResponse) => void;
    readonly error_callback?: (error: { type: string; message: string }) => void;
  };

  type TokenClient = {
    requestAccessToken(overrideConfig?: OverridableTokenClientConfig): void;
  };

  function initTokenClient(config: TokenClientConfig): TokenClient;

  function revoke(accessToken: string, done?: () => void): void;
}
