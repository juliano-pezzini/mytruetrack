# Setup Sync-First Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/setup-sync-first/design.md`
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `.github/copilot-instructions.md` (Vitest unit + Playwright e2e; co-locate `Foo.tsx` + `Foo.test.tsx` — SetupWizard has no page unit tests today), `vitest.config.ts` (80% coverage on `src/sync/**`), `package.json`, `.github/workflows/pr-checks.yml`. Floor: `src/sync/*.test.ts`, `e2e/setup-*.spec.ts`. Strong defaults for sync domain; UI unit none (same as cloud-vault-metadata); setup e2e required because existing Playwright specs click Create/Skip immediately after Welcome.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Sync domain (`storage-choice`, `sync-config`, `sync-engine`) | unit | All branches of `vaultActionsForProbe` / `inferStorageChoice` / freeze+persist; startFresh success, null-provider, remote-fail-closed | `src/sync/*.test.ts` | `npm test` |
| App (`vault-provider` persist wiring) | none | Persist helper is unit-tested in sync domain; provider only calls it | - | `npm run typecheck` |
| UI (`SetupWizard`, `SyncSection`) | none | Build gate; Create/Restore/Skip rules live in `vaultActionsForProbe` | - | `npm run typecheck && npm run lint` |
| E2E setup | e2e | Happy paths: This device only → skip; This device only → create passphrase. Must not reach Create/Skip before storage choice | `e2e/setup-*.spec.ts` | `npm run test:e2e` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After sync-domain unit tasks | `npm test -- src/sync/storage-choice.test.ts src/sync/sync-config.test.ts src/sync/sync-engine.test.ts` |
| Full | After e2e tasks | `npm test && npm run test:e2e` |
| Build | After UI / phase completion | `npm run typecheck && npm run lint && npm test` |

---

## Execution Plan

Phases run sequentially. Tasks within a phase run in order.

### Phase 1: Domain freeze

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Setup wizard

```
T6 → T7 → T8
```

### Phase 3: Settings + ready persist

```
T9 → T10
```

### Phase 4: Setup e2e

```
T11 → T12 → T13
```

---

## Task Breakdown

### Phase 1: Domain freeze

### T1: Vault actions policy

**Status**: ✅ Done

**What**: Pure `vaultActionsForProbe` plus `StorageChoice` type.
**Where**: `src/sync/storage-choice.ts`
**Depends on**: None
**Reuses**: `RemoteVaultStatus` from `src/sync/vault-metadata.ts`
**Requirement**: SSF-03, SSF-06, SSF-07, SSF-08, SSF-09, SSF-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Table from design is implemented (`local-only` / `empty` / `ready` / `legacy` / `corrupt`)
- [x] `ready` and `legacy`/`corrupt` never return `create: true` or `skip: true`
- [x] `local-only` and `empty` never return `restore: true`
- [x] Gate: quick unit tests pass

**Tests**: unit (`src/sync/storage-choice.test.ts` — create)
**Gate**: quick

**Commit**: `feat(sync): add vault-choice policy for setup probe`

---

### T2: Infer storage choice

**What**: `inferStorageChoice` for existing origins without a freeze field.
**Where**: `src/sync/storage-choice.ts`
**Depends on**: T1
**Reuses**: T1 `StorageChoice`
**Requirement**: SSF-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Explicit `storageChoice` wins
- [ ] `provider` google-drive or webdav infers that choice
- [ ] `hasVault` or `skipped` with null provider infers `local-only`
- [ ] Incomplete setup (no vault, not skipped, no provider) infers `null`
- [ ] Gate: quick unit tests pass

**Tests**: unit (`src/sync/storage-choice.test.ts` — extend)
**Gate**: quick

**Commit**: `feat(sync): infer frozen storage choice for existing origins`

---

### T3: Persist storageChoice on SyncConfig

**What**: Add `storageChoice` to the sync-config record; round-trip and treat missing field as `null`.
**Where**: `src/sync/sync-config.ts`
**Depends on**: T2
**Reuses**: `loadSyncConfig` / `saveSyncConfig` / existing IDB store
**Requirement**: SSF-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `SyncConfig.storageChoice` is `StorageChoice | null`; default `null`
- [ ] Load of pre-feature records (no field) returns `storageChoice: null`
- [ ] Save/load round-trips `local-only` and `google-drive`
- [ ] Existing `sync-config.test.ts` cases still pass (add `storageChoice: null` where needed)
- [ ] Gate: quick unit tests pass

**Tests**: unit (`src/sync/sync-config.test.ts` — extend)
**Gate**: quick

**Commit**: `feat(sync): persist storageChoice on sync config`

---

### T4: Freeze and persist-inferred helpers

**What**: `freezeStorageChoice` and `persistInferredStorageChoice` writing the IDB config.
**Where**: `src/sync/storage-choice.ts`
**Depends on**: T3
**Reuses**: `loadSyncConfig` / `saveSyncConfig`; T2 `inferStorageChoice`
**Requirement**: SSF-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `freezeStorageChoice` sets `storageChoice` and keeps existing provider/tokens
- [ ] `persistInferredStorageChoice` writes only when inferred is non-null and differs from stored
- [ ] Does not freeze incomplete setup (`null`)
- [ ] Gate: quick unit tests pass

**Tests**: unit (`src/sync/storage-choice.test.ts` — extend)
**Gate**: quick

**Commit**: `feat(sync): freeze and persist inferred storage choice`

---

### T5: Start fresh unfreezes storage

**What**: `startFreshVault` accepts `CloudProvider | null`, then clears keys, sync config, sync state, and `vault-skipped`.
**Where**: `src/sync/sync-engine.ts`
**Depends on**: T4
**Reuses**: `clearCloudSyncData`, `clearKeyData`, `clearSyncConfig`, `clearSyncState`
**Requirement**: SSF-17, SSF-19, SSF-20

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] `provider === null` skips remote delete and still clears local identity
- [ ] Remote delete failure still leaves keys and sync config intact
- [ ] Successful cloud start-fresh leaves empty provider list and `loadSyncConfig().storageChoice === null`
- [ ] Gate: quick unit tests pass

**Tests**: unit (`src/sync/sync-engine.test.ts` — extend)
**Gate**: quick

**Commit**: `feat(sync): start fresh clears frozen storage choice`

---

### Phase 2: Setup wizard

### T6: Sync-choice step before passphrase

**What**: After Welcome, show Use cloud sync (Connect vs This device only). Create/Restore/Skip are unreachable until that choice. This device only uses `vaultActionsForProbe({ kind: 'local-only' })`.
**Where**: `src/ui/pages/SetupWizard.tsx`
**Depends on**: T1
**Reuses**: Existing Welcome / choice / passphrase steps
**Requirement**: SSF-01, SSF-02, SSF-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] New `sync-choice` step is the only path out of Welcome
- [ ] `generateDek` / `saveKeyData` still only run from the existing Create handler
- [ ] This device only does not prompt Google or WebDAV and does not offer Restore
- [ ] Gate: build (`npm run typecheck && npm run lint && npm test`)

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): ask cloud vs local-only before vault setup`

---

### T7: Connect then probe before vault actions

**What**: Connect Google/WebDAV, persist provider without freezing, probe, then show Create/Restore/Skip from `vaultActionsForProbe`. Cancel/fail stays in setup with no DEK; cancel writes `DEFAULT_CONFIG`.
**Where**: `src/ui/pages/SetupWizard.tsx`
**Depends on**: T6
**Reuses**: Existing `connect-cloud` step, `runProbe`, `probeRemoteVault`
**Requirement**: SSF-04, SSF-05

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Connect success probes before the vault-choice buttons
- [ ] Connect/probe errors show a recoverable message and do not persist a DEK
- [ ] Back/cancel from Connect returns to `sync-choice` without `storageChoice`
- [ ] Gate: build

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): probe cloud folder before create or restore`

---

### T8: Freeze on complete; confirm Clear/Start fresh; land on sync-choice

**What**: Freeze `storageChoice` on Create, Restore, and Skip success. Setup Clear/Start fresh use Settings-style confirm. `setup-after-fresh=sync` opens `sync-choice`. Start fresh calls `startFreshVault`.
**Where**: `src/ui/pages/SetupWizard.tsx`
**Depends on**: T7
**Reuses**: T4 `freezeStorageChoice`; T5 `startFreshVault`; SyncSection confirm copy
**Requirement**: SSF-11, SSF-17, SSF-18

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Create / Restore / Skip call `freezeStorageChoice` with the matching choice
- [ ] Clear and Start fresh require a second confirm; cancel leaves remote data
- [ ] After confirmed Start fresh, step is `sync-choice` (not passphrase)
- [ ] `setup-after-fresh === 'sync'` skips Welcome into `sync-choice`; `'create'` is gone
- [ ] Gate: build

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): freeze storage choice and confirm setup cloud wipe`

---

### Phase 3: Settings + ready persist

### T9: Frozen provider Settings UI

**What**: Remove provider radios. Render from `storageChoice`. Google Reconnect/token-only Disconnect. WebDAV endpoint/folder read-only; credentials retry. Local-only: no Connect, no Push/Pull/Clear; Start fresh remains and uses `startFreshVault` + `setup-after-fresh=sync`.
**Where**: `src/ui/components/SyncSection.tsx`
**Depends on**: T5
**Reuses**: Existing Reconnect / Push / Pull / Clear / rename; T5 `startFreshVault`
**Requirement**: SSF-12, SSF-13, SSF-14, SSF-15, SSF-16, SSF-17

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] No `none` / WebDAV / Drive radio group
- [ ] First-time Connect is impossible when `storageChoice` is `local-only`
- [ ] WebDAV Save cannot change endpoint or folder
- [ ] Google Disconnect leaves `provider: 'google-drive'`
- [ ] Start fresh sets `setup-after-fresh=sync` and works with `provider | null`
- [ ] Gate: build

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): freeze Settings cloud provider after setup`

---

### T10: Persist inferred choice when vault is ready

**What**: When the app is already set up (has vault or skipped), call `persistInferredStorageChoice` so pre-feature origins get a freeze without opening Settings.
**Where**: `src/app/vault-provider.tsx`
**Depends on**: T9
**Reuses**: T4 `persistInferredStorageChoice`
**Requirement**: SSF-12

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Ready vault (unlock or skip) persists inferred `storageChoice` once
- [ ] Incomplete setup (`needs-setup`) does not freeze
- [ ] Gate: build

**Tests**: none
**Gate**: build

**Commit**: `feat(app): persist inferred storage choice on vault ready`

---

### Phase 4: Setup e2e

### T11: E2E helper for This device only

**What**: Helper to leave Welcome via This device only so setup specs share one path.
**Where**: `e2e/helpers.ts`
**Depends on**: T8
**Reuses**: `gotoApp` / `clearStorage`
**Requirement**: SSF-01, SSF-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Helper clicks Get Started then This device only
- [ ] Gate: build (helper unused until T12)

**Tests**: none
**Gate**: build

**Commit**: `test(e2e): add this-device-only setup helper`

---

### T12: E2E skip path uses This device only

**What**: Update local-only setup specs so Skip is after This device only, not right after Welcome.
**Where**: `e2e/setup-local-only.spec.ts`
**Depends on**: T11
**Reuses**: T11 helper
**Requirement**: SSF-01, SSF-03

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] Skip tests go Welcome → This device only → Skip
- [ ] Create/Skip buttons are not the first screen after Get Started
- [ ] Gate: full (`npm test && npm run test:e2e`)

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): require this-device-only before skip encryption`

---

### T13: E2E passphrase path uses This device only

**What**: Update passphrase setup specs to choose This device only before Create a passphrase.
**Where**: `e2e/setup-passphrase.spec.ts`
**Depends on**: T12
**Reuses**: T11 helper
**Requirement**: SSF-01, SSF-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [ ] All three passphrase tests click This device only before Create a passphrase
- [ ] Gate: full

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): require this-device-only before create passphrase`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4 → T5
Phase 2:  T6 → T7 → T8
Phase 3:  T9 → T10
Phase 4:  T11 → T12 → T13
```

Execution is strictly sequential. ~13 tasks pack as two batches (~T1–T8 and ~T9–T13) if Execute uses sub-agents.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Vault actions policy | 1 function + type | ✅ Granular |
| T2: Infer storage choice | 1 function | ✅ Granular |
| T3: SyncConfig field | 1 config shape | ✅ Granular |
| T4: Freeze/persist helpers | 2 cohesive functions, same file | ✅ OK cohesive |
| T5: startFreshVault | 1 function | ✅ Granular |
| T6: Sync-choice step | 1 wizard step | ✅ Granular |
| T7: Connect then probe | 1 wizard flow | ✅ Granular |
| T8: Freeze + confirms | 1 wizard completion path | ✅ Granular |
| T9: Frozen Settings UI | 1 component | ✅ Granular |
| T10: Persist inferred on ready | 1 call site | ✅ Granular |
| T11: E2E helper | 1 helper | ✅ Granular |
| T12: E2E skip specs | 1 spec file | ✅ Granular |
| T13: E2E passphrase specs | 1 spec file | ✅ Granular |

**Granularity check**: all tasks ✅ (T4 is two cohesive helpers in one file).

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | (phase 1 start) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T1 | T6 start of phase 2 | ✅ Match (T1 is prior phase) |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T5 | T9 start of phase 3 | ✅ Match (T5 prior phase) |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T8 | T11 start of phase 4 | ✅ Match (T8 prior phase) |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Sync domain | unit | unit | ✅ OK |
| T2 | Sync domain | unit | unit | ✅ OK |
| T3 | Sync domain | unit | unit | ✅ OK |
| T4 | Sync domain | unit | unit | ✅ OK |
| T5 | Sync domain | unit | unit | ✅ OK |
| T6 | UI | none | none | ✅ OK |
| T7 | UI | none | none | ✅ OK |
| T8 | UI | none | none | ✅ OK |
| T9 | UI | none | none | ✅ OK |
| T10 | App persist wiring | none | none | ✅ OK |
| T11 | E2E helper | none (helper only) | none | ✅ OK |
| T12 | E2E setup | e2e | e2e | ✅ OK |
| T13 | E2E setup | e2e | e2e | ✅ OK |

---
