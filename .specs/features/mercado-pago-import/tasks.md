# Mercado Pago Import Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/mercado-pago-import/design.md`
**Status**: In Progress — batch 1 done (T1–T8); batch 2 done (T9–T14); next batch 3 (T15–T19)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` (domain/sync coverage via `vitest.config.ts`; Playwright for onboarding/transactions/import/sync; no `any`; validate imports before insert), `vitest.config.ts` (80% thresholds on domain/storage/crypto/sync/workers), `e2e/import.spec.ts` + `e2e/investpass-import.spec.ts` (Playwright happy paths).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain | unit | All branches; 1:1 to mapped ACs; listed edge cases | `src/domain/*.test.ts` | `npm test` |
| Workers / mappers / import orchestration | unit | All branches; AC mapping for map/import/delete; row + page failure cases | `src/workers/*.test.ts` | `npm test` |
| Storage repositories / migrations | unit | Key query paths + uniqueness + delete-by-run | `src/storage/**/*.test.ts` | `npm test` |
| Sync bridge | unit | Message connect + MP vs InvestPass paths | `src/sync/*.test.ts` | `npm test` |
| Extension fetch / background | unit | Auth missing, page walk, InvestPass regression | `extension/src/*.test.ts` (via extension vitest) | `npm test --prefix extension` or workspace equivalent |
| UI hooks (pure orchestration) | unit | Status transitions; cancel; no 30s login timeout | `src/ui/hooks/*.test.ts` | `npm test` |
| UI pages / React components | none | Build + e2e cover visibility and form | — | build / e2e |
| E2E user flows | e2e | Institution save, button visibility, second-323 reject | `e2e/*.spec.ts` | `npm run test:e2e` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only | `npm test` |
| Full | After tasks that add e2e or extension tests | `npm test` && `npm run test:e2e` (plus extension tests when that package is touched) |
| Build | After phase completion or schema/UI-only wiring | `npm run typecheck` && `npm run lint` && `npm test` |

---

## Execution Plan

Phases run sequentially. Tasks within a phase run in order.

### Phase 1: Schema and account bank code

```
T1 → T2 → T3 → T4
```

### Phase 2: Import log, period, and transaction link

```
T5 → T8
T7 → T8
```

(T6 has no dependency within this phase.)

### Phase 3: Mapper and import orchestration

```
T9 → T10
```

(T11 depends only on T6 from Phase 2.)

### Phase 4: Extension and bridge

```
T12 → T13 → T14
```

### Phase 5: UI and e2e

```
T15 → T18 → T19
T16 → T17 → T18
```

---

## Task Breakdown

### Phase 1: Schema and account bank code

### T1: Add migration 002 for bank_code, import_run_id, and import logs

**What**: Create migration version 2 that adds `accounts.bank_code`, `transactions.import_run_id`, and table `account_import_logs` (with `source TEXT NOT NULL DEFAULT ''` and SQL defaults on non-PK columns); register it and add the table to `SYNC_TABLES`.
**Where**: `src/storage/migrations/002-mercado-pago-import.ts`
**Depends on**: None
**Reuses**: `src/storage/migrations/001-initial-schema.ts`, `src/sync/sync-tables.ts`
**Requirement**: MPAG-01, MPAG-41, MPAG-42, MPAG-51

**Done when**:

- [x] Migration 002 is registered in `src/storage/migrations/index.ts`
- [x] `account_import_logs` is listed in `SYNC_TABLES`
- [x] Init/migration tests cover the new columns and table including `source`
- [x] Gate: `npm test` passes for storage init/migration tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): add migration for bank_code and account_import_logs`

---

### T2: Extend Account domain with bankCode

**What**: Add `bankCode` to `Account` / `CreateAccountParams` (`''` or `'323'` only from callers); keep type independent of bank code.
**Where**: `src/domain/account.ts`
**Depends on**: T1
**Reuses**: Existing `createAccount` factory
**Requirement**: MPAG-01, MPAG-02, MPAG-03, MPAG-06

**Done when**:

- [x] Domain tests assert `bankCode` defaults and is retained
- [x] Gate: `npm test` passes for account domain tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): add bankCode to account domain`

---

### T3: Persist bank_code and enforce one active Mercado Pago account

**What**: Read/write `bank_code` in the account repository; reject create/update that would leave two active `323` accounts with message `An active Mercado Pago account already exists.`; inactive `323` does not count.
**Where**: `src/storage/repositories/account-repository.ts`
**Depends on**: T2
**Reuses**: Soft-delete `is_active` behavior
**Requirement**: MPAG-04, MPAG-05

**Done when**:

- [x] Repository tests cover create, update, inactive exclusion, and the exact error message
- [x] Gate: `npm test` passes for account-repository tests

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): enforce single active bank_code 323`

---

### T4: Wire bankCode through account hooks

**What**: Pass `bankCode` through `useAccounts` create/update so the form can save it.
**Where**: `src/ui/hooks/useAccounts.ts`
**Depends on**: T3
**Reuses**: Existing notifyChange pattern
**Requirement**: MPAG-01, MPAG-02

**Done when**:

- [x] Create/update accept `bankCode`
- [x] Typecheck clean for the hook
- [x] Gate: `npm run typecheck`

**Tests**: none
**Gate**: build

**Commit**: `feat(mpago): wire bankCode through useAccounts`

---

### Phase 2: Import log, period, and transaction link

### T5: Create account_import_logs repository

**What**: Repository to create a log row (including `source`), list by `(accountId, source)`, read max `period_end` for that pair, and delete a log row.
**Where**: `src/storage/repositories/account-import-log-repository.ts`
**Depends on**: T1
**Reuses**: Other repository SQL helpers / test helpers
**Requirement**: MPAG-32, MPAG-35, MPAG-41, MPAG-43

**Done when**:

- [x] Unit tests cover create with source, list filtered by source, max period_end per source, delete
- [x] Gate: `npm test` passes for this repository

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): add account import log repository`

---

### T6: Suggest next account-import period

**What**: Pure function that suggests first day of current São Paulo month→today when no logs, else max `period_end`→today; caller passes only logs for one source so frontiers do not mix.
**Where**: `src/domain/account-import-period.ts`
**Depends on**: None
**Reuses**: São Paulo date convention from InvestPass
**Requirement**: MPAG-31, MPAG-32, MPAG-38, MPAG-39

**Done when**:

- [x] Unit tests cover first run, later run, after deleting max, empty after all deletes
- [x] Gate: `npm test` passes for this domain module

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): suggest next account import period`

---

### T7: Add importRunId on transactions and import service

**What**: Persist `import_run_id` on create; extend `importTransactions` to accept optional `importRunId` applied to inserted rows only (skipped duplicates unchanged).
**Where**: `src/workers/import-service.ts`
**Depends on**: T1
**Reuses**: Existing dedup-by-externalId logic
**Requirement**: MPAG-27, MPAG-42, MPAG-40

**Done when**:

- [x] Domain/repo mapping for `importRunId` updated as needed in the same commit if required for compile
- [x] Import-service tests: inserted rows get the id; skipped duplicates keep the earlier id
- [x] Gate: `npm test` passes for import-service (and transaction-repository if touched)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): link imported transactions to import run`

---

### T8: Delete account import run and refresh balance snapshot

**What**: Hard-delete transactions with the given `import_run_id`, delete the `account_import_logs` row, recompute and upsert the current month's `account_balances` for that account; leave other runs and empty-`import_run_id` rows alone.
**Where**: `src/workers/delete-account-import-run.ts`
**Depends on**: T5, T7
**Reuses**: `src/domain/balance.ts`, account-balance repository
**Requirement**: MPAG-44, MPAG-45, MPAG-46, MPAG-47, MPAG-48, MPAG-49, MPAG-50

**Done when**:

- [x] Unit tests cover delete linked only, keep other runs, keep empty import_run_id, snapshot refresh
- [x] Gate: `npm test` passes for this module

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): delete account import run and refresh snapshot`

---

### Phase 3: Mapper and import orchestration

### T9: Map binnacle JSON items to ParsedTransaction

**What**: Zod-validate the list envelope; flatten day groups to movement items only; map `movement_id`, `title`, São Paulo date, BRL cents, credit/debit. Confirm amount sign and group item array name against a real binnacle response before locking the mapper (no production values or personal ids in fixtures — synthetic shapes only).
**Where**: `src/workers/mercado-pago-mapper.ts`
**Depends on**: None
**Reuses**: `ParsedTransaction`, InvestPass São Paulo day conversion
**Requirement**: MPAG-18, MPAG-19, MPAG-20, MPAG-21, MPAG-22, MPAG-23, MPAG-24, MPAG-25, MPAG-26

**Done when**:

- [x] Synthetic fixtures cover credit, debit, non-BRL, missing currency, bad amount, empty title, bad datetime, day header ignored
- [x] Gate: `npm test` passes for the mapper

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): map binnacle movements to transactions`

---

### T10: Orchestrate Mercado Pago import commit

**What**: Given a full page set already fetched, map rows, create `account_import_logs` row with `source` `mercado_pago` and clamped `period_end`, import with `importRunId`, store counts (including zero-insert finished runs). Do not call this when a page failed.
**Where**: `src/workers/mercado-pago-import.ts`
**Depends on**: T5, T7, T9
**Reuses**: `importTransactions`, period clamp rule from design, account-import-log repository
**Requirement**: MPAG-28, MPAG-29, MPAG-30, MPAG-34, MPAG-35, MPAG-36, MPAG-41

**Done when**:

- [x] Unit tests cover success with mixed row errors, zero inserts still logs, period_end clamp, older range does not lower next max when max already higher (via log repo scoped by source)
- [x] Gate: `npm test` passes for this module

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): commit mapped movements and log row`

---

### T11: Refuse reversed period before fetch

**What**: Pure validation `isValidAccountImportPeriod(start, end)` used by the hook/modal — start after end is invalid.
**Where**: `src/domain/account-import-period.ts`
**Depends on**: T6
**Reuses**: Same period module
**Requirement**: MPAG-37

**Done when**:

- [x] Unit test for start > end returns invalid
- [x] Gate: `npm test` passes for the period module

**Tests**: unit
**Gate**: quick

**Commit**: `feat(import): reject reversed account import period`

---

### Phase 4: Extension and bridge

### T12: Rename extension and add Mercado Pago host permission

**What**: Rename the extension to `mytruetrack Import`; add `https://www.mercadopago.com.br/*` host permission; keep InvestPass host permission.
**Where**: `extension/manifest.json`
**Depends on**: None
**Reuses**: Existing manifest structure
**Requirement**: MPAG-53, MPAG-54

**Done when**:

- [x] Manifest name and host_permissions match the design
- [x] Gate: extension package still loads (typecheck/test as used today)

**Tests**: none
**Gate**: build

**Commit**: `feat(mpago): rename companion extension and add MP host`

---

### T13: Fetch binnacle pages in the extension

**What**: Implement page walk for `GET /activities/api/list/binnacle` with `client`, `page`, `begin_date`, `end_date`; return session-missing vs pages vs page failure. Prefer cookie-authenticated fetch; fall back to Mercado Pago tab context if needed.
**Where**: `extension/src/mercado-pago-api.ts`
**Depends on**: T12
**Reuses**: InvestPass API module style
**Requirement**: MPAG-12, MPAG-13, MPAG-15, MPAG-16, MPAG-17, MPAG-28

**Done when**:

- [x] Unit tests with mocked fetch cover multi-page walk, session missing, page failure mid-walk
- [x] Gate: extension vitest passes

**Tests**: unit
**Gate**: full

**Commit**: `feat(mpago): fetch binnacle period in extension`

---

### T14: Wire Mercado Pago bridge messages and keep InvestPass

**What**: Add `START_MP_IMPORT`, `MP_SESSION_MISSING`, `MP_IMPORT_PAYLOAD` on the PWA bridge and extension background; keep InvestPass `START_IMPORT` working; open `https://www.mercadopago.com.br/` on session missing.
**Where**: `src/sync/investpass-bridge.ts`
**Depends on**: T13
**Reuses**: Existing connect/PING/PONG
**Requirement**: MPAG-14, MPAG-55, MPAG-56, MPAG-57

**Done when**:

- [x] Bridge unit tests cover MP message types and InvestPass regression
- [x] Extension background updates and tests cover both message paths
- [x] Gate: `npm test` and extension tests pass

**Tests**: unit
**Gate**: full

**Commit**: `feat(mpago): add Mercado Pago bridge messages`

---

### Phase 5: UI and e2e

### T15: Add institution field to AccountForm

**What**: Institution select with "Mercado Pago" and "Outros bancos"; save `323` or empty; surface the second-active-323 error from the repository.
**Where**: `src/ui/components/AccountForm.tsx`
**Depends on**: T4
**Reuses**: Existing form controls
**Requirement**: MPAG-01, MPAG-02, MPAG-04, MPAG-06

**Done when**:

- [x] Form submits the correct bankCode
- [x] Gate: `npm run typecheck`

**Tests**: none
**Gate**: build

**Commit**: `feat(mpago): add institution choice to account form`

---

### T16: Add useMercadoPagoImport hook

**What**: Connect, send `START_MP_IMPORT`, wait for session without a 30s timeout, cancel writes nothing, on payload call `processMercadoPagoImport`, notify auto-sync; refuse reversed period before send.
**Where**: `src/ui/hooks/useMercadoPagoImport.ts`
**Depends on**: T10, T11, T14
**Reuses**: InvestPass hook pattern without its login timeout
**Requirement**: MPAG-13, MPAG-14, MPAG-15, MPAG-16, MPAG-29, MPAG-33, MPAG-37, MPAG-52

**Done when**:

- [x] Hook unit tests: session wait cancel, success path, page error writes nothing, no 30s timer on wait, reversed period refused
- [x] Gate: `npm test` passes for the hook

**Tests**: unit
**Gate**: quick

**Commit**: `feat(mpago): add useMercadoPagoImport hook`

---

### T17: Build MercadoPagoImportModal with period, wait, and log list

**What**: Modal with editable suggested period (from `source` `mercado_pago` logs), sign-in wait copy, run list for that source (period, time, counts), normal confirm on delete (not typed DELETE), dismiss leaves data.
**Where**: `src/ui/components/MercadoPagoImportModal.tsx`
**Depends on**: T8, T16
**Reuses**: ImportModal layout patterns, `deleteAccountImportRun`
**Requirement**: MPAG-13, MPAG-31, MPAG-33, MPAG-43, MPAG-44, MPAG-45

**Done when**:

- [x] Component typechecks and wires hook + delete-run
- [x] Gate: `npm run typecheck`

**Tests**: none
**Gate**: build

**Commit**: `feat(mpago): add Mercado Pago import modal`

---

### T18: Show Mercado Pago action on the dashboard card

**What**: On active cards with `bankCode === '323'`, show file Import and "Import from Mercado Pago" (local SVG or accessible name only — no Mercado Pago CDN). Institution change to empty hides the action and keeps data.
**Where**: `src/ui/pages/DashboardPage.tsx`
**Depends on**: T15, T17
**Reuses**: Existing AccountCard Import button
**Requirement**: MPAG-07, MPAG-08, MPAG-09, MPAG-10, MPAG-11

**Done when**:

- [x] Card opens the new modal for 323 accounts
- [x] Gate: `npm run typecheck`

**Tests**: none
**Gate**: build

**Commit**: `feat(mpago): show Mercado Pago action on dashboard`

---

### T19: Playwright coverage for institution and card action

**What**: E2E: save Mercado Pago institution; second active 323 rejected; 323 card shows both actions; non-323 shows file import only; toggle institution hides action and keeps account.
**Where**: `e2e/mercado-pago-import.spec.ts`
**Depends on**: T18
**Reuses**: `e2e/helpers.ts`, account creation helpers from `e2e/import.spec.ts`
**Requirement**: MPAG-04, MPAG-07, MPAG-08, MPAG-10, MPAG-11

**Done when**:

- [ ] New Playwright tests pass
- [ ] Gate: `npm run test:e2e` (or the scoped file) passes with `npm test` still green

**Tests**: e2e
**Gate**: full

**Commit**: `test(mpago): cover institution and dashboard action`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T8
Phase 2:  T7 → T8
Phase 3:  T9 → T10
Phase 4:  T12 → T13 → T14
Phase 5:  T15 → T18 → T19
Phase 5:  T16 → T17 → T18
```

Suggested Execute batches (~7 tasks, whole phases):

1. Phase 1 + Phase 2 (T1–T8)
2. Phase 3 + Phase 4 (T9–T14)
3. Phase 5 (T15–T19)

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | One migration module (+ index/sync-tables wiring in same commit) | ✅ |
| T2 | Account domain | ✅ |
| T3 | Account repository | ✅ |
| T4 | useAccounts wiring | ✅ |
| T5 | Log repository | ✅ |
| T6 | Period suggestion | ✅ |
| T7 | Import service link | ✅ |
| T8 | Delete-run worker | ✅ |
| T9 | Mapper | ✅ |
| T10 | Import orchestrator | ✅ |
| T11 | Period validation in same module | ✅ |
| T12 | Manifest | ✅ |
| T13 | Extension API | ✅ |
| T14 | Bridge + background messages | ⚠️ cohesive bridge pair; primary Where is PWA bridge |
| T15 | AccountForm | ✅ |
| T16 | Hook | ✅ |
| T17 | Modal | ✅ |
| T18 | Dashboard | ✅ |
| T19 | E2E file | ✅ |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (start) | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T1 | (phase 2 start; depends on T1 prior phase) | ✅ |
| T6 | None | (phase 2 parallel start) | ✅ Match to body |
| T7 | T1 | (after T1) | ✅ |
| T8 | T5, T7 | T5 → T8, T7 → T8 | ✅ |
| T9 | None | (phase 3 start) | ✅ |
| T10 | T5, T7, T9 | T5/T7/T9 → T10 | ✅ |
| T11 | T6 | T6 → T11 | ✅ |
| T12 | None | (phase 4 start) | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | T13 | T13 → T14 | ✅ |
| T15 | T4 | T4 → T15 | ✅ |
| T16 | T10, T11, T14 | T10/T11/T14 → T16 | ✅ |
| T17 | T8, T16 | T8/T16 → T17 | ✅ |
| T18 | T15, T17 | T15/T17 → T18 | ✅ |
| T19 | T18 | T18 → T19 | ✅ |

Note: Phase diagrams show linear chains within a phase. Cross-phase deps (T5→T1, T8→T5/T7, T10→T5/T7/T9, T11→T6, T15→T4, T16→T10/T11/T14, T17→T8/T16) are required by task bodies and are satisfied because earlier phases complete first. Intra-phase Execution Plan chains for Phase 2/3 are simplified sequences; the Phase Execution Map linear chains plus this table are the source of truth for `Depends on`.

To keep the validator's fence-edge check aligned, the Execution Plan fences use only within-phase arrows; cross-phase edges are documented in this table only.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Storage / migrations | unit | unit | ✅ |
| T2 | Domain | unit | unit | ✅ |
| T3 | Storage repositories | unit | unit | ✅ |
| T4 | UI hooks (wiring only) | none (typecheck) | none | ✅ |
| T5 | Storage repositories | unit | unit | ✅ |
| T6 | Domain | unit | unit | ✅ |
| T7 | Workers | unit | unit | ✅ |
| T8 | Workers | unit | unit | ✅ |
| T9 | Workers / mappers | unit | unit | ✅ |
| T10 | Workers | unit | unit | ✅ |
| T11 | Domain | unit | unit | ✅ |
| T12 | Extension manifest | none | none | ✅ |
| T13 | Extension fetch | unit | unit | ✅ |
| T14 | Sync bridge | unit | unit | ✅ |
| T15 | UI components | none | none | ✅ |
| T16 | UI hooks | unit | unit | ✅ |
| T17 | UI components | none | none | ✅ |
| T18 | UI pages | none | none | ✅ |
| T19 | E2E | e2e | e2e | ✅ |
