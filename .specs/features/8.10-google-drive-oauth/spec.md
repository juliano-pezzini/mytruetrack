# Phase 8.10 — Google Drive OAuth UI Wiring

## Goal

Make Google Drive sync actually usable from Settings. The Drive `CloudProvider`
(`google-drive-provider.ts`) and OAuth PKCE helpers (`google-oauth.ts`) already exist from
Phase 8.5; Phase 8.9 deferred the **OAuth flow UI wiring** to this phase. Closes issue #2
("the button in Settings appears as 'Coming soon'").

## Requirements

### GDO-01: Persist Google OAuth tokens

Extend `SyncConfig` with `google: { accessToken, expiresAt } | null`, stored in
IndexedDB alongside the WebDAV config. `loadSyncConfig` normalizes older records missing
the field or containing a legacy `refreshToken` (stripped).

### GDO-02: Client ID configuration

Read the OAuth client ID from `import.meta.env.VITE_GOOGLE_CLIENT_ID` (typed in `vite-env.d.ts`,
documented in `.env.example`). No client secret needed — GIS token model. The UI shows a
setup hint when the ID is unset.

### GDO-03: Interactive connect flow (GIS token model)

`connectGoogleDrive()` loads the GIS client library (`accounts.google.com/gsi/client`)
dynamically on first use, then calls `requestAccessToken` with `prompt:'consent'`. Google
opens its own consent popup, obtains user permission, and returns an access token directly
to the app's callback — no auth code, no PKCE, no callback page, no client secret.

### GDO-04: Token refresh (silent re-request)

`ensureValidGoogleTokens(tokens)` checks token expiry (60s skew). When expired, it silently
re-requests a token via GIS (`prompt:''`). If the user has an active Google session and the
grant is still valid, a fresh token is returned without interaction. If silent re-request
fails (no session / revoked grant), returns `null` — the UI shows "session expired, reconnect"
and clears tokens.

### GDO-05: Settings UI

Replace the disabled "coming soon" button: **Connect with Google** when disconnected, a
**Connected / Disconnect** state when connected, and a configuration hint when no client ID is set.
Push/Pull controls use the live provider.

## Out of scope

- Automatic/scheduled sync (manual push/pull only).
- Other providers (OneDrive, Dropbox).
- Production OAuth consent-screen verification (deployment concern).

## Testing

- `google-auth-flow.test.ts`: `ensureValidGoogleTokens` — valid passthrough, expired+silent
  re-request succeeds, expired+silent fails → null (mocked GIS via `google-gis.ts` mock).
- `sync-config.test.ts`: google-token round-trip + back-compat normalization (missing google
  field, legacy `refreshToken` stripped).
- Gate: `npx tsc --noEmit && npx vite build && npx vitest run` + ESLint + audit-ci.

## Requirement Traceability

| ID     | Requirement              |
| ------ | ------------------------ |
| GDO-01 | Persist Google tokens    |
| GDO-02 | Client ID configuration  |
| GDO-03 | Interactive connect flow |
| GDO-04 | Token refresh            |
| GDO-05 | Settings UI              |
