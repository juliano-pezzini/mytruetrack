# Phase 8.10 — Tasks

- [x] GDO-01: Add `google` tokens to `SyncConfig` + back-compat normalization in `loadSyncConfig`
- [x] GDO-02: `VITE_GOOGLE_CLIENT_ID` typing (`vite-env.d.ts`) + `.env.example`
- [x] GDO-03: `connectGoogleDrive()` via GIS token model (dynamic script loader + `requestAccessToken`)
- [x] GDO-04: `ensureValidGoogleTokens()` silent re-request (`prompt:''`) with null fallback
- [x] GDO-05: SyncSection UI — Connect / Connected+Disconnect / config hint / session-expired state
- [x] Tests: `google-auth-flow.test.ts` (mocked GIS), `sync-config.test.ts` (token shape + back-compat)
- [x] Gate: tsc + vite build + vitest + eslint + audit-ci
- [x] Removed PKCE artifacts: `google-oauth.ts`, `google-oauth.test.ts`, `oauth2-callback.html`
- [x] Removed `VITE_GOOGLE_CLIENT_SECRET` from env typings + `.env.example`

## Runtime setup (manual, per environment)

Create an OAuth 2.0 "Web application" client in Google Cloud Console (Drive API enabled,
scope `drive.appdata`), set **authorized JavaScript origins** to your app's origin, and
provide `VITE_GOOGLE_CLIENT_ID` at build time. No client secret or redirect URI needed —
GIS token model returns the access token directly to the browser.
