/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Google OAuth client secret. Required because Google's Web application client type always
   *  demands it in the token exchange, even with PKCE. Will be present in the JS bundle. */
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
