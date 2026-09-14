# Cloud Vault Metadata Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/cloud-vault-metadata/design.md`  
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: none for test depth (`AGENTS.md` absent); CI/scripts from `package.json` + `.github/workflows/pr-checks.yml`. Floor from existing sync/crypto unit tests (`src/sync/*.test.ts`, `src/crypto/*.test.ts`). Strong defaults applied for domain logic.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Sync domain (`vault-metadata`, `device-identity`, `crsql-changes`, `sync-engine`) | unit | All branches; 1:1 to mapped ACs; listed edge cases for probe/restore/upsert/clear | `src/sync/*.test.ts` | `npm test` |
| Crypto reuse (restore unwrap path) | unit | Wrong passphrase + success path via restore helper tests | `src/sync/vault-metadata.test.ts` (uses key-derivation) | `npm test` |
| UI (`SetupWizard`, `SyncSection`) | none | Build gate only — repo has almost no page-level UI unit tests; behavior covered by domain helpers | - | `npm run typecheck` + `npm run lint` |
| E2E | none for MVP tasks | Manual/UAT after Execute; optional follow-up Playwright not in this task list | `e2e/` | `npm run test:e2e` (not required per task) |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests | `npm test -- src/sync/vault-metadata.test.ts src/sync/device-identity.test.ts src/sync/crsql-changes.test.ts src/sync/sync-engine.test.ts` |
| Full | After sync integration tasks | `npm test` |
| Build | After UI / phase completion | `npm run typecheck && npm run lint && npm test` |

---

## Execution Plan

Phases run sequentially. Tasks within a phase run in order.

### Phase 1: Metadata foundation

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Sync wiring

```
T6 → T7
```

### Phase 3: Setup restore UX

```
T8 → T9
```

### Phase 4: Settings + device attribution

```
T10 → T11 → T12
```

---

## Task Breakdown

### Phase 1: Metadata foundation

### T1: Vault metadata schema parse/serialize

**Status**: ✅ Done

**What**: Define `VaultMetadata` / `VaultDeviceEntry`, `VAULT_METADATA_FILENAME`, `parseVaultMetadata`, `serializeVaultMetadata`.
**Where**: `src/sync/vault-metadata.ts`
**Depends on**: None
**Reuses**: Base64 patterns from `crsql-changes.ts`; `KeyData` field meanings from `key-store.ts`
**Requirement**: CVM-01, CVM-02

**Done when**:

- [x] `version: 1` schema with base64 `wrappedDek` / `salt`, `iterations`, `devices` map
- [x] Parse rejects corrupt JSON and missing required fields
- [x] Round-trip serialize → parse preserves fields
- [x] Gate: quick unit tests pass

**Tests**: unit (`src/sync/vault-metadata.test.ts` — create)
**Gate**: quick

**Commit**: `feat(sync): add vault-metadata schema codec`

---

### T2: Device identity label helpers

**Status**: ✅ Done

**What**: Implement auto browser/OS label generation and local get/set with trim + max 64 chars.
**Where**: `src/sync/device-identity.ts`
**Depends on**: T1
**Reuses**: IndexedDB patterns from `sync-state.ts`
**Requirement**: CVM-19, CVM-20

**Done when**:

- [x] `generateDefaultDeviceLabel` / `detectBrowserId` return non-empty coarse labels
- [x] `setDeviceLabel` rejects empty / >64; `getDeviceLabel` returns custom or default
- [x] Persisted across reload (fake-indexeddb in tests)
- [x] Gate: quick unit tests pass

**Tests**: unit (`src/sync/device-identity.test.ts` — create)
**Gate**: quick

**Commit**: `feat(sync): add device identity labels`

---

### T3: Probe remote vault + delete metadata

**Status**: ✅ Done

**What**: Implement `probeRemoteVault` and `deleteVaultMetadata` against `CloudProvider`.
**Where**: `src/sync/vault-metadata.ts`
**Depends on**: T2
**Reuses**: `createMockCloudProvider`; segment name detection aligned with `changes-*.bin`
**Requirement**: CVM-12, CVM-13, CVM-14

**Done when**:

- [x] Returns `empty` | `ready` | `legacy` | `corrupt` per design probe rules
- [x] `deleteVaultMetadata` removes file when present; no-op when absent
- [x] Unit tests cover all four status kinds + delete
- [x] Gate: quick passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sync): probe and delete cloud vault metadata`

---

### T4: Upsert vault metadata

**Status**: ✅ Done

**What**: Implement `upsertVaultMetadata` (download-merge-upload; create if missing).
**Where**: `src/sync/vault-metadata.ts`
**Depends on**: T3
**Reuses**: `KeyData`; `getDeviceLabel` / `detectBrowserId` from T2
**Requirement**: CVM-01, CVM-02, CVM-03, CVM-06

**Done when**:

- [x] Writes key fields from local `KeyData` and upserts `devices[siteId]` with label, browser, `lastSeenAt`
- [x] Preserves other devices’ registry entries on merge
- [x] Creates file when remote missing
- [x] Unit tests cover create, merge, key-field refresh
- [x] Gate: quick passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sync): upsert vault-metadata.json on sync folder`

---

### T5: Restore vault from remote helper

**Status**: ✅ Done

**What**: Implement `restoreVaultFromRemote(provider, passphrase)` — download, unwrap, `saveKeyData` only after success.
**Where**: `src/sync/vault-metadata.ts`
**Depends on**: T4
**Reuses**: `deriveKek`, `unwrapDek`, `saveKeyData`, `loadKeyData` / `hasKeyData` for assertions
**Requirement**: CVM-08, CVM-09, CVM-10, CVM-11

**Done when**:

- [x] Correct passphrase → key persisted + DEK returned
- [x] Wrong passphrase → throws; no key store write
- [x] Missing/corrupt metadata → throws; no key store write
- [x] Gate: quick passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(sync): restore vault from cloud metadata`

---

### Phase 2: Sync wiring

### T6: Hook encrypted push to upsert metadata

**Status**: ✅ Done

**What**: After encrypted `pushDeltas` path (including segment no-op), call `upsertVaultMetadata`; never on `dek === null`.
**Where**: `src/sync/crsql-changes.ts`
**Depends on**: T5
**Reuses**: `loadKeyData`, `getSiteId`, `upsertVaultMetadata`, device label helpers
**Requirement**: CVM-01, CVM-03, CVM-04, CVM-05

**Done when**:

- [x] Encrypted push writes/updates `vault-metadata.json` even when no new segment
- [x] Unencrypted push does not create/overwrite metadata
- [x] Upsert failure surfaces as thrown sync error
- [x] Existing crsql-changes tests still pass; new cases added
- [x] Gate: full `npm test` passes

**Tests**: unit
**Gate**: full

**Commit**: `feat(sync): upsert vault metadata on encrypted push`

---

### T7: Clear cloud deletes metadata + startFreshVault

**Status**: ✅ Done

**What**: Extend `clearRemoteChangeSegments` to delete `vault-metadata.json`; add `startFreshVault` (clear cloud + `clearKeyData`).
**Where**: `src/sync/sync-engine.ts`
**Depends on**: T6
**Reuses**: `clearRemoteChangeSegments`, `clearKeyData`, `deleteVaultMetadata`
**Requirement**: CVM-16, CVM-17, CVM-18

**Done when**:

- [x] Clear removes segments and metadata file; resets sync watermarks
- [x] `startFreshVault` clears key store after successful cloud clear
- [x] Partial failure does not claim success (tests with failing provider mock)
- [x] Gate: full passes

**Tests**: unit (`src/sync/crsql-changes.test.ts` and/or `src/sync/sync-engine.test.ts`)
**Gate**: full

**Commit**: `feat(sync): clear vault metadata and start fresh vault`

---

### Phase 3: Setup restore UX

### T8: SetupWizard probe + Create guards

**Status**: ✅ Done

**What**: On setup choice, probe remote (when provider configured) and block Create for `ready` / `legacy` / `corrupt` with clear messaging and Clear/Start-fresh affordances.
**Where**: `src/ui/pages/SetupWizard.tsx`
**Depends on**: T7
**Reuses**: `probeRemoteVault`, `resolveActiveProvider`, `clearCloudSyncData` / `startFreshVault`
**Requirement**: CVM-07, CVM-12, CVM-14, CVM-15

**Done when**:

- [x] `ready` → Create disabled; Restore offered as primary
- [x] `legacy` / `corrupt` → Create + Restore blocked; Clear / Start fresh offered
- [x] `empty` → existing Create path unchanged
- [x] Gate: build passes

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): gate setup create on remote vault probe`

---

### T9: SetupWizard Restore + connect-provider gate

**Status**: ✅ Done

**What**: Restore existing vault flow (passphrase → `restoreVaultFromRemote` → unlock); if no provider, prompt connect first.
**Where**: `src/ui/pages/SetupWizard.tsx`
**Depends on**: T8
**Reuses**: `PassphraseInput`, `restoreVaultFromRemote`, `useVault().unlock`, SyncSection connect patterns
**Requirement**: CVM-07, CVM-08, CVM-10, CVM-11

**Done when**:

- [x] Successful restore unlocks vault
- [x] Wrong passphrase shows error; stays on Restore; no key write
- [x] No provider → connect prompt before Restore
- [x] Gate: build passes

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): restore existing vault in setup wizard`

---

### Phase 4: Settings + device attribution

### T10: SyncSection Start fresh vault

**Status**: ✅ Done

**What**: Add confirmed **Start fresh vault** action; ensure Clear cloud copy reflects metadata deletion.
**Where**: `src/ui/components/SyncSection.tsx`
**Depends on**: T9
**Reuses**: `startFreshVault`, existing clear confirm UX
**Requirement**: CVM-16, CVM-17

**Done when**:

- [x] Start fresh confirms, clears cloud + keys, routes to Setup Create
- [x] Does not route to Create if clear fails
- [x] Clear cloud messaging mentions vault metadata / sync history
- [x] Gate: build passes

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): add start fresh vault in sync settings`

---

### T11: Device rename + registry list in Settings

**What**: Device label editor + list known devices from probed/cached vault metadata.
**Where**: `src/ui/components/SyncSection.tsx`
**Depends on**: T10
**Reuses**: `getDeviceLabel`, `setDeviceLabel`, `probeRemoteVault` / metadata `devices`
**Requirement**: CVM-19, CVM-20, CVM-21

**Done when**:

- [ ] User can rename device; persisted locally; next push picks it up (via existing upsert)
- [ ] Known devices show label + last seen when metadata available
- [ ] Gate: build passes

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): show and rename sync device registry`

---

### T12: Attribute peer site ids with registry labels

**What**: When pull/sync errors (or listings) mention a peer `siteId`, include registry label when metadata is available.
**Where**: `src/sync/crsql-changes.ts`
**Depends on**: T11
**Reuses**: `downloadVaultMetadata` or in-memory registry passed into pull; keep errors actionable
**Requirement**: CVM-22

**Done when**:

- [ ] Decrypt/peer error includes device label when registry has `siteId`
- [ ] Falls back to site id only when label unknown
- [ ] Unit test covers labeled vs unlabeled peer error
- [ ] Gate: full passes

**Tests**: unit
**Gate**: full

**Commit**: `feat(sync): label peer sites from vault device registry`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4 → T5
Phase 2:  T6 → T7
Phase 3:  T8 → T9
Phase 4:  T10 → T11 → T12
```

**Batch packing (Execute):** 12 tasks → ~2 workers if sub-agents accepted  
- Batch A: Phase 1 + Phase 2 (T1–T7, 7 tasks)  
- Batch B: Phase 3 + Phase 4 (T8–T12, 5 tasks)

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Schema codec | 1 module surface | ✅ Granular |
| T2: Device identity | 1 module | ✅ Granular |
| T3: Probe + delete | 2 functions, same file | ✅ OK cohesive |
| T4: Upsert | 1 function | ✅ Granular |
| T5: Restore helper | 1 function | ✅ Granular |
| T6: Push hook | 1 integration change | ✅ Granular |
| T7: Clear + startFresh | sync-engine + clear behavior | ✅ OK cohesive |
| T8: Setup guards | 1 page, one concern | ✅ Granular |
| T9: Setup restore | 1 page, one concern | ✅ Granular |
| T10: Start fresh UI | 1 component action | ✅ Granular |
| T11: Device UI | 1 component concern | ✅ Granular |
| T12: Peer labels | 1 sync error enhancement | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | (root) | ✅ |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 (cross-phase via plan order; Phase 2: T6 root after Phase 1) | ✅ Phase 2 diagram T6 → T7; T6 deps T5 cross-phase OK |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 cross-phase; Phase 3: T8 → T9 | ✅ |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 cross-phase; Phase 4: T10 → T11 → T12 | ✅ |
| T11 | T10 | T10 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Sync domain | unit | unit | ✅ OK |
| T2 | Sync domain | unit | unit | ✅ OK |
| T3 | Sync domain | unit | unit | ✅ OK |
| T4 | Sync domain | unit | unit | ✅ OK |
| T5 | Sync domain / crypto path | unit | unit | ✅ OK |
| T6 | Sync domain | unit | unit | ✅ OK |
| T7 | Sync domain | unit | unit | ✅ OK |
| T8 | UI | none | none | ✅ OK |
| T9 | UI | none | none | ✅ OK |
| T10 | UI | none | none | ✅ OK |
| T11 | UI | none | none | ✅ OK |
| T12 | Sync domain | unit | unit | ✅ OK |
