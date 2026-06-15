# Phase 8.9 — WebDAV Provider + Sync Settings UI

## Goal

Implement the WebDAV `CloudProvider` and build the Settings sync UI so users can configure cloud sync (Google Drive or WebDAV), push/pull manually, and see sync status. Also update the sync engine to support unencrypted sync (when `dek` is null).

## Requirements

### WDV-01: WebDAV CloudProvider implementation

Implement `CloudProvider` for WebDAV servers (Nextcloud, ownCloud, generic). Uses standard WebDAV HTTP methods:

- `upload` → `PUT /{path}/{filename}` with `Content-Type: application/octet-stream`
- `download` → `GET /{path}/{filename}` (returns null on 404)
- `list` → `PROPFIND /{path}/` with `Depth: 1`, parse XML multistatus response
- `delete` → `DELETE /{path}/{filename}` (no-op on 404)
- `isAuthenticated` → returns `true` if credentials are set

**Auth**: Basic auth (username + password/app-token). The credentials are stored in IndexedDB (not localStorage — avoids XSS exposure via `document.cookie` adjacent storage).

**Config**:

- `endpoint`: WebDAV server URL (e.g., `https://cloud.example.com/remote.php/dav/files/user/`)
- `syncFolder`: folder path within WebDAV (default: `mytruetrack/`)
- `username`: WebDAV username
- `password`: WebDAV password or app token

### WDV-02: Sync engine — optional encryption

Update `pushChanges` and `pullChanges` to accept `dek: CryptoKey | null`:

- `dek !== null` → encrypt before upload, decrypt after download (current behavior)
- `dek === null` → upload/download plaintext snapshots (no crypto step)

### WDV-03: Sync configuration persistence

Store the active sync provider config in IndexedDB:

- `provider: 'google-drive' | 'webdav' | null` — which provider is active
- `webdav: { endpoint, syncFolder, username, password }` — WebDAV credentials
- `google: { accessToken, refreshToken, expiresAt }` — Google OAuth tokens (placeholder, wired in future)

### WDV-04: Settings Sync UI

Replace the "Sync — coming soon" placeholder in Settings with:

1. **Provider selector**: radio buttons (None / Google Drive / WebDAV)
2. **WebDAV config form**: endpoint, folder, username, password inputs. "Test Connection" button (does a PROPFIND). "Save" button.
3. **Google Drive**: "Connect with Google" button (placeholder — OAuth flow in future polish)
4. **Sync controls**: "Push Now" / "Pull Now" buttons (manual sync). Last pushed/pulled timestamps from sync state.
5. **Unencrypted warning**: if `dek === null` and a provider is selected, show the warning from ONB-01b before allowing sync.

### WDV-05: WebDAV provider tests

Unit tests with mocked `fetch`:

- Upload creates/overwrites a file
- Download returns content or null on 404
- List parses PROPFIND XML response
- Delete sends DELETE, no-op on 404
- Auth header is sent correctly

## Non-requirements (deferred)

- Google OAuth PKCE flow UI (provider code exists, UI wiring deferred to 8.10)
- Automatic/scheduled sync (manual push/pull only for now)
- Conflict resolution UI (CRDT handles it)
- WebDAV discovery (user provides full endpoint URL)

## Architecture

```
src/sync/
├── cloud-provider.ts          # CloudProvider interface (existing)
├── sync-engine.ts             # push/pull — updated for optional dek
├── sync-state.ts              # IndexedDB sync timestamps (existing)
├── sync-config.ts             # NEW: IndexedDB provider config persistence
├── mock-cloud-provider.ts     # existing mock
└── providers/
    ├── google-drive-provider.ts   # existing
    ├── google-oauth.ts            # existing
    └── webdav-provider.ts         # NEW

src/ui/
├── components/
│   └── SyncSection.tsx        # NEW: sync config + controls for Settings
└── pages/
    └── SettingsPage.tsx        # updated: replaces sync placeholder
```

## Testing

- **WebDAV provider**: Unit tests with mocked fetch (5+ tests)
- **Sync engine**: Update existing tests for null dek path
- **Sync config**: Unit tests for persistence CRUD
- **Gate**: `npx tsc --noEmit && npx vite build && npx vitest run`
