# Cloud Vault Metadata Validation

**Date**: 2026-09-14
**Spec**: `.specs/features/cloud-vault-metadata/spec.md`
**Diff range**: `3611a16..7373ae2`
**Verifier**: independent sub-agent (author ≠ verifier)
**Result**: PASS ✅ (domain ACs evidence-backed; UI ACs flagged Spec-precision per matrix Tests:none)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | Schema codec |
| T2 | ✅ Done | Device identity |
| T3 | ✅ Done | Probe + delete |
| T4 | ✅ Done | Upsert |
| T5 | ✅ Done | Restore helper |
| T6 | ✅ Done | Encrypted push upsert |
| T7 | ✅ Done | Clear + startFresh |
| T8 | ✅ Done | SetupWizard probe guards (Tests:none) |
| T9 | ✅ Done | SetupWizard Restore (Tests:none) |
| T10 | ✅ Done | SyncSection Start fresh (Tests:none) |
| T11 | ✅ Done | Device rename UI (Tests:none) |
| T12 | ✅ Done | Peer site labels |

---

## Gate Results

| Gate | Command | Result |
| ---- | ------- | ------ |
| Typecheck | `npm run typecheck` | ✅ pass |
| Lint | `npm run lint` | ✅ pass |
| Test | `npm test` | ✅ **418 passed**, 0 failed (47 files) |

**Test integrity**: Feature adds domain suites (`vault-metadata`, `device-identity`, extended `crsql-changes` / `sync-engine`); no evidence of deleted or weakened prior assertions in gate run.

---

## Spec-Anchored Acceptance Criteria

| ID | Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion / impl | Result |
| -- | ------------------------- | -------------------- | ------------------------------ | ------ |
| CVM-01 | Encrypted push upserts vault-metadata JSON | Metadata file present after encrypted push (incl. segment no-op) | `src/sync/crsql-changes.test.ts:135` - `expect(await provider.download(VAULT_METADATA_FILENAME)).not.toBeNull()` | ✅ PASS |
| CVM-02 | Metadata includes wrappedDek, salt, iterations | Fields present for unwrap | `src/sync/vault-metadata.test.ts:123-125` - `expect(meta.wrappedDek).toBe('AQID')`; `expect(meta.salt).toBe('CQk=')`; `expect(meta.iterations).toBe(600_000)` | ✅ PASS |
| CVM-03 | Upserts device registry by siteId with label, browser, lastSeenAt | Device entry fields set | `src/sync/vault-metadata.test.ts:126-127` - `expect(meta.devices.aa).toMatchObject({ label: 'Laptop', browser: 'chrome' })`; `expect(meta.devices.aa!.lastSeenAt.length).toBeGreaterThan(0)` | ✅ PASS |
| CVM-04 | Push without DEK does not write metadata | No vault-metadata file | `src/sync/crsql-changes.test.ts:247` - `expect(await provider.download(VAULT_METADATA_FILENAME)).toBeNull()` | ✅ PASS |
| CVM-05 | Metadata upsert failure → sync error | Push rejects on metadata upload fail | `src/sync/crsql-changes.test.ts:154` - `await expect(pushDeltas(...)).rejects.toThrow(/metadata upload failed/i)` | ✅ PASS |
| CVM-06 | Later push upserts updated wrapped DEK/salt | Key fields refreshed from local KeyData | `src/sync/vault-metadata.test.ts:155-157` - `expect(meta.wrappedDek).toBe('BAUG')`; `expect(meta.salt).toBe('CAg=')`; `expect(meta.iterations).toBe(500_000)` | ✅ PASS |
| CVM-07 | Setup offers Restore primary; blocks Create when metadata exists | Create disabled; Restore primary when `ready` | Impl `src/ui/pages/SetupWizard.tsx:317-322` (`remoteReady` / `createDisabled`); `394-402` Restore primary button — **Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-08 | Correct passphrase → download, unwrap, persist key, unlock | Key persisted + DEK returned | `src/sync/vault-metadata.test.ts:191` - `expect(await hasKeyData()).toBe(true)`; unlock wiring `SetupWizard.tsx:200-201` | ✅ PASS |
| CVM-09 | After restore, can decrypt segments under that DEK | Restored DEK decrypts ciphertext from original DEK | `src/sync/vault-metadata.test.ts:198` - `expect(await decrypt(dek, fromExpected)).toEqual(payload)` | ✅ PASS |
| CVM-10 | Wrong passphrase → error; no key store write | Throws; `hasKeyData` false | `src/sync/vault-metadata.test.ts:211-214` - `rejects.toThrow(/passphrase\|unwrap/i)`; `expect(await hasKeyData()).toBe(false)` | ✅ PASS |
| CVM-11 | Metadata download/parse fail → no partial key data | Throws; no key store write | `src/sync/vault-metadata.test.ts:221-222` - `rejects.toThrow(/restore vault/i)`; `expect(await hasKeyData()).toBe(false)` | ✅ PASS |
| CVM-12 | While metadata exists, block Create | Create disabled when remote ready | Impl `SetupWizard.tsx:318-322` (`createDisabled = remoteBlocked \|\| probeLoading`) — **Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-13 | Segments without metadata → legacy | `kind: 'legacy'` | `src/sync/vault-metadata.test.ts:96` - `expect(...).toEqual({ kind: 'legacy', segmentCount: 1 })` | ✅ PASS |
| CVM-14 | Legacy blocks Restore and Create | Both disabled for legacy/corrupt | Impl `SetupWizard.tsx:318-326` (`createDisabled` / `restoreDisabled`) — **Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-15 | Legacy explains + offers Clear / Start fresh | Messaging + affordances | Impl `SetupWizard.tsx:373-380` (legacy copy); `435-454` Clear / Start fresh — **Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-16 | Start fresh deletes segments+metadata, resets watermarks, routes to Create | Cloud empty + keys cleared; UI routes Create | Domain: `src/sync/sync-engine.test.ts:56-57` - `expect(await provider.list()).toEqual([])`; `expect(await hasKeyData()).toBe(false)`. Route: `SyncSection.tsx:357-359` — **UI Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-17 | Clear cloud deletes segments + metadata; resets watermarks | Folder empty; sync state reset | `src/sync/crsql-changes.test.ts:348-355` - `expect(deleted).toBe(3)`; `expect(await provider.list()).toEqual([])`; sync state zeros | ✅ PASS |
| CVM-18 | Shall not create new local DEK beside remote metadata without clear | Create blocked while metadata present | Impl `SetupWizard.tsx:322` / `405-408` — **Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-19 | Auto-generate device label | Non-empty default label | `src/sync/device-identity.test.ts:17-18` - `expect(generateDefaultDeviceLabel().length).toBeGreaterThan(0)` | ✅ PASS |
| CVM-20 | Rename persists locally; included on next encrypted push | Custom label stored | `src/sync/device-identity.test.ts:28` - `expect(await getDeviceLabel()).toBe('Samsung S24')`; registry write `vault-metadata.test.ts:126` label matchObject | ✅ PASS |
| CVM-21 | Present known devices (label + last seen) | Settings list from metadata | Impl `SyncSection.tsx:637-652` known-devices list — **Tests:none** | ⚠️ Spec-precision gap / limited automated evidence |
| CVM-22 | Peer errors use registry label when present | Labeled vs site-id fallback | `src/sync/crsql-changes.test.ts:308-309` - `rejects.toThrow(/peer Phone \(bb\)/)`; `314` - `expect(formatPeerSiteForError('bb', {})).toBe('site bb')` | ✅ PASS |

**Status**: ⚠️ Spec-precision gaps flagged (7 UI ACs; matrix declared Tests:none for SetupWizard/SyncSection)

**Matched**: 15/22 ACs with domain test evidence  
**Gaps**: 7 Spec-precision (UI-only, no automated assertion)

---

## Discrimination Sensor

**Scratch**: temp git worktree under repo (`.tmp-cvm-sensor`), then `git worktree remove --force`. Real worktree not mutated. Baseline `git status --porcelain` matched after cleanup.

| # | Mutation | File | Description | Targeted tests | Killed? |
| - | -------- | ---- | ----------- | -------------- | ------- |
| A | Save key data before unwrap | `src/sync/vault-metadata.ts` (`restoreVaultFromRemote`) | Wrong passphrase still writes key store | `vault-metadata.test.ts` | ✅ Killed — `hasKeyData()` expected false, got true (`:214`) |
| B | Skip `upsertVaultMetadata` on encrypted push | `src/sync/crsql-changes.ts` (`pushDeltas`) | Encrypted push no longer writes metadata | `crsql-changes.test.ts` | ✅ Killed — metadata absent (e.g. list missing `vault-metadata.json` at `:342`) |
| C | Treat legacy segments as `empty` | `src/sync/vault-metadata.ts` (`probeRemoteVault`) | Segments-only remote classified empty | `vault-metadata.test.ts` | ✅ Killed — expected `{ kind: 'legacy', segmentCount: 1 }`, got `{ kind: 'empty' }` (`:96`) |

**Sensor depth**: lightweight (3 targeted behavior mutations)  
**Result**: 3/3 killed — PASS ✅  
**Isolation**: baseline porcelain unchanged after cleanup

---

## Edge Cases (spec)

| Edge case | Evidence | Result |
| --------- | -------- | ------ |
| First writer creates metadata when absent | `vault-metadata.test.ts:112-127` create path | ✅ |
| Corrupt metadata restore-blocking | `vault-metadata.test.ts:217-222`; probe corrupt `:86-90` | ✅ |
| Restore with no provider → connect prompt | Impl `SetupWizard.tsx:126-132` / `195-198` | ⚠️ UI only |
| Start fresh / Clear partial failure | `sync-engine.test.ts:79-80` - rejects; key store retained | ✅ |
| Concurrent first-writer authority | Probe/create guards use presence at decision time (design) | Covered by probe + UI guards |

---

## Code Quality (spot-check)

| Check | Pass? |
| ----- | ----- |
| No features beyond spec | ✅ |
| Touched files match tasks | ✅ |
| Matches existing sync/crypto patterns | ✅ |
| Domain tests map to ACs (non-shallow) | ✅ |
| Per-layer matrix: UI Tests:none honored | ✅ (gaps flagged, not invented PASS) |
| Project testing guidelines | none — strong defaults applied |

---

## Ranked Gaps

1. **CVM-07 / CVM-12 / CVM-18** — Create-block / Restore-primary when remote ready — UI only (`SetupWizard.tsx`); no automated assertion.
2. **CVM-14 / CVM-15** — Legacy/corrupt block + messaging + Clear/Start-fresh affordances — UI only.
3. **CVM-16** — Domain proves clear+key wipe; Create routing after Start fresh is UI (`SyncSection.tsx:357-359`) without automated evidence.
4. **CVM-21** — Known-devices list in Settings — UI only (`SyncSection.tsx:637-652`).

These are **matrix-expected** Spec-precision gaps (UI Tests:none), not missing domain coverage. Optional follow-up: Playwright/UAT for setup + settings flows.

---

## Verdict

**PASS ✅** — Build gate green (418/418), 15/22 ACs domain-matched with `file:line` evidence, discrimination sensor 3/3 killed, 7 intentional UI Spec-precision gaps flagged (not invented PASS).
