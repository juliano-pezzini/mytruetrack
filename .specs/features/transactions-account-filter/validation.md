# Transactions Account Filter Validation

**Date**: 2026-10-12
**Spec**: `.specs/features/transactions-account-filter/spec.md`
**Diff range**: `4196c99..3a9cac7` (full feature surface `1d06e65^..3a9cac7`)
**Verifier**: independent sub-agent (author ≠ verifier)
**HEAD**: `3a9cac7`
**Iteration**: fix→re-verify 1 of 3 (prior FAIL at `a5eacce`)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `getInDateRange` + unit test at `1d06e65` |
| T2 | ✅ Done | `useTransactions` null → all-accounts query |
| T3 | ✅ Done | Account picker on All-accounts create |
| T4 | ✅ Done | Page wiring + e2e; tasks.md Status Done |
| Fix commits | ✅ Done | `d22d0af` DESC sort; `3a9cac7` edge/form-close e2e |

---

## Spec-Anchored Acceptance Criteria

### P1: Clear account filter to All accounts

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| TXNF-01: open Transactions with active accounts → All accounts default | Filter value empty / All accounts selected | `e2e/transactions.spec.ts:171` - `expect(...getByLabel('Account filter')).toHaveValue('')`; impl `TransactionsPage.tsx:29` `useState(null)` | ✅ PASS |
| TXNF-02: All accounts → month list across active accounts, date DESC then id | Multi-account rows; **order newest first** | Listing: `e2e/transactions.spec.ts:174-177` both rows + names; order: `:179-180` `nth(0)` From Second / `nth(1)` From Test; UI DESC: `TransactionsPage.tsx:72-77` `b.localeCompare(a)` when `allAccountsMode`; repo: `transaction-repository.test.ts:131-132` | ✅ PASS |
| TXNF-03: specific account → only that account’s month rows | Other account’s row absent | `e2e/transactions.spec.ts:182-184` - From Test visible, From Second `toHaveCount(0)` | ✅ PASS |
| TXNF-04: All accounts → Account column with names | Columnheader Account + cell names | `e2e/transactions.spec.ts:172,176-177` | ✅ PASS |
| TXNF-05: specific account → hide Account column | Account columnheader count 0 | `e2e/transactions.spec.ts:185` | ✅ PASS |
| TXNF-06: All accounts → hide Balance column | Balance columnheader count 0 | `e2e/transactions.spec.ts:173` | ✅ PASS |
| TXNF-07: specific account → show Balance with running balance | Balance visible + computed cell | `e2e/transactions.spec.ts:93,95` Balance visible, `1,200.00`; also `:186` | ✅ PASS |
| TXNF-08: no active accounts → create-account guidance; All accounts not usable | Empty guidance; no All accounts option | `e2e/transactions.spec.ts:244-250` - “Create an account first…”; All accounts option count 0; No accounts option count 1; impl `TransactionsPage.tsx:148-149,245-246` | ✅ PASS |

### P1: Create from All accounts with account picker

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| TXNF-09: All accounts → + New Transaction enabled | Control usable / enabled | `e2e/transactions.spec.ts:35` click succeeds under All; `:194` filter still All | ✅ PASS |
| TXNF-10: create under All → required account picker of active accounts | Picker labeled Account, options include target | `e2e/transactions.spec.ts:36` `getByLabel('Account').selectOption({ label })`; form `TransactionForm.tsx:71-89` | ✅ PASS |
| TXNF-11: submit under All with no account → no create | Transaction not created / submit blocked | `e2e/transactions.spec.ts:212-214` - Should Not Appear cell count 0; New Transaction heading still visible; impl `TransactionForm.tsx:49-51` | ✅ PASS |
| TXNF-12: submit under All with account → create on that account + refresh list | New row visible attributed to chosen account | `e2e/transactions.spec.ts:203-204` Picker Created + Picker Bank cells | ✅ PASS |
| TXNF-13: create under specific account → no picker; create on filtered account | Account label count 0; row on filtered account | `e2e/transactions.spec.ts:218-227` - filter Test Bank, Account label count 0, Single Filter Create visible; wiring `TransactionsPage.tsx:232-237` passes `accountId` | ✅ PASS |
| TXNF-14: edit → no account picker; account unchanged | Account control absent on edit | `e2e/transactions.spec.ts:109` `getByLabel('Account').toHaveCount(0)`; update omits account (`TransactionsPage.tsx:298-304`) | ✅ PASS |

### Edge cases

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| TXNF-15: All accounts + empty month → empty-month message (not create-account) | “No transactions for {month}” | `e2e/transactions.spec.ts:51-52` `/No transactions for/i` (beforeEach has account, All default) | ✅ PASS |
| TXNF-16: switch filter mode → close open create/edit form | Form closed so account target cannot disagree | `e2e/transactions.spec.ts:229-233` - open New Transaction, switch to Test Bank, heading count 0; impl `TransactionsPage.tsx:96-102` | ✅ PASS |

**Status**: ✅ All ACs covered (16/16 with `file:line` evidence)

---

## Discrimination Sensor

Scratch: `D:\dev\_txn-filter-verifier-scratch2\wt` (git worktree at `3a9cac7`). Real tree never mutated. Baseline porcelain: `?? .specs/features/transactions-account-filter/validation.md`; post-cleanup porcelain identical; scratch removed.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `TransactionsPage.tsx:272` (and cell `:339`) | Flipped Balance visibility `!allAccountsMode` → `allAccountsMode` | ✅ Killed — `e2e/transactions.spec.ts:173` expected Balance count 0, got 1 |
| 2 | `transaction-repository.ts:91-106` (`getInDateRange`) | Removed date-range WHERE so all rows return | ✅ Killed — `transaction-repository.test.ts:131` expected length 2, got 4 |
| 3 | `TransactionsPage.tsx:96-102` | Removed `setShowForm(false)` / `setEditingId(null)` on filter switch (TXNF-16 re-check) | ✅ Killed — `e2e/transactions.spec.ts:233` expected New Transaction heading count 0, got 1 |

**Sensor depth**: lightweight (3 mutations; includes prior surviving TXNF-16 mutant)
**Result**: 3/3 killed — PASS ✅

---

## Interactive UAT Results

Not performed (Verifier run is automated evidence + sensor; interactive UAT left for orchestrator/user if needed).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns | ✅ |
| Spec-anchored outcome check | ✅ — DESC order aligned; prior unasserted ACs now evidenced |
| Per-layer Coverage Expectation met | ✅ — repo unit + e2e happy/edge/error paths for filter feature |
| Every test maps to a spec requirement | ✅ — new e2e map to TXNF-*; pre-existing flows adjusted for All default |
| Documented guidelines followed: `AGENTS.md`, `vitest.config.ts` (UI not in unit coverage; e2e for transactions) | ✅ |

---

## Edge Cases

- [x] Empty month under All accounts: handled + tested (TXNF-15)
- [x] Empty accounts on Transactions: handled + tested (TXNF-08)
- [x] Close form on filter mode switch: handled + tested; sensor killed (TXNF-16)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint` (Build) + Full: `npm test -- src/storage/repositories/transaction-repository.test.ts && npm run test:e2e -- e2e/transactions.spec.ts`
- **Result**: typecheck ✅, lint ✅, unit 9 passed / 0 failed, e2e 13 passed / 0 failed, 0 skipped
- **Test count before feature** (`4196c99` / `1d06e65^`): unit `it(` 8; e2e `test(` 7
- **Test count after feature** (`3a9cac7`): unit 9; e2e 13
- **Delta**: +1 unit, +6 e2e (no silent deletions; prior FAIL had +2 e2e, fix commit added +4 more)
- **Skipped tests**: none
- **Failures**: none at gate

---

## Fix Plans

None — all prior gaps closed; sensor 3/3 killed.

---

## Requirement Traceability Update

Suggested (spec.md not edited — verifier read-only except this report):

| Requirement | Previous Status (prior FAIL) | New Status |
| ----------- | ---------------------------- | ---------- |
| TXNF-01 | ✅ Verified | ✅ Verified |
| TXNF-02 | ❌ Needs Fix (order) | ✅ Verified |
| TXNF-03 | ✅ Verified | ✅ Verified |
| TXNF-04 | ✅ Verified | ✅ Verified |
| TXNF-05 | ✅ Verified | ✅ Verified |
| TXNF-06 | ✅ Verified | ✅ Verified |
| TXNF-07 | ✅ Verified | ✅ Verified |
| TXNF-08 | ❌ Needs Fix (no evidence) | ✅ Verified |
| TXNF-09 | ✅ Verified | ✅ Verified |
| TXNF-10 | ✅ Verified | ✅ Verified |
| TXNF-11 | ❌ Needs Fix (no evidence) | ✅ Verified |
| TXNF-12 | ✅ Verified | ✅ Verified |
| TXNF-13 | ❌ Needs Fix (no evidence) | ✅ Verified |
| TXNF-14 | ✅ Verified | ✅ Verified |
| TXNF-15 | ✅ Verified | ✅ Verified |
| TXNF-16 | ❌ Needs Fix (surviving mutant) | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 16/16 ACs matched with evidence; 0 spec-precision gaps
**Sensor**: 3/3 mutations killed (TXNF-16 form-close mutant now killed)
**Gate**: typecheck/lint/unit/e2e all green

**What works**: Default All accounts, DESC multi-account list + Account/Balance column toggles, create-via-picker, reject empty picker, single-account create without picker, no-accounts guidance, form close on filter switch, edit without account picker, empty-month message, repo date-range query.

**Issues found**: none

**Next steps**: Feature ready for interactive UAT / merge path; no further fix→re-verify iterations required.
