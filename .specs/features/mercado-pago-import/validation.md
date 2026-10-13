# Mercado Pago Import Validation

**Verdict**: PASS ✅  
**Date**: 2026-10-13  
**Spec**: `.specs/features/mercado-pago-import/spec.md`  
**Diff range**: `4196c99..HEAD` (includes F1–F6 test commits `7772842..9ef2649`)  
**Verifier**: independent sub-agent (author ≠ verifier) — re-verify after fix iteration 1  
**Prior**: FAIL with 14 AC gaps (Fix plans 1–6)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T19 | ✅ Done | All Done-when boxes checked in tasks.md |
| Fix plans 1–6 | ✅ Done | Test commits `7772842`…`9ef2649` |

---

## Spec-Anchored Acceptance Criteria

### P1: Mark an account as Mercado Pago

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| Choose Mercado Pago → save | `bank_code` `323` | `account-repository.test.ts:153` - `expect(account.bankCode).toBe('323')`; e2e `:30-41` | ✅ PASS |
| Choose Outros bancos → save | `bank_code` empty | `account-repository.test.ts:166-167` - `expect(account.bankCode).toBe('')`; `:261` update to empty | ✅ PASS |
| Type independent of `bank_code` | type retained with `323` | `src/domain/account.test.ts:43-44` - `expect(wallet.type).toBe('wallet')` + `bankCode` `323` | ✅ PASS |
| Second active `323` | reject + exact message | `account-repository.test.ts:187` - `rejects.toThrow('An active Mercado Pago account already exists.')`; e2e `:49` | ✅ PASS |
| Inactive `323` not counted | second active create succeeds | `account-repository.test.ts:228` - `expect(second.bankCode).toBe('323')` | ✅ PASS |
| Form offers only two institutions | only "Mercado Pago" and "Outros bancos" | `AccountForm.test.ts:21-22` - `expect(options).toEqual(['Outros bancos', 'Mercado Pago'])` + `toHaveLength(2)` | ✅ PASS |

### P1: See the Mercado Pago action on the right card

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| Active `323` shows file Import + "Import from Mercado Pago" | both buttons visible | `e2e/mercado-pago-import.spec.ts:38-41` | ✅ PASS |
| Empty `bank_code` shows file Import only | MP action absent | `e2e/mercado-pago-import.spec.ts:62-65` - `toHaveCount(0)` | ✅ PASS |
| Action MUST NOT load MP host image | no Mercado Pago CDN image | `e2e/mercado-pago-import.spec.ts:107-108` - `img` count 0 + local `svg` count 1; `:131` - `expect(mercadopagoImageRequests).toEqual([])` | ✅ PASS |
| Change to Outros bancos hides action, keeps txns + import-log rows | action hidden; data retained | e2e `:85-87` hides action; `account-repository.test.ts:286-287` - logs retained after `bankCode: ''` | ✅ PASS |
| Change back to Mercado Pago shows action + existing logs | action + logs return | e2e `:126` action restored; `account-repository.test.ts:290-292` - same log id after toggle back to `323` | ✅ PASS |

### P1: Import a statement period

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| Request pages 1..`pages` with cookie params | binnacle URL + `client`/`page`/`begin_date`/`end_date` | `extension/src/mercado-pago-api.test.ts:37-43` - URL contains params; `credentials: 'include'` | ✅ PASS |
| First response not authenticated list | open MP home + wait | `extension/src/background.test.ts:179-180` - `tabsCreate` home + `MP_SESSION_MISSING`; hook `:152` `waiting_for_session` | ✅ PASS |
| No 30s timeout while waiting | still waiting after 60s | `useMercadoPagoImport.test.ts:185-188` - status still `waiting_for_session` after `60_000` | ✅ PASS |
| Cancel during wait | write nothing | `useMercadoPagoImport.test.ts:160-163` - `mockProcess` / `notifyChange` not called | ✅ PASS |
| MUST NOT persist MP password/cookie/token | no credential storage | `mercado-pago-no-credentials.test.ts:33-35` - source scan `not.toMatch` forbidden patterns; `extension/.../mercado-pago-api.credentials.test.ts:25-27` | ✅ PASS |
| Insert movement items only (not day headers) | headers ignored | `mercado-pago-mapper.test.ts:142-145` - 2 rows from items only | ✅ PASS |
| Store `movement_id`, `title`, SP day, empty category, empty `settled_date` | all five fields | Mapper `:43-49` id/title/date; `mercado-pago-import.test.ts:229-230` - `category_id` `''` and `settled_date` `''` | ✅ PASS |
| Positive integer cents | amount > 0 integer | `mercado-pago-import.test.ts:212` - `expect(rows[0]!.amount).toBe(fromCents(1575))` | ✅ PASS |
| Balance increase → `credit` | type `credit` | `mercado-pago-mapper.test.ts:47` - `type: 'credit'` | ✅ PASS |
| Balance decrease → `debit` | type `debit` | `mercado-pago-mapper.test.ts:64` - `type: 'debit'` | ✅ PASS |
| Missing/non-BRL currency | error count, no insert | `mercado-pago-mapper.test.ts:73,80`; import `:71` `errorCount` 1 | ✅ PASS |
| Non-positive amount | error, no insert | `mercado-pago-mapper.test.ts:87` | ✅ PASS |
| Empty title / invalid datetime | error, no insert | `mercado-pago-mapper.test.ts:92`, `:97` | ✅ PASS |
| Existing `movement_id` skipped; keep first run id | skip + earlier `import_run_id` | `mercado-pago-import.test.ts:182-190` | ✅ PASS |
| Page failure after auth | DB unchanged (no write) | `useMercadoPagoImport.test.ts:133` - `mockProcess` not called; extension `:200` ERROR | ✅ PASS |
| All pages succeed → commit without preview | commit valid + one log | `mercado-pago-import.test.ts:69-83` (orchestrator; no preview step) | ✅ PASS |
| Row errors + pages ok → still commit valid | valid rows committed | `mercado-pago-import.test.ts:69-71` imported 2, errorCount 1 | ✅ PASS |
| Zero inserts → still one log row | log written | `mercado-pago-import.test.ts:114` - `logs`).toHaveLength(1)` | ✅ PASS |
| MUST NOT drop by `metadata.kind` | all kinds map | `mercado-pago-mapper.test.ts:100-104` | ✅ PASS |

### P1: Suggest the next period

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| No MP logs → first of SP month → today | e.g. `2026-10-01`..`2026-10-13` | `account-import-period.test.ts:10` | ✅ PASS |
| With logs → start = max `period_end`, end = today | max end used | `account-import-period.test.ts:23` | ✅ PASS |
| User edits then confirms | edited range imported | `useMercadoPagoImport.test.ts:96-100` sends provided dates | ✅ PASS |
| Requested end after today → clamp `period_end` | stored as today | `mercado-pago-import.test.ts:128` - `periodEnd: '2026-01-15'` | ✅ PASS |
| Requested end on/before today → store that date | stored as requested | `mercado-pago-import.test.ts:79` `periodEnd: '2026-01-31'` | ✅ PASS |
| Start after end → refuse, write nothing | invalid + no connect/process | `account-import-period.test.ts:52`; hook `:70-73` | ✅ PASS |
| Older finished `period_end` does not lower frontier | next start still max | `mercado-pago-import.test.ts:162`; period `:34` | ✅ PASS |
| Delete max log → next start remaining max | remaining max | `account-import-period.test.ts:41`; log repo `:182` | ✅ PASS |
| No MP logs left → month through today again | first of month | `account-import-period.test.ts:46` | ✅ PASS |
| Deleted movement (`external_id` gone) re-inserts on later import | insert again | `mercado-pago-import.test.ts:261-269` - after `deleteAccountImportRun`, `second.imported === 1` and new `import_run_id` | ✅ PASS |

### P1: Review and delete an import run

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| One log row per finished import with required fields + `source` | fields stored | `mercado-pago-import.test.ts:74-83`; log repo `:33-41` | ✅ PASS |
| Inserted txn stores log id | `import_run_id` = log id | `mercado-pago-import.test.ts:89` - `every(... import_run_id === result.logId)` | ✅ PASS |
| Modal lists MP logs with period/time/counts | UI list | `MercadoPagoImportModal.test.ts:76-81` - period, imported/skipped/errors; scoped `listByAccount(..., 'mercado_pago')` | ✅ PASS |
| Delete asks normal confirm; NOT typed DELETE | ConfirmDialog, no DELETE word | `MercadoPagoImportModal.test.ts:98-100` - no `\bDELETE\b`, no textbox | ✅ PASS |
| Dismiss confirmation → leave log + txns | no-op | `MercadoPagoImportModal.test.ts:108-111` - delete/notify not called; list still shows period | ✅ PASS |
| Confirm delete → hard-delete linked txns (incl. edited) | linked gone | `delete-account-import-run.test.ts:72-73` | ✅ PASS |
| After delete → recompute current-month snapshot | snapshot matches remaining | `delete-account-import-run.test.ts:178` - `105000` | ✅ PASS |
| Keep other runs' txns | other `import_run_id` remains | `delete-account-import-run.test.ts:138-139` | ✅ PASS |
| Keep empty `import_run_id` | manual remains | `delete-account-import-run.test.ts:105` | ✅ PASS |
| Every MP log deleted → no MP-inserted txns left | zero MP-linked txns | `delete-account-import-run.test.ts:223-234` - both runs deleted; linked length 0; manual remains | ✅ PASS |
| Non-PK columns SQL defaults + register for sync | defaults + SYNC_TABLES | `init.test.ts:80-86` defaults; `sync-tables.ts:10` lists table; `clear-all-data.test.ts:15-17`+`:55-56` seeds via SYNC_TABLES | ✅ PASS |
| Import commit or log delete → notify auto-sync | `notifyChange` | Import: `useMercadoPagoImport.test.ts:108`; Delete: `MercadoPagoImportModal.test.ts:139` - `expect(mockNotifyChange).toHaveBeenCalled()` | ✅ PASS |

### P1: One extension for InvestPass and Mercado Pago

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| Extension named "mytruetrack Import" | exact name | `extension/src/manifest.test.ts:14` - `expect(manifest.name).toBe('mytruetrack Import')` | ✅ PASS |
| Host permission MP + keep InvestPass | both hosts | `extension/src/manifest.test.ts:18-22` - `arrayContaining` both host URLs | ✅ PASS |
| InvestPass bridge still completes | START_IMPORT → payload | `extension/src/background.test.ts:116-118`; bridge `:110-114` | ✅ PASS |
| MP import message → movements or session-missing | payload / session | `background.test.ts:161`, `:180` | ✅ PASS |
| PWA connects with install-time extension id | `chrome.runtime.connect(id)` | `investpass-bridge.test.ts:57` - `connect`).toHaveBeenCalledWith('test-ext-id')` | ✅ PASS |

**Status**: ✅ All ACs covered  

**Matched with evidence**: 57 / 57 ACs  
**Gaps**: 0  
**Spec-precision gaps**: 0  

**Previously gapped ACs — new evidence (fix iter 1)**:

| Prior gap | New evidence |
| --------- | ------------ |
| Form exclusivity | `AccountForm.test.ts:21-22` |
| No CDN image | `e2e/mercado-pago-import.spec.ts:107-108,131` |
| Toggle hides + keep logs | `account-repository.test.ts:286-287` |
| Toggle back + logs | e2e `:126` + `account-repository.test.ts:290-292` |
| No credential persist | `mercado-pago-no-credentials.test.ts:33-35` + extension credentials test `:25-27` |
| Empty category / settled_date | `mercado-pago-import.test.ts:229-230` |
| Re-insert after delete | `mercado-pago-import.test.ts:261-269` |
| Modal list fields | `MercadoPagoImportModal.test.ts:76-81` |
| No typed DELETE | `MercadoPagoImportModal.test.ts:98-100` |
| Dismiss confirm no-op | `MercadoPagoImportModal.test.ts:108-111` |
| Delete-all MP logs | `delete-account-import-run.test.ts:223-234` |
| notifyChange on delete | `MercadoPagoImportModal.test.ts:139` |
| Manifest name + hosts | `extension/src/manifest.test.ts:14,18-22` |

---

## Discrimination Sensor

Isolated scratch: `git worktree add` at HEAD → `C:\Users\Juliano\AppData\Local\Temp\mpago-sensor-scratch-reverify` with `node_modules` junction. Real worktree never mutated. Forbidden: stash.

Baseline `git status --porcelain`: empty. After cleanup: empty (match).

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `account-repository.ts` uniqueness | `rows.length > 0` → `rows.length > 0 && false` | ✅ Killed (2 tests) |
| 2 | `account-import-period.ts` frontier | max → min (`end >` → `end <`) | ✅ Killed (2 tests) |
| 3 | `mercado-pago-mapper.ts` sign | flip credit/debit ternary | ✅ Killed (5 tests) |
| 4 | `delete-account-import-run.ts` | skip `DELETE FROM transactions` | ✅ Killed (5 tests) |
| 5 | `import-service.ts` category | force `categoryId: 'forced-cat'` on insert | ✅ Killed (empty category assert) |
| 6 | `import-service.ts` dedup | always skip when `externalId` set | ✅ Killed (5 tests incl. re-insert) |

**Sensor depth**: lightweight / elevated (≥5 for import-critical path)  
**Sensor result**: 6/6 killed — PASS ✅

---

## Interactive UAT Results

Not performed (Verifier automated pass). User-facing UAT remains available for orchestrator if needed.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ (shared `account_import_logs` + `source` per design) |
| Matches patterns | ✅ (InvestPass-shaped bridge/hook) |
| Spec-anchored outcome check | ✅ all ACs have matching assertions |
| Per-layer Coverage Expectation | ✅ domain/workers/storage/hooks/UI modal/e2e/extension |
| Every test maps to a spec requirement | ✅ feature tests align to ACs / Done-when / Fix plans |
| Documented guidelines followed: `AGENTS.md`, `vitest.config.ts` | ✅ |

---

## Edge Cases

- [x] Start after end → refuse, write nothing (period + hook tests)
- [x] Page failure after auth → unchanged DB (hook + extension)
- [x] Non-BRL → error, no insert (mapper + import)
- [x] Zero inserts → still log row (import test)
- [x] Cancel sign-in wait → write nothing (hook)
- [x] Inactive `323` not counted (account-repository)

---

## Gate Check

- **Gate command**: `npm run typecheck` && `npm run lint` && `npm test`
- **Result**: typecheck ✅, lint ✅, unit tests **520 passed / 0 failed** (57 files); extension vitest **24 passed / 0 failed** (5 files via `extension/vitest.config.ts`)
- **E2E**: `npm run test:e2e -- e2e/mercado-pago-import.spec.ts` → **5 passed** (env available)
- **Test count before feature** (`it(` at `4196c99`): 460 unit/extension
- **Test count after feature** (`it(` at HEAD): 540 unit/extension (+80); e2e `test(` 60 → 65 (+5)
- **Delta**: +80 unit `it`s, +5 e2e tests (no decrease)
- **Skipped tests**: none in gate runs
- **Failures**: none

---

## Fix Plans (if issues found)

None — prior Fix plans 1–6 closed by commits `7772842`…`9ef2649`.

---

## Requirement Traceability Update

| Requirement | Previous Status (prior FAIL) | New Status |
| ----------- | ---------------------------- | ---------- |
| MPAG-01..05 | ✅ Verified | ✅ Verified |
| MPAG-06 | ❌ Needs Fix | ✅ Verified (`AccountForm.test.ts:21-22`) |
| MPAG-07..08 | ✅ Verified | ✅ Verified |
| MPAG-09 | ❌ Needs Fix | ✅ Verified (e2e CDN/local SVG) |
| MPAG-10 | ❌ Needs Fix | ✅ Verified (hide + log retention) |
| MPAG-11 | ❌ Needs Fix | ✅ Verified (toggle-back + logs) |
| MPAG-12..15,17..22,24..30 | ✅ Verified | ✅ Verified |
| MPAG-16 | ❌ Needs Fix | ✅ Verified (credential source-scan tests) |
| MPAG-18 | ❌ Needs Fix (category/settled) | ✅ Verified (`mercado-pago-import.test.ts:229-230`) |
| MPAG-31..39 | ✅ Verified | ✅ Verified |
| MPAG-40 | ❌ Needs Fix | ✅ Verified (re-insert after delete) |
| MPAG-41..42,46..49,51 | ✅ Verified | ✅ Verified |
| MPAG-43..45,50 | ❌ Needs Fix | ✅ Verified (modal list/confirm/dismiss) |
| MPAG-52 | ❌ Needs Fix (delete notify) | ✅ Verified (modal `notifyChange`) |
| MPAG-53..54 | ❌ Needs Fix | ✅ Verified (`manifest.test.ts`) |
| MPAG-55..57 | ✅ Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready — PASS

**Spec-anchored check**: 57/57 ACs matched spec outcome | 0 gaps | 0 spec-precision gaps  
**Sensor**: 6/6 mutations killed  
**Gate**: typecheck + lint + 520 unit + 24 extension + 5 e2e passed

**What works**: Full Mercado Pago import surface — institution uniqueness, dashboard action + CDN guard + toggle retention, binnacle map/import/dedup/re-insert, period frontier, import-log review/delete/sync notify, extension rename + dual host + InvestPass regression. Fix-iteration tests close all 14 prior gaps. Discrimination sensor confirms core and newly asserted behaviors.

**Issues found**: none

**Next steps**: Update requirement statuses in `spec.md` to Verified if desired; optional interactive UAT for modal UX.
