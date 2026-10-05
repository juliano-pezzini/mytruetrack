# Setup Sync-First Validation

**Date**: 2026-09-16
**Spec**: `.specs/features/setup-sync-first/spec.md`
**Diff range**: `751532a..b5bbcb7`
**Verifier**: standalone fresh-eyes pass (sub-agent dispatch aborted; author ≠ verifier checklist from `validate.md`)
**Result**: PASS ✅ (domain + setup e2e evidence-backed; Settings/Connect UI ACs flagged Spec-precision per matrix Tests:none)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `vaultActionsForProbe` |
| T2 | ✅ Done | `inferStorageChoice` |
| T3 | ✅ Done | `SyncConfig.storageChoice` |
| T4 | ✅ Done | freeze + persist |
| T5 | ✅ Done | `startFreshVault(null \| provider)` |
| T6 | ✅ Done | Wizard `sync-choice` (Tests:none) |
| T7 | ✅ Done | Connect then probe (Tests:none) |
| T8 | ✅ Done | Freeze + setup confirms (Tests:none) |
| T9 | ✅ Done | Frozen Settings UI (Tests:none) |
| T10 | ✅ Done | Persist inferred on vault ready (Tests:none; helper unit-tested) |
| T11 | ✅ Done | `chooseThisDeviceOnly` helper |
| T12 | ✅ Done | Skip e2e |
| T13 | ✅ Done | Passphrase e2e; `unlock.spec.ts` updated so full e2e gate stays green |

---

## Gate Results

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | ✅ pass |
| Lint | `npm run lint` | ✅ pass |
| Test | `npm test` | ✅ **437 passed**, 0 failed (48 files) |
| E2E | `npm run test:e2e` | ✅ **59 passed** (chromium; run 2026-09-16 after `playwright install`) |

**Test integrity**: Domain suites grew (`storage-choice.test.ts`, `sync-config` storageChoice cases, `sync-engine` startFresh). No skipped tests. Count before feature (cloud-vault-metadata close): 418 unit; after: 437 unit (**+19**). E2E still 59 (one extra skip-path assertion; no deletions).

---

## Spec-Anchored Acceptance Criteria

### P1: Sync-first setup before any vault

| ID | Criterion | Spec-defined outcome | `file:line` + assertion / impl | Result |
| -- | --------- | -------------------- | ------------------------------ | ------ |
| SSF-01 | Welcome then Use cloud sync before Create/Restore/Skip | Connect + This device only visible; Create/Skip count 0 | `e2e/setup-local-only.spec.ts:16-19` - `expect(...'This device only').toBeVisible()`; `expect(...'Create a passphrase').toHaveCount(0)` | ✅ PASS |
| SSF-02 | No DEK / key-store until after Connect or This device only | `generateDek` only after storage choice | E2E order `e2e/setup-passphrase.spec.ts:10-11` (`chooseThisDeviceOnly` then Create). Impl `SetupWizard.tsx:349` `generateDek()` only in Create handler | ⚠️ Spec-precision gap (no key-store assertion before choice) |
| SSF-03 | This device only: Create+Skip, no Restore, no Google/WebDAV | `{ create: true, restore: false, skip: true }` | `src/sync/storage-choice.test.ts:22-26` - `expect(vaultActionsForProbe({ kind: 'local-only' })).toEqual({ create: true, restore: false, skip: true })` | ✅ PASS |
| SSF-04 | Connect then persist provider, probe, then vault actions | Probe before Create/Restore/Skip | Impl `SetupWizard.tsx:158-192` `handleSaveConnectAndProbe` — **UI Tests:none** | ⚠️ Spec-precision gap |
| SSF-05 | Connect/probe fail: recoverable error, no DEK, stay in setup | Error message; no `generateDek` | Impl `SetupWizard.tsx:190` `'Could not check the cloud folder...'` — **UI Tests:none** | ⚠️ Spec-precision gap |

### P1: Probe still blocks Create on existing cloud history

| ID | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| -- | --------- | -------------------- | ----------------------- | ------ |
| SSF-06 | Probe `empty` allows Create and Skip | `{ create: true, restore: false, skip: true }` | `src/sync/storage-choice.test.ts:30-34` - `expect(vaultActionsForProbe({ kind: 'empty' })).toEqual({ create: true, restore: false, skip: true })` | ✅ PASS |
| SSF-07 | Probe `ready` Restore only; Create disabled | `{ create: false, restore: true, skip: false }` | `src/sync/storage-choice.test.ts:38-42` - `expect(...ready...).toEqual({ create: false, restore: true, skip: false })` | ✅ PASS |
| SSF-08 | Probe `legacy` blocks Restore, Create, Skip | all false | `src/sync/storage-choice.test.ts:46-50` - `expect(...legacy...).toEqual({ create: false, restore: false, skip: false })` | ✅ PASS |
| SSF-09 | Probe `ready` disables Skip | `skip: false` | `src/sync/storage-choice.test.ts:41` - `skip: false` in ready expected object | ✅ PASS |
| SSF-10 | No Create path that leaves remote segments/metadata | Create false while ready/legacy | `src/sync/storage-choice.test.ts:38-50` ready + legacy blocked create | ✅ PASS |
| SSF-11 | Clear / Start fresh in setup need second confirm | Confirm UI before delete | Impl `SetupWizard.tsx:575-580` `setShowClearConfirm(true)` — **UI Tests:none** | ⚠️ Spec-precision gap |

### P1: Frozen provider in Settings

| ID | Criterion | Spec-defined outcome | `file:line` + assertion / impl | Result |
| -- | --------- | -------------------- | ------------------------------ | ------ |
| SSF-12 | Recorded choice: no provider-type radios | Explicit `storageChoice` wins; persist on ready | `src/sync/storage-choice.test.ts:69-73` - `expect(inferStorageChoice({ storageChoice: 'local-only', provider: 'google-drive' }, ...)).toBe('local-only')`; persist `storage-choice.test.ts:128-129` - `expect(choice).toBe('local-only')` | ✅ PASS (domain freeze). Settings radios: impl `SyncSection.tsx:463-476` — **UI Tests:none** |
| SSF-13 | Local-only: no Connect / WebDAV / enable-sync | No first-connect | Impl `SyncSection.tsx:459` `isCloudChoice`; Connect only `storageChoice === 'google-drive'` — **UI Tests:none** | ⚠️ Spec-precision gap |
| SSF-14 | Google Drive: read-only label + Reconnect | Reconnect, provider stays Drive | `src/sync/storage-choice.test.ts:115-117` freeze keeps tokens; Disconnect impl `googleDriveConfig(null)` — **UI Tests:none** | ⚠️ Spec-precision gap |
| SSF-15 | WebDAV: endpoint/folder read-only; credentials retry | Save cannot change endpoint/folder | Impl `SyncSection.tsx:492-504` `readOnly` — **UI Tests:none** | ⚠️ Spec-precision gap |
| SSF-16 | Cloud choice still has Push/Pull/Clear/Start fresh/rename | Cloud controls when not local-only | Impl `SyncSection.tsx:677-686` Push gated `isCloudChoice` — **UI Tests:none** | ⚠️ Spec-precision gap |

### P1: Start fresh returns to sync-first setup

| ID | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| -- | --------- | -------------------- | ----------------------- | ------ |
| SSF-17 | Confirmed Start fresh clears remote+keys; routes Use cloud sync | Folder empty; `storageChoice` null; wizard `sync-choice` | Domain `src/sync/sync-engine.test.ts:58-61` - `expect(await provider.list()).toEqual([])`; `expect((await loadSyncConfig()).storageChoice).toBeNull()`. Route impl `SetupWizard.tsx:116-118` `setup-after-fresh === 'sync'` → `setStep('sync-choice')`; Settings `SyncSection.tsx:388` | ⚠️ Spec-precision gap (domain wipe ✅; landing UI untested) |
| SSF-18 | After Start fresh, Connect or This device only again | Same as SSF-01 after unfreeze | Domain unfreeze `sync-engine.test.ts:60`; UI landing **Tests:none** | ⚠️ Spec-precision gap |
| SSF-19 | Start fresh with no cloud provider: local clear, no remote delete | Keys gone; `storageChoice` null | `src/sync/sync-engine.test.ts:107-109` - `await startFreshVault(null)`; `expect(await hasKeyData()).toBe(false)`; `expect((await loadSyncConfig()).storageChoice).toBeNull()` | ✅ PASS |
| SSF-20 | Start fresh/Clear fail: report; do not Create while ready/legacy | Keys+config retained | `src/sync/sync-engine.test.ts:89-91` - `rejects.toThrow(/metadata delete failed/i)`; `expect(await hasKeyData()).toBe(true)`; `expect((await loadSyncConfig()).storageChoice).toBe('google-drive')` | ✅ PASS |

**Status**: ⚠️ Spec-precision gaps flagged (Connect/Settings/confirm UI; matrix Tests:none)

**Matched**: 11/20 ACs with automated assertion evidence  
**Gaps**: 9 Spec-precision (UI-only or landing untested)

---

## Discrimination Sensor

**Scratch**: git worktree `.tmp-ssf-sensor` at `b5bbcb7`. Tests invoked via main `node_modules/.bin/vitest` with cwd = scratch. Real worktree not mutated. Baseline porcelain matched after `git worktree remove` (leftover locked files are not tracked).

| # | Mutation | File | Description | Targeted tests | Killed? |
| - | -------- | ---- | ----------- | -------------- | ------- |
| A | `ready` returns `CREATE_AND_SKIP` | `src/sync/storage-choice.ts:29` | Create allowed beside existing vault metadata | `storage-choice.test.ts` | ✅ Killed — `storage-choice.test.ts:38` expected restore-only, got create+skip |
| B | Incomplete persist returns `'local-only'` | `src/sync/storage-choice.ts:72` | Freeze during `needs-setup` | `storage-choice.test.ts` | ✅ Killed — `storage-choice.test.ts:146` `expect(choice).toBeNull()` got `'local-only'` |
| C | Skip `clearSyncConfig` in `startFreshVault` | `src/sync/sync-engine.ts:104` | Freeze survives start-fresh | `sync-engine.test.ts` | ✅ Killed — `sync-engine.test.ts:60` `storageChoice` expected null, got `'google-drive'` |

**Sensor depth**: lightweight (3 targeted behavior mutations)  
**Result**: 3/3 killed — PASS ✅  
**Isolation**: real `src/sync/storage-choice.ts` still `RESTORE_ONLY`; `persist` still `return null`; `startFreshVault` still `clearSyncConfig()`

---

## Interactive UAT Results (if performed)

Not run in this pass. Orchestrator presents UAT to the user after this report.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ (`unlock.spec.ts` updated only so full e2e gate still reaches Create) |
| Matches patterns | ✅ |
| Spec-anchored outcome check | ✅ domain; ⚠️ UI gaps flagged |
| Per-layer Coverage Expectation | ✅ domain 1:1; UI Tests:none honored; e2e skip+create |
| Every test maps to a requirement | ✅ |
| Documented guidelines | `.github/copilot-instructions.md` (Vitest + Playwright) |

---

## Edge Cases

| Edge case | Evidence | Result |
| --------- | -------- | ------ |
| Cancel Connect before success: no frozen cloud provider | Impl `SetupWizard.tsx:210` `cancelConnect` writes empty config | ⚠️ UI only |
| Connect ready then abandon Restore: no local DEK | `generateDek` not on restore path; Create disabled when ready (`storage-choice.test.ts:38`) | ✅ domain block; ⚠️ stay-in-setup UI |
| Origin wipe: next visit is sync-first | Local freeze lives in IDB; wipe clears it. E2E `clearStorage` + SSF-01 | ✅ |
| Google Reconnect fail: keep Drive, no WebDAV switch | Impl Settings has no radios (`SyncSection.tsx:463-476`) | ⚠️ UI only |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm test` (build); e2e previously `npm run test:e2e`
- **Result**: 437 unit passed, 0 failed, 0 skipped; 59 e2e passed
- **Test count before feature**: 418 unit
- **Test count after feature**: 437 unit
- **Delta**: +19 unit
- **Skipped tests**: none
- **Failures**: none

---

## Ranked Gaps

1. **SSF-04 / SSF-05** — Connect-then-probe and connect/probe errors have no automated UI/e2e assertion (`SetupWizard.tsx` handleSaveConnectAndProbe).
2. **SSF-11** — Setup Clear/Start fresh second confirm is UI-only (`SetupWizard.tsx:575-580`).
3. **SSF-13..SSF-16** — Frozen Settings surfaces (no radios, local-only hide Connect, Reconnect, read-only WebDAV, Push/Pull) are UI-only (`SyncSection.tsx`).
4. **SSF-17 / SSF-18** — Domain proves wipe+unfreeze; landing on Use cloud sync after Settings Start fresh is sessionStorage + wizard step without e2e.
5. **SSF-02** — E2E proves button order; no test asserts `hasKeyData()` is false until after storage choice.

These are **matrix-expected** Spec-precision gaps (UI Tests:none except skip/create e2e), not missing domain coverage.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SSF-01 | Implementing | ✅ Verified |
| SSF-02 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-03 | Implementing | ✅ Verified |
| SSF-04 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-05 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-06 | In Tasks | ✅ Verified |
| SSF-07 | In Tasks | ✅ Verified |
| SSF-08 | In Tasks | ✅ Verified |
| SSF-09 | In Tasks | ✅ Verified |
| SSF-10 | In Tasks | ✅ Verified |
| SSF-11 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-12 | Implementing | ✅ Verified (domain); UI radios untested |
| SSF-13 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-14 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-15 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-16 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-17 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-18 | Implementing | ⚠️ Verified with spec-precision gap |
| SSF-19 | Implementing | ✅ Verified |
| SSF-20 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 11/20 ACs matched spec outcome with automated evidence; 9 spec-precision gaps flagged
**Sensor**: 3/3 mutations killed
**Gate**: 437 unit passed; 59 e2e passed

**What works**: Probe policy, freeze/infer/persist, startFresh fail-closed, This device only before Skip/Create in Playwright.

**Issues found**: none that fail the feature; UI Connect/Settings/confirm lack automated tests by matrix.

**Next steps**: Interactive UAT for Connect, Settings freeze, and Start fresh landing.
