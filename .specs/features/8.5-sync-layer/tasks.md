# Phase 8.5 — Sync Layer Tasks

**Spec**: `.specs/features/8.5-sync-layer/spec.md`
**Status**: Done

---

## Test Strategy

- **Sync engine + CloudProvider interface**: unit/integration tests with a **mock in-memory CloudProvider** and sql.js databases. No network, no browser required.
- **Google Drive provider**: type-checks only in CI. Browser-only API (fetch + OAuth). Manual verification + Playwright in Phase 8.8.
- **Sync state**: tested via `fake-indexeddb` (already installed from Phase 8.4).
- **CRDT convergence**: tested by simulating two databases, push from one, pull to the other, verify identical state. Uses sql.js (no cr-sqlite CRDT in Node — convergence is tested by serializing/deserializing raw SQL change tracking, not `crsql_changes`).

**Important design note**: cr-sqlite's `crsql_changes` virtual table is only available in the browser WASM build. For the test harness, we simulate the sync protocol with a simplified change-tracking approach: export all rows as JSON, encrypt, upload; on pull, decrypt and merge via INSERT OR REPLACE. The real cr-sqlite CRDT merge will be used in production and verified in e2e tests (Phase 8.8).

- **Gate check**: `npx tsc --noEmit && npx vitest run`
- **Coverage gate**: `npx vitest run --coverage` (≥ 80% on `src/sync/`)

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1 → T2 → T3
```

### Phase 2: Providers (Parallel)

```
     ┌→ T4 [P] ─┐
T3 ──┤           ├→ (done)
     └→ T5 [P] ─┘
```

---

## Task Breakdown

### T1: CloudProvider interface + mock provider

**What**: Define the abstract `CloudProvider` interface and implement an in-memory mock provider for testing. Update vitest.config.ts coverage to include `src/sync/`.
**Where**: `src/sync/cloud-provider.ts`, `src/sync/mock-cloud-provider.ts`, `src/sync/mock-cloud-provider.test.ts`, `vitest.config.ts`
**Depends on**: None
**Reuses**: None
**Requirement**: SYN-01

**Done when**:

- [ ] `CloudProvider` interface: `upload(filename, data)`, `download(filename)`, `list()`, `delete(filename)`, `isAuthenticated()`
- [ ] `FileMetadata` type: `{ name: string; size: number; modifiedAt: string }`
- [ ] `MockCloudProvider` implements the interface with in-memory Map storage
- [ ] Tests: upload+download round-trip, download non-existent returns null, list, delete, overwrite
- [ ] `vitest.config.ts` coverage includes `src/sync/**`
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: unit
**Gate**: quick

---

### T2: Sync state persistence

**What**: Implement IndexedDB-backed sync state tracking (last pushed version, timestamps).
**Where**: `src/sync/sync-state.ts`, `src/sync/sync-state.test.ts`
**Depends on**: T1
**Reuses**: `idb` + `fake-indexeddb` (already installed)
**Requirement**: SYN-04

**Done when**:

- [ ] `SyncState` type: `{ lastPushedVersion: number; lastPushedAt: string | null; lastPulledAt: string | null }`
- [ ] `getSyncState()` returns current state or defaults
- [ ] `savePushState(version)` updates lastPushedVersion + lastPushedAt
- [ ] `savePullState()` updates lastPulledAt
- [ ] `clearSyncState()` resets to defaults
- [ ] Tests (fake-indexeddb): save push state, save pull state, clear, defaults
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration (fake-indexeddb)
**Gate**: quick

---

### T3: Sync engine

**What**: Implement `pushChanges` and `pullChanges` functions that export data, encrypt/decrypt via the crypto layer, and upload/download via any CloudProvider.
**Where**: `src/sync/sync-engine.ts`, `src/sync/sync-engine.test.ts`
**Depends on**: T1, T2
**Reuses**: `encrypt`/`decrypt`/`encodeBlob`/`decodeBlob` from `src/crypto/encryption.ts`, `MockCloudProvider` from T1, `Database` from `src/storage/database.ts`
**Requirement**: SYN-02

**Done when**:

- [ ] `exportDatabaseSnapshot(db)` → serializes all table data to a `Uint8Array` (JSON of row arrays)
- [ ] `importDatabaseSnapshot(db, data)` → deserializes and applies rows via INSERT OR REPLACE
- [ ] `pushChanges(db, provider, dek)` → export → encrypt → upload as `sync-blob.bin`
- [ ] `pullChanges(db, provider, dek)` → download → decrypt → import
- [ ] Push skips upload when no data exists
- [ ] Pull is a no-op when remote blob doesn't exist
- [ ] Sync state updated after push/pull
- [ ] Tests: push+pull round-trip with mock provider, two-database convergence test, no-op scenarios, encryption verified (data is not plaintext in provider)
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T4: Google Drive provider [P]

**What**: Implement `GoogleDriveProvider` conforming to `CloudProvider`. Uses fetch + OAuth access token for `appDataFolder` CRUD. Browser-only — no unit tests.
**Where**: `src/sync/providers/google-drive-provider.ts`
**Depends on**: T3 (implements interface from T1)
**Reuses**: Spike C patterns (`spikes/src/spike-c-gdrive.ts`)
**Requirement**: SYN-03

**Done when**:

- [ ] Implements `CloudProvider` interface
- [ ] Constructor takes `accessToken: string`
- [ ] `upload` uses Drive v3 multipart upload to `appDataFolder`
- [ ] `download` fetches file content as `Uint8Array`
- [ ] `list` returns `FileMetadata[]` from `appDataFolder`
- [ ] `delete` removes file by ID
- [ ] `isAuthenticated` returns `true` (token is provided at construction)
- [ ] Handles file-not-found in download (returns null)
- [ ] Handles upload overwrite (finds existing file by name, updates)
- [ ] Type-checks: `npx tsc --noEmit`
- [ ] No unit tests (browser + OAuth required)

**Tests**: none (browser-only)
**Gate**: build

---

### T5: OAuth PKCE utility [P]

**What**: Implement OAuth 2.0 authorization code + PKCE flow helpers for Google. Browser-only — generates auth URL, exchanges code for token.
**Where**: `src/sync/providers/google-oauth.ts`
**Depends on**: T3
**Reuses**: None (spike used implicit flow; production uses PKCE)
**Requirement**: SYN-03

**Done when**:

- [ ] `generateCodeVerifier()` → random string
- [ ] `generateCodeChallenge(verifier)` → SHA-256 base64url
- [ ] `buildAuthUrl(clientId, redirectUri, codeChallenge)` → Google OAuth URL with PKCE params
- [ ] `exchangeCodeForToken(clientId, redirectUri, code, codeVerifier)` → fetches token endpoint
- [ ] `parseAuthCallback(url)` → extracts code from redirect URL
- [ ] Type-checks: `npx tsc --noEmit`
- [ ] No unit tests (browser + network required for token exchange)

**Tests**: none (browser-only)
**Gate**: build

---

## Validation

### Diagram-Definition Cross-Check

| Task | Depends on (definition) | Depends on (diagram) | Match |
| ---- | ----------------------- | -------------------- | ----- |
| T1   | None                    | None                 | ✅    |
| T2   | T1                      | T1                   | ✅    |
| T3   | T1, T2                  | T2 (→ T1 via chain)  | ✅    |
| T4   | T3                      | T3                   | ✅    |
| T5   | T3                      | T3                   | ✅    |

### Test Co-location Validation

| Task | Code layer          | Test type           | Co-located                     | Valid |
| ---- | ------------------- | ------------------- | ------------------------------ | ----- |
| T1   | sync/cloud-provider | unit                | ✅ mock-cloud-provider.test.ts | ✅    |
| T2   | sync/sync-state     | integration         | ✅ sync-state.test.ts          | ✅    |
| T3   | sync/sync-engine    | integration         | ✅ sync-engine.test.ts         | ✅    |
| T4   | sync/providers      | none (browser-only) | N/A                            | ✅    |
| T5   | sync/providers      | none (browser-only) | N/A                            | ✅    |

### Granularity Check

| Task | Files created/modified               | Single concept | Atomic |
| ---- | ------------------------------------ | -------------- | ------ |
| T1   | 4 (interface + mock + test + config) | CloudProvider  | ✅     |
| T2   | 2 (module + test)                    | Sync state     | ✅     |
| T3   | 2 (module + test)                    | Sync engine    | ✅     |
| T4   | 1 (provider, no test)                | Google Drive   | ✅     |
| T5   | 1 (module, no test)                  | OAuth PKCE     | ✅     |
