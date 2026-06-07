# Phase 8.9 — WebDAV Provider + Sync Settings Tasks

**Spec**: `.specs/features/8.9-webdav-sync/spec.md`  
**Status**: Done

---

## Test Strategy

- **WebDAV provider**: Unit tests with mocked `fetch` (Node.js)
- **Sync config**: Unit tests with `fake-indexeddb`
- **Sync engine**: Extend existing tests for null-dek path
- **UI**: Type-check + build gate
- **Gate**: `npx tsc --noEmit && npx vite build && npx vitest run`

---

## Execution Plan

```
T1 → T2 → T3 → T4 → T5 → T6
```

T1 updates the sync engine (foundational). T2 is WebDAV provider. T3 is config persistence. T4 is Settings UI. T5-T6 are tests.

---

## Task Breakdown

### T1: Sync engine — optional encryption

**What**: Update `pushChanges` and `pullChanges` to accept `dek: CryptoKey | null`. When null, skip encrypt/decrypt steps.
**Where**: `src/sync/sync-engine.ts`
**Depends on**: None
**Requirement**: WDV-02

**Done when**:
- [ ] `pushChanges(db, provider, dek)` — if `dek === null`, upload plaintext snapshot
- [ ] `pullChanges(db, provider, dek)` — if `dek === null`, download and import plaintext directly
- [ ] Existing encrypted path unchanged when `dek !== null`
- [ ] Gate: `npx tsc --noEmit`

**Tests**: T6
**Gate**: typecheck

---

### T2: WebDAV CloudProvider

**What**: Implement `CloudProvider` for WebDAV using standard HTTP methods (PUT, GET, PROPFIND, DELETE). Basic auth.
**Where**: `src/sync/providers/webdav-provider.ts`
**Depends on**: None
**Reuses**: `CloudProvider` interface from `src/sync/cloud-provider.ts`
**Requirement**: WDV-01

**Done when**:
- [ ] `createWebDavProvider(config)` factory function
- [ ] `upload(filename, data)` → PUT to `{endpoint}/{syncFolder}/{filename}`
- [ ] `download(filename)` → GET, returns Uint8Array or null on 404
- [ ] `list()` → PROPFIND with `Depth: 1`, parses multistatus XML
- [ ] `delete(filename)` → DELETE, no-op on 404
- [ ] `isAuthenticated()` → returns true when credentials are set
- [ ] Basic auth header: `Authorization: Basic base64(username:password)`
- [ ] Gate: `npx tsc --noEmit`

**Tests**: T5
**Gate**: typecheck

---

### T3: Sync config persistence

**What**: Store/retrieve the active sync provider configuration in IndexedDB.
**Where**: `src/sync/sync-config.ts`
**Depends on**: None
**Requirement**: WDV-03

**Done when**:
- [ ] `SyncConfig` type: `{ provider: 'google-drive' | 'webdav' | null; webdav: WebDavConfig | null }`
- [ ] `WebDavConfig` type: `{ endpoint: string; syncFolder: string; username: string; password: string }`
- [ ] `saveSyncConfig(config)` → saves to IndexedDB
- [ ] `loadSyncConfig()` → returns SyncConfig or default (provider: null)
- [ ] `clearSyncConfig()` → removes config
- [ ] Gate: `npx tsc --noEmit`

**Tests**: T6
**Gate**: typecheck

---

### T4: Settings Sync UI

**What**: Replace the "Sync — coming soon" placeholder with provider selector, WebDAV config form, sync controls, and unencrypted warning.
**Where**: `src/ui/components/SyncSection.tsx`, `src/ui/pages/SettingsPage.tsx`
**Depends on**: T1, T2, T3
**Requirement**: WDV-04

**Done when**:
- [ ] Provider selector: None / Google Drive / WebDAV radio buttons
- [ ] WebDAV form: endpoint, folder, username, password inputs + "Test Connection" + "Save"
- [ ] Test connection: calls PROPFIND, shows success/error
- [ ] Google Drive: placeholder "Connect with Google" button (disabled, coming soon)
- [ ] Sync controls: "Push Now" / "Pull Now" buttons
- [ ] Shows last pushed/pulled timestamps from sync state
- [ ] Unencrypted warning: if `dek === null` and provider selected, show warning with "Set a passphrase" link
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T5: WebDAV provider tests

**What**: Unit tests for WebDAV provider with mocked `fetch`.
**Where**: `src/sync/providers/webdav-provider.test.ts`
**Depends on**: T2
**Requirement**: WDV-05

**Done when**:
- [ ] Test: upload sends PUT with correct URL, auth header, body
- [ ] Test: download returns Uint8Array on 200
- [ ] Test: download returns null on 404
- [ ] Test: list parses PROPFIND XML multistatus response
- [ ] Test: delete sends DELETE, no error on 404
- [ ] Test: isAuthenticated returns true when credentials set
- [ ] Gate: `npx vitest run src/sync/providers/webdav-provider.test.ts`

**Tests**: yes
**Gate**: test

---

### T6: Sync engine + config tests

**What**: Extend existing sync engine tests for null-dek path. Add sync config persistence tests.
**Where**: `src/sync/sync-engine.test.ts` (extend), `src/sync/sync-config.test.ts` (new)
**Depends on**: T1, T3
**Requirement**: WDV-02, WDV-03

**Done when**:
- [ ] Test: pushChanges with null dek uploads plaintext
- [ ] Test: pullChanges with null dek imports plaintext
- [ ] Test: saveSyncConfig + loadSyncConfig round-trip
- [ ] Test: clearSyncConfig resets to default
- [ ] Gate: `npx tsc --noEmit && npx vitest run`

**Tests**: yes
**Gate**: full
