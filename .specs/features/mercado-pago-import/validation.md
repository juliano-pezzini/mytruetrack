# Mercado Pago Import Validation

**Verdict**: FAIL
**Date**: 2026-10-13
**Spec**: `.specs/features/mercado-pago-import/spec.md`
**Diff range**: `4196c99..HEAD` (`7387e07^..HEAD`; first feature commit `7387e07` through `2b7b7bc`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T19 | ✅ Done | All Done-when boxes checked in tasks.md; Verifier was pending |

---

## Spec-Anchored Acceptance Criteria

### P1: Mark an account as Mercado Pago

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| Choose Mercado Pago → save | `bank_code` `323` | `src/storage/repositories/account-repository.test.ts:152` - `expect(account.bankCode).toBe('323')`; e2e `e2e/mercado-pago-import.spec.ts:30` | ✅ PASS |
| Choose Outros bancos → save | `bank_code` empty | `account-repository.test.ts:260` - `expect(updated.bankCode).toBe('')`; e2e Outros bancos path | ✅ PASS |
| Type independent of `bank_code` | type retained with `323` | `src/domain/account.test.ts:42-44` - `expect(wallet.type).toBe('wallet')` + `bankCode` `323` | ✅ PASS |
| Second active `323` | reject + exact message | `account-repository.test.ts:186` - `rejects.toThrow('An active Mercado Pago account already exists.')`; e2e `:49` | ✅ PASS |
| Inactive `323` not counted | second active create succeeds | `account-repository.test.ts:227` - `expect(second.bankCode).toBe('323')` | ✅ PASS |
| Form offers only two institutions | only "Mercado Pago" and "Outros bancos" | Implementation `AccountForm.tsx:26-29`; **no assertion that option set is exclusive** | ❌ GAP |

### P1: See the Mercado Pago action on the right card

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| Active `323` shows file Import + "Import from Mercado Pago" | both buttons visible | `e2e/mercado-pago-import.spec.ts:38-41` | ✅ PASS |
| Empty `bank_code` shows file Import only | MP action absent | `e2e/mercado-pago-import.spec.ts:62-65` - `toHaveCount(0)` | ✅ PASS |
| Action MUST NOT load MP host image | no Mercado Pago CDN | Local SVG in `DashboardPage.tsx:23-33`; **no automated assertion against remote MP image URL** | ❌ GAP |
| Change to Outros bancos hides action, keeps txns + import-log rows | action hidden; data retained | e2e `:85-87` hides action and keeps account; **does not assert import-log rows retained** | ❌ GAP |
| Change back to Mercado Pago shows action + existing logs | action + logs return | **no test for re-toggle back** | ❌ GAP |

### P1: Import a statement period

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| Request pages 1..`pages` with cookie params | binnacle URL + `client`/`page`/`begin_date`/`end_date` | `extension/src/mercado-pago-api.test.ts:35-43` | ✅ PASS |
| First response not authenticated list | open MP home + modal wait copy | `extension/src/background.test.ts:179` - `tabsCreate` with `https://www.mercadopago.com.br/`; hook `:152` `waiting_for_session` | ✅ PASS |
| No 30s timeout while waiting | still waiting after 60s | `useMercadoPagoImport.test.ts:185-188` | ✅ PASS |
| Cancel during wait | write nothing | `useMercadoPagoImport.test.ts:160-163` - `mockProcess` / `notifyChange` not called | ✅ PASS |
| MUST NOT persist MP password/cookie/token | no credential storage | **no automated negative assertion** | ❌ GAP |
| Insert movement items only (not day headers) | headers ignored | `mercado-pago-mapper.test.ts:142-145` - 2 rows from items only | ✅ PASS |
| Store `movement_id`, `title`, SP day, empty category, empty `settled_date` | all five fields | Mapper `:43-49` covers id/title/date; **no assert empty `category_id` / `settled_date` on insert** | ❌ GAP |
| Positive integer cents | amount > 0 integer | `mercado-pago-import.test.ts:211` - `expect(rows[0]!.amount).toBe(fromCents(1575))` | ✅ PASS |
| Balance increase → `credit` | type `credit` | `mercado-pago-mapper.test.ts:48` | ✅ PASS |
| Balance decrease → `debit` | type `debit` | `mercado-pago-mapper.test.ts:64` | ✅ PASS |
| Missing/non-BRL currency | error count, no insert | `mercado-pago-mapper.test.ts:73`; import `:70` `errorCount` 1 | ✅ PASS |
| Non-positive amount | error, no insert | `mercado-pago-mapper.test.ts:87` | ✅ PASS |
| Empty title / invalid datetime | error, no insert | `mercado-pago-mapper.test.ts:92`, `:97` | ✅ PASS |
| Existing `movement_id` skipped; keep first run id | skip + earlier `import_run_id` | `mercado-pago-import.test.ts:182-189` | ✅ PASS |
| Page failure after auth | DB unchanged (no write) | `useMercadoPagoImport.test.ts:133` - `mockProcess` not called; extension `:200-204` ERROR | ✅ PASS |
| All pages succeed → commit without preview | commit valid + one log | `mercado-pago-import.test.ts:68-82` (orchestrator; no preview step) | ✅ PASS |
| Row errors + pages ok → still commit valid | valid rows committed | `mercado-pago-import.test.ts:68-70` imported 2, errorCount 1 | ✅ PASS |
| Zero inserts → still one log row | log written | `mercado-pago-import.test.ts:112-113` | ✅ PASS |
| MUST NOT drop by `metadata.kind` | all kinds map | `mercado-pago-mapper.test.ts:100-104` | ✅ PASS |

### P1: Suggest the next period

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| No MP logs → first of SP month → today | e.g. `2026-10-01`..`2026-10-13` | `account-import-period.test.ts:10` | ✅ PASS |
| With logs → start = max `period_end`, end = today | max end used | `account-import-period.test.ts:23` | ✅ PASS |
| User edits then confirms | edited range imported | `useMercadoPagoImport.test.ts:96-100` sends provided dates | ✅ PASS |
| Requested end after today → clamp `period_end` | stored as today | `mercado-pago-import.test.ts:127` | ✅ PASS |
| Requested end on/before today → store that date | stored as requested | `mercado-pago-import.test.ts:78` `periodEnd: '2026-01-31'` | ✅ PASS |
| Start after end → refuse, write nothing | invalid + no connect/process | `account-import-period.test.ts:52`; hook `:70-73` | ✅ PASS |
| Older finished `period_end` does not lower frontier | next start still max | `mercado-pago-import.test.ts:161`; period `:34` | ✅ PASS |
| Delete max log → next start remaining max | remaining max | `account-import-period.test.ts:41`; log repo `:182` | ✅ PASS |
| No MP logs left → month through today again | first of month | `account-import-period.test.ts:46` | ✅ PASS |
| Deleted movement (`external_id` gone) re-inserts on later import | insert again | **no test: import → delete txn → re-import same `movement_id`** | ❌ GAP |

### P1: Review and delete an import run

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| One log row per finished import with required fields + `source` | fields stored | `mercado-pago-import.test.ts:74-82`; log repo `:33-41` | ✅ PASS |
| Inserted txn stores log id | `import_run_id` = log id | `mercado-pago-import.test.ts:88-89` | ✅ PASS |
| Modal lists MP logs with period/time/counts | UI list | Implementation `MercadoPagoImportModal.tsx:210-223`; **no automated UI/e2e assertion** | ❌ GAP |
| Delete asks normal confirm; NOT typed DELETE | ConfirmDialog, no DELETE word | Implementation `:239-247`; **no test asserting absence of typed DELETE** | ❌ GAP |
| Dismiss confirmation → leave log + txns | no-op | **no test** | ❌ GAP |
| Confirm delete → hard-delete linked txns (incl. edited) | linked gone | `delete-account-import-run.test.ts:72-73` | ✅ PASS |
| After delete → recompute current-month snapshot | snapshot matches remaining | `delete-account-import-run.test.ts:178` - `105000` | ✅ PASS |
| Keep other runs' txns | other `import_run_id` remains | `delete-account-import-run.test.ts:138-139` | ✅ PASS |
| Keep empty `import_run_id` | manual remains | `delete-account-import-run.test.ts:105` | ✅ PASS |
| Every MP log deleted → no MP-inserted txns left | zero MP-linked txns | **no test that deletes all MP logs and asserts none remain** | ❌ GAP |
| Non-PK columns SQL defaults + register for sync | defaults + SYNC_TABLES | `init.test.ts:80-86` defaults; `sync-tables.ts:10` lists table; clear-all seeds it | ✅ PASS |
| Import commit or log delete → notify auto-sync | `notifyChange` | Import: `useMercadoPagoImport.test.ts:108`; **delete path has no test** (code `:95`) | ❌ GAP |

### P1: One extension for InvestPass and Mercado Pago

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| Extension named "mytruetrack Import" | exact name | `extension/manifest.json:3`; **no automated assertion** | ❌ GAP |
| Host permission MP + keep InvestPass | both hosts | `manifest.json:7-9`; **no automated assertion** | ❌ GAP |
| InvestPass bridge still completes | START_IMPORT → payload | `extension/src/background.test.ts:115-121`; bridge `:110-114` | ✅ PASS |
| MP import message → movements or session-missing | payload / session | `background.test.ts:161`, `:180` | ✅ PASS |
| PWA connects with install-time extension id | `chrome.runtime.connect(id)` | `investpass-bridge.test.ts:57` | ✅ PASS |

**Status**: ❌ Gaps present (14 AC gaps; 0 pure spec-precision-only flags beyond implementation-without-test)

**Matched with evidence**: 43 / 57 ACs  
**Gaps**: 14

---

## Discrimination Sensor

Isolated scratch: `git worktree add` at HEAD → `C:\Users\Juliano\AppData\Local\Temp\mpago-sensor-scratch-32b8` with `node_modules` junction. Real worktree never mutated. Forbidden: stash.

Baseline `git status --porcelain`: empty. After cleanup: empty (match).

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `account-repository.ts` uniqueness | `rows.length > 0` → `rows.length > 0 && false` | ✅ Killed (2 tests) |
| 2 | `account-import-period.ts` frontier | max → min (`end >` → `end <`) | ✅ Killed (2 tests) |
| 3 | `mercado-pago-mapper.ts` sign | flip credit/debit ternary | ✅ Killed (5 tests) |
| 4 | `delete-account-import-run.ts` | skip `DELETE FROM transactions` | ✅ Killed (4 tests) |
| 5 | `useMercadoPagoImport.ts` page ERROR | still call `processMercadoPagoImport` on ERROR | ✅ Killed (1 test) |

**Sensor depth**: lightweight / elevated (≥5 for import-critical path)  
**Sensor result**: 5/5 killed (sensor itself green; overall feature verdict remains FAIL due to AC gaps)

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
| Spec-anchored outcome check | ❌ several ACs lack matching assertions |
| Per-layer Coverage Expectation | ⚠️ domain/workers strong; UI modal/delete confirm/e2e incomplete vs matrix |
| Every test maps to a spec requirement | ✅ feature tests align to ACs / Done-when |
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
- **Result**: typecheck ✅, lint ✅, unit tests **508 passed / 0 failed** (54 files); extension vitest **21 passed / 0 failed** (3 files via `extension/vitest.config.ts`)
- **E2E**: `npm run test:e2e -- e2e/mercado-pago-import.spec.ts` → **4 passed** (env available)
- **Test count before feature** (`it(` at `4196c99`): 460 unit/extension
- **Test count after feature** (`it(` at HEAD): 529 unit/extension (+69); e2e tests 56 → 60 (+4)
- **Delta**: +69 unit `it`s, +4 e2e tests (no decrease)
- **Skipped tests**: none in gate runs
- **Failures**: none

---

## Fix Plans (gaps)

### Fix 1: Re-import after deleted `external_id` (Period AC10) — Blocker

- **Root cause**: No test covering import → hard-delete txn → re-import same `movement_id` inserts again.
- **Fix task**: Add `mercado-pago-import` (or import-service) test that deletes by `import_run_id` / txn then re-processes same movement and expects `imported === 1`.
- **Verify**: New test fails if dedup set is not refreshed from DB after delete.
- **Done when**: AC10 has `file:line` asserting re-insert.
- **Progress (fix iter 1)**: ✅ Test added — `mercado-pago-import.test.ts` re-insert after `deleteAccountImportRun`.

### Fix 2: Modal delete UX (Review AC3–AC5, AC12 delete notify) — Major

- **Root cause**: Modal wired but no unit/e2e for list rendering, ConfirmDialog (no typed DELETE), dismiss no-op, or `notifyChange` after delete.
- **Fix task**: Component test or Playwright: open modal with seeded logs; assert list fields; open delete → cancel → data remains; confirm → gone + sync notify mock.
- **Done when**: AC3–AC5 and delete half of AC12 cited with assertions.
- **Progress (fix iter 1)**: ✅ `MercadoPagoImportModal.test.ts` — list fields, no typed DELETE, dismiss no-op, confirm → deleteAccountImportRun + notifyChange.

### Fix 3: Dashboard toggle-back + log retention (Dashboard AC3–AC5) — Major

- **Root cause**: e2e covers hide-only; no CDN-image guard; no assert import logs survive institution change / reappear.
- **Fix task**: Extend e2e: toggle Outros bancos → assert logs still in DB/modal after toggle back to MP; assert no `mercadopago.com` image requests on card.
- **Done when**: AC3–AC5 have evidence.

### Fix 4: Empty category / settled_date on MP insert (Import AC7) — Major

- **Root cause**: Mapper/import omit fields but no read-back assertion.
- **Fix task**: After `processMercadoPagoImport`, assert `category_id` empty and `settled_date` empty.
- **Done when**: AC7 fully matched.

### Fix 5: Form exclusivity + extension manifest + no-credential store — Minor/Major

- **Root cause**: Manifest and `INSTITUTIONS` exist without assertions; credential non-persistence untested.
- **Fix task**: Unit/read tests for `manifest.json` name + `host_permissions`; AccountForm option count === 2; optional static/search that PWA/extension never write MP cookie/token to storage APIs in this feature surface.
- **Done when**: ACs cited with assertions.

### Fix 6: Delete-all MP logs leaves no MP txns (Review AC10) — Major

- **Root cause**: Pairwise delete tests exist; no “delete every MP log” assertion.
- **Fix task**: Two runs → delete both logs → assert zero txns with non-empty `import_run_id` for that account (manual empty remains).
- **Done when**: AC10 evidenced.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| MPAG-01..03,05 | Design/Pending | ✅ Verified (domain/repo/e2e) |
| MPAG-04 | Design/Pending | ✅ Verified |
| MPAG-06 | Design/Pending | ❌ Needs Fix (form exclusivity) |
| MPAG-07..08 | Design/Pending | ✅ Verified |
| MPAG-09..11 | Design/Pending | ❌ Needs Fix |
| MPAG-12..15,17..22,24..30 | Design/Pending | ✅ Verified |
| MPAG-16 | Design/Pending | ❌ Needs Fix (credential non-persist evidence) |
| MPAG-23 | Design/Pending | ❌ Needs Fix (category/settled empty) |
| MPAG-31..39 | Design/Pending | ✅ Verified |
| MPAG-40 | Design/Pending | ❌ Needs Fix (re-insert) |
| MPAG-41..42,46..49,51 | Design/Pending | ✅ Verified |
| MPAG-43..45,50,52 (delete notify) | Design/Pending | ❌ Needs Fix |
| MPAG-53..54 | Design/Pending | ❌ Needs Fix (manifest asserts) |
| MPAG-55..57 | Design/Pending | ✅ Verified |

---

## Summary

**Overall**: FAIL ❌ — Not Ready

**Spec-anchored check**: 43/57 ACs matched spec outcome | 14 gaps | 0 pure spec-precision-only
**Sensor**: 5/5 mutations killed
**Gate**: typecheck + lint + 508 unit + 21 extension + 4 e2e passed

**What works**: Core import pipeline (map, dedup, commit, clamp, period frontier, uniqueness, page-failure no-write, delete-run + snapshot, bridge/extension fetch, e2e institution/card visibility). Discrimination sensor confirms those tests discriminate.

**Issues found**: Missing automated evidence for re-import-after-delete, modal delete UX, institution toggle-back/log retention, category/settled empty, manifest/form exclusivity, credential non-persistence, delete-all-logs, notifyChange on delete.

**Next steps**: Route Fix plans 1–6 to implementer; re-verify (max 3 iterations).
