# Phase 8.10 — Tasks

- [x] GDO-01: Add `google` tokens to `SyncConfig` + back-compat normalization in `loadSyncConfig`
- [x] GDO-02: `VITE_GOOGLE_CLIENT_ID` typing (`vite-env.d.ts`) + `.env.example`
- [x] GDO-03: `connectGoogleDrive()` popup flow + `public/oauth2-callback.html`
- [x] GDO-04: `refreshAccessToken()` + `ensureValidGoogleTokens()`; async `getActiveProvider()`
- [x] GDO-05: SyncSection UI — Connect / Connected+Disconnect / config hint
- [x] Tests: `google-oauth.test.ts`, `google-auth-flow.test.ts`, extend `sync-config.test.ts`
- [x] Gate: tsc + vite build + vitest + eslint + audit-ci

## Runtime setup (manual, per environment)

Create an OAuth 2.0 "Web application" client in Google Cloud Console (Drive API enabled,
scope `drive.appdata`), set authorized origin + redirect `${origin}/oauth2-callback.html`,
and provide `VITE_GOOGLE_CLIENT_ID` at build time.
