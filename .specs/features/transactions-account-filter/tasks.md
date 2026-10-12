# Transactions Account Filter Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: skipped (medium feature; decisions in `context.md`)
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` (domain/sync coverage via vitest; Playwright for onboarding/transactions/import/sync), `vitest.config.ts` (unit include `src/**/*.test.ts`; coverage scoped to domain/storage/crypto/sync/workers — not `src/ui`), `package.json` scripts, `.github/workflows/pr-checks.yml`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Repository (`transaction-repository`) | unit | Key query paths for all-accounts date range + empty active set | `src/storage/repositories/*.test.ts` | `npm test` |
| Hook (`useTransactions`) | none | Verified through Transactions e2e (no UI hook unit suite in coverage) | - | build gate |
| Presentational form (`TransactionForm`) | none | Picker behavior verified through Transactions e2e | - | build gate |
| Transactions page / user flows | e2e | Happy path + listed edge cases (default All, filter one, create with picker, Balance/Account columns) | `e2e/transactions.spec.ts` | `npm run test:e2e -- e2e/transactions.spec.ts` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `npm test -- src/storage/repositories/transaction-repository.test.ts` |
| Full | After tasks with e2e tests | `npm test -- src/storage/repositories/transaction-repository.test.ts && npm run test:e2e -- e2e/transactions.spec.ts` |
| Build | After phase completion or none-test tasks | `npm run typecheck && npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Data

```
T1
```

### Phase 2: Hook

```
T2
```

### Phase 3: UI

```
T3 → T4
```

---

## Task Breakdown

### Phase 1: Data

### T1: Add all-accounts date-range query on transaction repository

**What**: Add a repository method that returns transactions in an optional date range without requiring a single account id.
**Where**: `src/storage/repositories/transaction-repository.ts`
**Depends on**: None
**Reuses**: Existing `getByAccount` date-range SQL pattern and `DateRange` type
**Requirement**: TXNF-02

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Repository can list transactions for a date range across accounts
- [x] Unit tests cover: multi-account rows in range, out-of-range excluded, other-account rows included when not filtered
- [x] Gate check passes: `npm test -- src/storage/repositories/transaction-repository.test.ts`
- [x] Test count: existing cases remain; at least 1 new case for the all-accounts query

**Tests**: unit
**Gate**: quick

**Commit**: `feat(txn-filter): add date-range query across accounts` ✅ `done`

---

### Phase 2: Hook

### T2: Load all-accounts transactions when filter is cleared

**What**: Extend `useTransactions` so a null `accountId` loads the all-accounts date-range query instead of clearing the list.
**Where**: `src/ui/hooks/useTransactions.ts`
**Depends on**: T1
**Reuses**: T1 repository method; existing refresh/requestId pattern
**Requirement**: TXNF-02, TXNF-08

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `accountId === null` with a date range loads all-accounts rows via T1
- [x] Create/update/delete still refresh after writes
- [x] Gate check passes: `npm run typecheck && npm run lint`
- [x] No silent deletion of existing unit tests

**Tests**: none
**Gate**: build

**Commit**: `feat(txn-filter): load all accounts when filter cleared` ✅ `done`

---

### Phase 3: UI

### T3: Add required account picker to create form

**What**: When the create form is used without a fixed account, show a required active-account picker; edit and single-account create keep today’s no-picker behavior.
**Where**: `src/ui/components/TransactionForm.tsx`
**Depends on**: None
**Reuses**: Existing form field patterns; account list shape from `Account`
**Requirement**: TXNF-10, TXNF-11, TXNF-13, TXNF-14

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Create with `accounts` (and no fixed `accountId`) shows a required account select labeled for accessibility
- [x] Submit without a chosen account does not call `onSubmit`
- [x] Create with fixed `accountId` (no `accounts` / single-account mode) shows no picker and submits that account
- [x] Edit mode shows no account picker
- [x] Gate check passes: `npm run typecheck && npm run lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(txn-filter): require account picker on all-accounts create` ✅ `done`

---

### T4: Wire All-accounts filter UI and e2e coverage

**What**: Transactions page defaults to All accounts, toggles Account/Balance columns, closes open forms on filter mode switch, and wires create/edit to T2/T3; Playwright covers the flows and updates existing specs for the new default.
**Where**: `src/ui/pages/TransactionsPage.tsx`
**Depends on**: T2, T3
**Reuses**: Existing select/month controls; `useAccounts` for names
**Requirement**: TXNF-01, TXNF-03, TXNF-04, TXNF-05, TXNF-06, TXNF-07, TXNF-08, TXNF-09, TXNF-12, TXNF-15, TXNF-16

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Default filter is All accounts when accounts exist
- [x] Selecting All accounts lists that month’s transactions across active accounts with Account column and without Balance column
- [x] Selecting one account filters the list, hides Account column, shows Balance
- [x] + New Transaction stays enabled on All accounts and uses the form picker; create refreshes the list
- [x] Switching filter mode closes open create/edit forms
- [x] Existing transaction e2e flows pass (adjusted for All-accounts default / picker)
- [x] New e2e covers All-accounts default visibility across two accounts and create-via-picker
- [x] Gate check passes: full gate command above
- [x] Test count: no silent deletions of prior e2e cases

**Tests**: e2e
**Gate**: full

**Commit**: `feat(txn-filter): default transactions to all accounts` ✅ `done`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3 ------→ T4
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Repository date-range query | 1 repository method + colocated unit tests | ✅ Granular |
| T2: useTransactions null=all | 1 hook | ✅ Granular |
| T3: TransactionForm account picker | 1 component | ✅ Granular |
| T4: TransactionsPage + e2e | 1 page + colocated e2e (UI surface) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | (root) | ✅ Match |
| T2 | T1 | T1 → T2 (phase order) | ✅ Match |
| T3 | None | T3 root in Phase 3 | ✅ Match |
| T4 | T2, T3 | T3 → T4; Phase 2 before Phase 3 supplies T2 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Repository | unit | unit | ✅ OK |
| T2 | Hook | none | none | ✅ OK |
| T3 | Presentational form | none | none | ✅ OK |
| T4 | Transactions page / user flows | e2e | e2e | ✅ OK |
