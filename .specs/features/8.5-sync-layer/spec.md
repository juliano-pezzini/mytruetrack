# Phase 8.5 — Sync Layer Specification

## Problem Statement

The app must sync encrypted data across devices without a server. The sync engine exports CRDT change-sets from cr-sqlite, encrypts them, uploads to user-owned cloud storage, and applies incoming changes from other devices. The cloud never sees plaintext. The user never resolves conflicts.

## Goals

- [ ] Abstract `CloudProvider` interface (Google Drive at launch, WebDAV in 8.9)
- [ ] Sync engine: export CRDT changes → encrypt → upload; download → decrypt → apply
- [ ] Google Drive provider (`appDataFolder`, OAuth PKCE)
- [ ] Conflict-free guarantee: CRDT convergence means no merge prompts
- [ ] All sync logic testable with a mock `CloudProvider` in Node.js

## Out of Scope

| Feature | Reason |
|---------|--------|
| WebDAV provider | Phase 8.9 |
| Real-time / live sync | Not needed — sync on app open + manual trigger |
| Partial sync / selective tables | All-or-nothing changeset blob for v1 |
| Compression of sync blobs | Post-launch optimization |
| UI for sync status | Phase 8.7 |
| OAuth consent screen / production verification | Deployment concern, not code |

---

## User Stories

### P1: CloudProvider interface ⭐ MVP

**User Story**: As a developer, I want an abstract CloudProvider interface so that the sync engine is decoupled from any specific cloud service.

**Acceptance Criteria**:

1. WHEN a provider is implemented THEN it SHALL expose: `upload(filename, data)`, `download(filename)`, `list()`, `delete(filename)`, `isAuthenticated()`
2. WHEN `upload` is called THEN it SHALL overwrite the file if it already exists
3. WHEN `download` is called for a non-existent file THEN it SHALL return `null`
4. WHEN `list` is called THEN it SHALL return file metadata (name, size, modifiedAt)
5. WHEN a new cloud service is added THEN only a new provider implementation is needed — sync engine code does not change

**Independent Test**: Mock provider implements the interface, sync engine uses it.

**Requirement ID**: SYN-01

---

### P1: Sync engine ⭐ MVP

**User Story**: As a user, I want my data to sync across devices so that I see the same accounts and transactions everywhere.

**Acceptance Criteria**:

1. WHEN `pushChanges(db, provider, dek)` is called THEN it SHALL export CRDT changes since the last push, encrypt them with the DEK, and upload via the provider
2. WHEN `pullChanges(db, provider, dek)` is called THEN it SHALL download the remote blob, decrypt it, and apply CRDT changes to the local database
3. WHEN both devices have made changes THEN CRDT merge SHALL converge without user intervention (conflict-free guarantee)
4. WHEN no changes exist since last sync THEN push/pull SHALL be no-ops (skip upload/download)
5. WHEN the remote blob does not exist THEN pull SHALL be a no-op (first device, nothing to pull)
6. WHEN sync completes THEN the engine SHALL persist the last-synced version number locally

**Independent Test**: Two in-memory databases, mock provider as the "cloud" — push from one, pull to the other, verify convergence.

**Requirement ID**: SYN-02

---

### P1: Google Drive provider ⭐ MVP

**User Story**: As a user, I want to sync via my Google Drive so that my encrypted data is stored in a place I already own and trust.

**Acceptance Criteria**:

1. WHEN the provider is created THEN it SHALL use `drive.appdata` scope only (no access to user's files)
2. WHEN `upload(filename, data)` is called THEN it SHALL upload to `appDataFolder` using the Drive v3 multipart upload API
3. WHEN `download(filename)` is called THEN it SHALL download the file content as `Uint8Array`
4. WHEN `list()` is called THEN it SHALL return files in the app's `appDataFolder`
5. WHEN `delete(filename)` is called THEN it SHALL remove the file from `appDataFolder`
6. WHEN the access token expires THEN the provider SHALL throw an auth error (re-auth is handled by the UI layer)

**Independent Test**: Type-checks; runtime verification requires browser + OAuth (manual or Playwright in 8.8).

**Requirement ID**: SYN-03

---

### P2: Sync state persistence

**User Story**: As a developer, I want sync state tracked in IndexedDB so that the engine knows what has already been synced and avoids redundant uploads.

**Acceptance Criteria**:

1. WHEN a push completes THEN the engine SHALL persist `{ lastPushedVersion: number, lastPushedAt: string }`
2. WHEN a pull completes THEN the engine SHALL persist `{ lastPulledAt: string }`
3. WHEN `getSyncState()` is called THEN it SHALL return the current state or defaults (version 0, never synced)

**Independent Test**: Push, verify state saved. Pull, verify state updated.

**Requirement ID**: SYN-04

---

## Edge Cases

- WHEN the network is unavailable during sync THEN push/pull SHALL throw a descriptive error (not corrupt local state)
- WHEN the encrypted blob is corrupted or decryption fails THEN pull SHALL throw without applying any changes
- WHEN the provider returns an auth error THEN the sync engine SHALL propagate it (UI handles re-auth)
- WHEN two devices push simultaneously THEN the second push overwrites the first blob — but the next pull on either device applies CRDT changes that converge correctly (last-blob-wins is safe because CRDT merge is idempotent)
- WHEN the sync blob is empty (no changes) THEN the engine SHALL skip the upload

---

## Requirement Traceability

| ID | Story | Priority |
|----|-------|----------|
| SYN-01 | CloudProvider interface | P1 |
| SYN-02 | Sync engine | P1 |
| SYN-03 | Google Drive provider | P1 |
| SYN-04 | Sync state persistence | P2 |
