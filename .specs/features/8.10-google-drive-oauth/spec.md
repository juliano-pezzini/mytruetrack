# Phase 8.10 — Google Drive OAuth UI Wiring

## Goal

Make Google Drive sync actually usable from Settings. The Drive `CloudProvider`
(`google-drive-provider.ts`) and OAuth PKCE helpers (`google-oauth.ts`) already exist from
Phase 8.5; Phase 8.9 deferred the **OAuth flow UI wiring** to this phase. Closes issue #2
("the button in Settings appears as 'Coming soon'").

## Requirements

### GDO-01: Persist Google OAuth tokens

Extend `SyncConfig` with `google: { accessToken, refreshToken, expiresAt } | null`, stored in
IndexedDB alongside the WebDAV config. `loadSyncConfig` normalizes older records missing the field.

### GDO-02: Client ID configuration

Read the OAuth client ID from `import.meta.env.VITE_GOOGLE_CLIENT_ID` (typed in `vite-env.d.ts`,
documented in `.env.example`). No client secret in source — PKCE public client. The UI shows a
setup hint when the ID is unset.

### GDO-03: Interactive connect flow (popup PKCE)

`connectGoogleDrive()` opens a popup to Google's consent screen
(`redirect_uri = ${origin}/oauth2-callback.html`), receives the auth code via `postMessage`
(origin-validated), and exchanges it for tokens. A static `public/oauth2-callback.html` posts the
code back to the opener and closes. Popup approach preserves the in-memory DB and unlocked vault.

### GDO-04: Token refresh

`ensureValidGoogleTokens(tokens)` refreshes the access token (60s skew) using the refresh token
when expired, preserving the existing refresh token. `SyncSection.getActiveProvider()` refreshes
and persists before building `createGoogleDriveProvider(accessToken)`.

### GDO-05: Settings UI

Replace the disabled "coming soon" button: **Connect with Google** when disconnected, a
**Connected / Disconnect** state when connected, and a configuration hint when no client ID is set.
Push/Pull controls use the live provider.

## Out of scope

- Automatic/scheduled sync (manual push/pull only).
- Other providers (OneDrive, Dropbox).
- Production OAuth consent-screen verification (deployment concern).

## Testing

- `google-oauth.test.ts`: PKCE helpers, `buildAuthUrl`, `parseAuthCallback`, `exchangeCodeForToken`,
  `refreshAccessToken` (mocked fetch).
- `google-auth-flow.test.ts`: `ensureValidGoogleTokens` — valid passthrough, expired+refresh,
  expired+no-refresh (fake timers, mocked fetch).
- `sync-config.test.ts`: google-token round-trip + back-compat normalization.
- Gate: `npx tsc --noEmit && npx vite build && npx vitest run` + ESLint + audit-ci.

## Requirement Traceability

| ID     | Requirement                  |
|--------|------------------------------|
| GDO-01 | Persist Google tokens        |
| GDO-02 | Client ID configuration      |
| GDO-03 | Interactive connect flow     |
| GDO-04 | Token refresh                |
| GDO-05 | Settings UI                  |
