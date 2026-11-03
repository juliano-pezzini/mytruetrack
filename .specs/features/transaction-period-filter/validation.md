# Transaction period filter validation

**Date**: 2026-11-03
**Spec**: `.specs/features/transaction-period-filter/spec.md`
**Diff range**: `9395dce..HEAD` (`8240cda`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 2
**Result**: PASS

Re-derived all 27 acceptance criteria from the spec. Did not use the previous report as evidence.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `src/domain/period-span.ts`, commit `d360bb5` |
| T2 | ✅ Done | `src/ui/components/PeriodRangePicker.tsx`, commit `0e1efec` |
| T3 | ✅ Done | `src/ui/pages/TransactionsPage.tsx` and `e2e/transactions.spec.ts`, commits `b4d6b89` and `8240cda` |

No task is blocked or partial. `tasks.md` marks T1–T3 complete.

---

## Spec-Anchored Acceptance Criteria

Story 1 criteria are PERIOD-01 through PERIOD-16. Story 2 criteria are PERIOD-17 through PERIOD-27.

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| PERIOD-01 WHEN the user opens Transactions THEN the system SHALL select the device's current local calendar month and show the transactions in that month | Period button is the en-US short label of the local month. A transaction dated in that month is listed | `e2e/transactions.spec.ts:136` - `toHaveText(label)` where `label` is `shortMonth(now.getFullYear(), now.getMonth() + 1)`; `e2e/transactions.spec.ts:151` - `toBeVisible()` for Salary dated `thisMonth(1)` | ✅ PASS |
| PERIOD-02 WHEN the user activates the period control THEN the system SHALL open a popover that offers This month, Last 3 months, This year, and Last 12 months, plus a start-month choice and an end-month choice | Those four names, plus From and To groups | `src/ui/components/PeriodRangePicker.test.ts:49` - `getByRole('button', { name: 'This month' })`; `:50` Last 3 months; `:51` This year; `:52` Last 12 months; `:53` group From; `:54` group To | ✅ PASS |
| PERIOD-03 WHEN the user chooses This month THEN the system SHALL select the current local calendar month, show the transactions in that month, and close the popover | On 2026-11-02 the span is November 2026 through November 2026, then the popover closes | `src/domain/period-span.test.ts:16` - `toEqual({ start: { year: 2026, month: 11 }, end: { year: 2026, month: 11 } })`; `src/ui/components/PeriodRangePicker.test.ts:62` - `toHaveBeenCalledWith` that span; `:66` - `queryByRole('button', { name: 'This month' })` is null | ✅ PASS |
| PERIOD-04 WHEN the user chooses Last 3 months on 2026-11-02 THEN the system SHALL select September 2026 through November 2026, show the transactions in that span, and close the popover | start month 9, end month 11, year 2026, popover closed | `src/domain/period-span.test.ts:23` - `toEqual({ start: { year: 2026, month: 9 }, end: { year: 2026, month: 11 } })`; `src/ui/components/PeriodRangePicker.test.ts:73` - `toHaveBeenCalledWith` that span; `:77` - Last 3 months button is null | ✅ PASS |
| PERIOD-05 WHEN the user chooses This year on 2026-11-02 THEN the system SHALL select January 2026 through November 2026, show the transactions in that span, and close the popover | start January 2026, end November 2026, popover closed | `src/domain/period-span.test.ts:37` - `toEqual({ start: { year: 2026, month: 1 }, end: { year: 2026, month: 11 } })`; `src/ui/components/PeriodRangePicker.test.ts:84` - `toHaveBeenCalledWith` that span; `:88` - This year button is null | ✅ PASS |
| PERIOD-06 WHEN the user chooses Last 12 months on 2026-11-02 THEN the system SHALL select December 2025 through November 2026, show the transactions in that span, and close the popover | start December 2025, end November 2026, popover closed. The list follows that span | `src/domain/period-span.test.ts:51` - `toEqual({ start: { year: 2025, month: 12 }, end: { year: 2026, month: 11 } })`; `src/ui/components/PeriodRangePicker.test.ts:95` - `toHaveBeenCalledWith` that span; `e2e/transactions.spec.ts:233` - Period button `toHaveText(last12)`; `:234` - Last 12 months button count 0; `:257` - June Early count 0 while that span is applied | ✅ PASS |
| PERIOD-07 WHEN the user chooses a start month THEN the system SHALL keep the popover open and SHALL keep showing the previously applied span | `onChange` is not called. The shortcut row stays mounted | `src/ui/components/PeriodRangePicker.test.ts:110` - `not.toHaveBeenCalled()`; `:111` - Last 3 months button is truthy | ✅ PASS |
| PERIOD-08 WHEN the user chooses an end month on or after the start month THEN the system SHALL select the inclusive span, show its transactions, and close the popover | September 2026 through November 2026, popover closed | `src/ui/components/PeriodRangePicker.test.ts:121` - `toHaveBeenCalledWith({ start: { year: 2026, month: 9 }, end: { year: 2026, month: 11 } })`; `:125` - From group is null | ✅ PASS |
| PERIOD-09 IF the user chooses an end month earlier than the start month THEN the system SHALL set that earlier month as the start, keep the popover open, and keep showing the previously applied span | September does not apply. A later November completes September 2026 through November 2026 | `src/ui/components/PeriodRangePicker.test.ts:135` - `not.toHaveBeenCalled()`; `:136` - To group is truthy; `:138` - `toHaveBeenCalledWith({ start: { year: 2026, month: 9 }, end: { year: 2026, month: 11 } })` | ✅ PASS |
| PERIOD-10 WHEN the user chooses the same month as start and as end THEN the system SHALL select that single month, show its transactions, and close the popover | November 2026 through November 2026, popover closed | `src/ui/components/PeriodRangePicker.test.ts:157` - `toHaveBeenCalledWith({ start: { year: 2026, month: 11 }, end: { year: 2026, month: 11 } })`; `:161` - To group is null | ✅ PASS |
| PERIOD-11 WHEN the applied span is one month THEN the period control SHALL show the en-US short month and year, for example `Nov 2026` | Exact text `Nov 2026`. A chosen single month uses the same shape (`Jun 2024`) | `src/domain/period-span.test.ts:65` - `toBe('Nov 2026')`; `src/ui/components/PeriodRangePicker.test.ts:32` - `textContent` `toBe('Nov 2026')`; `e2e/transactions.spec.ts:261` - `toHaveText('Jun 2024')` | ✅ PASS |
| PERIOD-12 WHEN the applied span covers more than one month THEN the period control SHALL show the start and end short labels joined by ` – ` (space, U+2013, space), for example `Dec 2025 – Nov 2026` | Exact string `Dec 2025 \u2013 Nov 2026` | `src/domain/period-span.test.ts:74` - `toBe('Dec 2025 \u2013 Nov 2026')`; `src/ui/components/PeriodRangePicker.test.ts:42` - button `textContent` `toBe('Dec 2025 \u2013 Nov 2026')` | ✅ PASS |
| PERIOD-13 IF the user dismisses the popover before the range is complete THEN the system SHALL keep the previously applied span | Escape and a pointerdown outside do not call `onChange`, and the popover closes | `src/ui/components/PeriodRangePicker.test.ts:173` - `not.toHaveBeenCalled()` after Escape; `:174` - This month button is null; `:186` - `not.toHaveBeenCalled()` after `pointerDown` on `document.body`; `:187` - From group is null | ✅ PASS |
| PERIOD-14 WHEN the user steps the year on the start choice or the end choice THEN the system SHALL change only that choice's year, with no minimum year and no maximum year | From can show 2025 while To shows 2027. `shiftYear` reaches year 0 and year 2027 with the month unchanged. Stepping does not apply a span | `src/ui/components/PeriodRangePicker.test.ts:197` - From has November 2025; `:198` - To does not; `:199` - To has November 2027; `:200` - From does not; `:201` - `not.toHaveBeenCalled()`; `src/domain/period-span.test.ts:174` - `toEqual({ year: 0, month: 1 })` and `toEqual({ year: 2027, month: 11 })` | ✅ PASS |
| PERIOD-15 The Transactions page SHALL NOT show a Previous month button or a Next month button | Both buttons have count 0 | `e2e/transactions.spec.ts:138` - Previous month `toHaveCount(0)`; `:139` - Next month `toHaveCount(0)` | ✅ PASS |
| PERIOD-16 The popover SHALL apply a shortcut or a completed range without a separate Apply control | No Apply button. Shortcuts and a completed range call `onChange` directly | `src/ui/components/PeriodRangePicker.test.ts:55` - `queryByRole('button', { name: 'Apply' })` is null; `:62` - This month `toHaveBeenCalledWith` the span | ✅ PASS |
| PERIOD-17 The system SHALL include a transaction on or between the first day of the start month and the last day of the end month, and SHALL exclude a transaction outside that span | June 2024 includes 2024-06-01 and excludes 2024-05-31. The range for January through March 2024 is 2024-01-01 through 2024-03-31 | `e2e/transactions.spec.ts:262` - June Early `toBeVisible()`; `:264` - May Edge `toHaveCount(0)`; `src/domain/period-span.test.ts:110` - `toEqual({ from: '2024-01-01', to: '2024-03-31' })` | ✅ PASS |
| PERIOD-18 IF the end month is February 2024 THEN the system SHALL treat the last day of the span as 2024-02-29 | `to` is `2024-02-29` | `src/domain/period-span.test.ts:119` - `toEqual({ from: '2024-02-01', to: '2024-02-29' })` | ✅ PASS |
| PERIOD-19 IF the end month is February 2025 THEN the system SHALL treat the last day of the span as 2025-02-28 | `to` is `2025-02-28` | `src/domain/period-span.test.ts:128` - `toEqual({ from: '2025-02-01', to: '2025-02-28' })` | ✅ PASS |
| PERIOD-20 WHILE one account is selected, the system SHALL list the span by `transaction_date` ascending, breaking ties by id ascending | Different dates: 2024-06-01 (June Early) before 2024-06-15 (June Late). Same date 2026-11-02: id-a Alpha before id-b Beta | `e2e/transactions.spec.ts:272` - row 0 contains June Early; `:273` - row 1 contains June Late; `src/ui/pages/TransactionsPage.test.ts:157` - `toContain('Alpha')`; `:158` - `toContain('Beta')` | ✅ PASS |
| PERIOD-21 WHILE one account is selected, the system SHALL show each row's balance as the account balance on the last calendar day before the start month after applying that row and every earlier row in the span, with a credit increasing the balance and a debit decreasing it | Initial 1000.00. May 31 debit 10.00 is inside the 2024-05-31 balance (990). June 1 debit 10.00 yields 980.00. June 15 credit 25.00 yields 1,005.00. A credit alone on a 1000.00 account yields 1,200.00 | `e2e/transactions.spec.ts:274` - cell `980.00` `toBeVisible()`; `:275` - cell `1,005.00` `toBeVisible()`; `:182` - cell `1,200.00` `toBeVisible()` | ✅ PASS |
| PERIOD-22 WHILE All accounts is selected, the system SHALL list the span by `transaction_date` descending, breaking ties by id descending | Different dates: June Late before June Early. Same date: id-b Beta before id-a Alpha | `e2e/transactions.spec.ts:266` - row 0 contains June Late; `:267` - row 1 contains June Early; `src/ui/pages/TransactionsPage.test.ts:149` - `toContain('Beta')`; `:150` - `toContain('Alpha')` | ✅ PASS |
| PERIOD-23 WHILE All accounts is selected, the system SHALL omit the balance column | Balance columnheader count is 0 | `e2e/transactions.spec.ts:265` - `toHaveCount(0)` | ✅ PASS |
| PERIOD-24 WHEN the span contains no transactions THEN the system SHALL show `No transactions for {label}.`, where `{label}` is the period control text | Current-month label, and `No transactions for Jan 2020.` after that month is applied | `e2e/transactions.spec.ts:137` - `toBeVisible()` for ``No transactions for ${label}.``; `:278` - `toBeVisible()` for `No transactions for Jan 2020.` | ✅ PASS |
| PERIOD-25 WHEN the user leaves Transactions and opens it again THEN the system SHALL reset the span to the current local calendar month | After Last 12 months, Accounts, and a return, the Period button is the current short month | `e2e/transactions.spec.ts:297` - `toHaveText(current)` | ✅ PASS |
| PERIOD-26 WHEN the user changes the account filter THEN the system SHALL keep the applied span | After selecting Test Bank the Period button is still `Jun 2024` | `e2e/transactions.spec.ts:270` - `toHaveText('Jun 2024')` | ✅ PASS |
| PERIOD-27 WHEN the user selects a future month that contains no transactions THEN the system SHALL show the empty state for that month | January of the next calendar year. Button text `Jan {year}`. Copy `No transactions for Jan {year}.` On 2026-11-03 that year is 2027 | `e2e/transactions.spec.ts:282` - `toHaveText(\`Jan ${futureYear}\`)` with `futureYear = new Date().getFullYear() + 1`; `:283` - `toBeVisible()` for ``No transactions for Jan ${futureYear}.`` | ✅ PASS |

**Status**: ✅ All 27 ACs matched the spec-defined outcome. 0 spec-precision gaps.

The two gaps from iteration 1 are closed. PERIOD-20 and PERIOD-22 now assert same-date order for id-a Alpha and id-b Beta (`TransactionsPage.test.ts:149` and `:157`). PERIOD-27 selects January of next year, not January 2020 (`e2e/transactions.spec.ts:280`).

---

## Discrimination Sensor

Scratch: git worktree at `C:\Users\Juliano\AppData\Local\Temp\mtt-period-sensor` (detached `8240cda`), then removed. The real worktree was not edited. No `git stash`.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `src/ui/pages/TransactionsPage.tsx:88` | Same-date id comparator reversed: All accounts uses `a.id.localeCompare(b.id)`, one account uses `b.id.localeCompare(a.id)` | ✅ Killed. `npm test` in the worktree: 1 failed, 658 passed, exit 1. `TransactionsPage.test.ts:149` expected the first row to contain Beta (id-b) and received Alpha (id-a) |
| 2 | `src/ui/components/PeriodRangePicker.tsx:94` | Earlier-end check `compareMonths(end, pendingStart) < 0` flipped to `> 0` | ✅ Killed. `npm test`: 3 failed, 656 passed, exit 1. A later end did not call `onChange` (`PeriodRangePicker.test.ts:121`). An earlier end called `onChange` with start November 2026 and end September 2026 (`PeriodRangePicker.test.ts:135`) |
| 3 | `src/ui/components/PeriodRangePicker.tsx:94` | `chooseTo` returns without applying when the end month is after the picker `today` | ✅ Killed by the transactions e2e, not by unit tests. `npm test`: 659 passed, exit 0. Playwright on the worktree, port 5207: `e2e/transactions.spec.ts:282` expected Period text `Jan 2027` and received `Jan 2020`, exit 1 |

**Sensor depth**: lightweight (3 behavior-level mutations)
**Result**: 3/3 killed

Isolation: `git status --porcelain` in `D:\dev\mytruetrack-pipe2` before the sensor and after `git worktree remove --force` of both scratch worktrees was only `?? .specs/features/transaction-period-filter/validation.md`. `git diff --stat` was empty.

---

## Interactive UAT Results (if performed)

Not performed. This pass is automated re-verification. The route behavior was executed with Playwright instead of a live walkthrough.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Span math, one popover, and page wiring. No extra settings or storage |
| Surgical changes | ✅ Month arrows and the single-month range helper were replaced by the span. Account query behavior stayed |
| No scope creep | ✅ Dashboard and import period fields were not changed |
| Matches patterns | ✅ Domain values, a function component, co-located Vitest, Playwright for the route |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ Domain span math, shortcut windows, leap day, and year shift are unit-tested. The Transactions route covers the current month, Last 12 months, in-span and out-of-span rows, empty copy, a future empty month, reset on return, account filter keeping the span, and absent arrows |
| Every test maps to a spec requirement - no unclaimed tests | ✅ New unit and e2e cases map to PERIOD-01–PERIOD-27 or the T1–T3 done-when checks. The second From click (`PeriodRangePicker.test.ts:204`) maps to the confirmed first-click rule and PERIOD-09 |
| Documented guidelines followed: `AGENTS.md`, `vitest.config.ts`, `tasks.md` coverage matrix | ✅ |

No `// SPEC_DEVIATION` marker in the feature diff.

---

## Edge Cases

- [x] February 2024 ends on 2024-02-29 (`src/domain/period-span.test.ts:119`)
- [x] February 2025 ends on 2025-02-28 (`src/domain/period-span.test.ts:128`)
- [x] An earlier end becomes the new start and does not change the list (`src/ui/components/PeriodRangePicker.test.ts:135`)
- [x] Dismissing an unfinished popover keeps the applied span (`src/ui/components/PeriodRangePicker.test.ts:173` and `:186`)
- [x] An empty span shows `No transactions for {label}.` (`e2e/transactions.spec.ts:137` and `:278`)
- [x] A future month with no transactions shows that empty state (`e2e/transactions.spec.ts:283`)

---

## Gate Check

- **Gate command**: `npm run lint && npm run typecheck && npm run test:coverage && npm run build`
- **Result**: exit 0. 659 passed, 0 failed, 0 skipped
- **Lint**: passed (`eslint src/`)
- **Typecheck**: passed (`tsc --noEmit`)
- **Build**: passed (`tsc -b && vite build`)
- **Transactions e2e**: 14 passed, 0 failed, 0 skipped. Playwright served this checkout at `http://127.0.0.1:5199`. Port 5173 was not used
- **Test count before feature**: 624 unit tests, derived as 659 minus the 35 new `it` cases. `it(` count is 617 at `9395dce` and 652 at HEAD. No unit `it(` was removed in the diff
- **Test count after feature**: 659 unit tests
- **Delta**: +35 unit tests (`src/domain/period-span.test.ts` 19, `src/ui/components/PeriodRangePicker.test.ts` 15, `src/ui/pages/TransactionsPage.test.ts` 1). In `e2e/transactions.spec.ts`, `month navigation changes displayed period` was removed and two tests were added. Removal is required by PERIOD-15: the previous and next month buttons are gone
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans (if issues found)

None.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| PERIOD-01 | Verified | ✅ Verified |
| PERIOD-02 | Verified | ✅ Verified |
| PERIOD-03 | Verified | ✅ Verified |
| PERIOD-04 | Verified | ✅ Verified |
| PERIOD-05 | Verified | ✅ Verified |
| PERIOD-06 | Verified | ✅ Verified |
| PERIOD-07 | Verified | ✅ Verified |
| PERIOD-08 | Verified | ✅ Verified |
| PERIOD-09 | Verified | ✅ Verified |
| PERIOD-10 | Verified | ✅ Verified |
| PERIOD-11 | Verified | ✅ Verified |
| PERIOD-12 | Verified | ✅ Verified |
| PERIOD-13 | Verified | ✅ Verified |
| PERIOD-14 | Verified | ✅ Verified |
| PERIOD-15 | Verified | ✅ Verified |
| PERIOD-16 | Verified | ✅ Verified |
| PERIOD-17 | Verified | ✅ Verified |
| PERIOD-18 | Verified | ✅ Verified |
| PERIOD-19 | Verified | ✅ Verified |
| PERIOD-20 | Verified | ✅ Verified |
| PERIOD-21 | Verified | ✅ Verified |
| PERIOD-22 | Verified | ✅ Verified |
| PERIOD-23 | Verified | ✅ Verified |
| PERIOD-24 | Verified | ✅ Verified |
| PERIOD-25 | Verified | ✅ Verified |
| PERIOD-26 | Verified | ✅ Verified |
| PERIOD-27 | Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 27/27 ACs matched spec outcome. 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Gate**: 659 passed, transactions e2e 14 passed

**What works**: The period popover applies the four shortcuts and a two-click month span, labels them with the en-US short form and an en dash, and filters the ledger. One account stays oldest-first with a running balance from the day before the span. All accounts stays newest-first without a balance column. Same-date ties follow id ascending for one account and id descending for All accounts. An empty month, including January of next year, shows `No transactions for {label}.` Leaving the page resets to the current month. The month arrows are gone.

**Issues found**: none

**Next steps**: none for this feature
