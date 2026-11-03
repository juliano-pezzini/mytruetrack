# Transaction Period Filter Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/transaction-period-filter/design.md`
**Status**: In Progress

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` (domain and UI co-located tests, Vitest and Playwright), `vitest.config.ts` (include `src/**/*.test.ts`, 80% coverage on `src/domain/**`), `package.json`, `.github/workflows/pr-checks.yml`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain | unit | All branches; 1:1 to the span math ACs; leap-day and common-year February | `src/domain/*.test.ts` | `npm test` |
| UI component | unit | Picker behaviors in the spec: shortcuts, two-click span, earlier end, dismiss, year step | `src/ui/components/*.test.ts` with `@vitest-environment jsdom` | `npm test` |
| Transactions route | e2e | Happy path plus empty span, reset on return, account filter keeps the span, arrows absent | `e2e/transactions.spec.ts` | `npm run test:e2e` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only | `npm test` |
| Full | After the Transactions route task | `npm test && npm run test:e2e` |
| Build | After the last task | `npm run lint && npm run typecheck && npm run test:coverage && npm run build` |

---

## Execution Plan

Phases are ordered and run sequentially. Tasks within a phase execute in order.

### Phase 1: Span values

```
T1
```

### Phase 2: Popover

```
T2
```

### Phase 3: Ledger wiring

```
T3
```

```
T1 -> T2 -> T3
```

---

## Task Breakdown

### T1: Add calendar month span values

**What**: Pure functions for shortcut spans, inclusive dates, the day before a span, labels, and year shifts.
**Where**: `src/domain/period-span.ts`
**Depends on**: None
**Reuses**: `src/domain/account-import-period.ts`
**Requirement**: PERIOD-04, PERIOD-05, PERIOD-06, PERIOD-11, PERIOD-12, PERIOD-17, PERIOD-18, PERIOD-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `monthSpanForShortcut` on `{ year: 2026, month: 11 }` returns Sep–Nov 2026, Jan–Nov 2026, and Dec 2025–Nov 2026 for the three multi-month shortcuts, and Nov 2026 for this month
- [x] `formatSpanLabel` returns `Nov 2026` for one month and `Dec 2025 – Nov 2026` for a longer span, using U+2013
- [x] `inclusiveDateRange` uses the first day of the start month and the real last day of the end month, including 2024-02-29 and 2025-02-28
- [x] `dayBeforeSpan` and `shiftYear` have no year clamp
- [x] Gate check passes: `npm test`
- [x] Test count: the new `src/domain/period-span.test.ts` cases above pass, and no existing test is deleted

**Status**: Complete

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): add calendar month span values`

---

### T2: Add the period range popover

**What**: The Period button and popover that edit a `MonthSpan` without changing the list until the range is complete.
**Where**: `src/ui/components/PeriodRangePicker.tsx`
**Depends on**: T1
**Reuses**: `src/ui/components/Sidebar.test.ts`, toolbar classes on `TransactionsPage`
**Requirement**: PERIOD-02, PERIOD-03, PERIOD-07, PERIOD-08, PERIOD-09, PERIOD-10, PERIOD-13, PERIOD-14, PERIOD-15, PERIOD-16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The button's accessible name is Period and its text is the span label
- [x] Shortcuts named This month, Last 3 months, This year, and Last 12 months call `onChange` with `monthSpanForShortcut(today, …)` and close
- [x] The first click sets a pending start and does not call `onChange`. A To month on or after that start calls `onChange` and closes. An earlier To month replaces the start. The same month as both ends selects that month
- [x] Escape and a pointerdown outside keep the applied span. There is no Apply control
- [x] Previous year and Next year change only that grid's year
- [x] Gate check passes: `npm test`
- [x] Test count: the new `src/ui/components/PeriodRangePicker.test.ts` cases above pass, and no existing test is deleted

**Status**: Complete

**Tests**: unit
**Gate**: quick

**Commit**: `feat(transactions): add the period range popover`

---

### T3: Filter the ledger by the month span

**What**: Transactions holds a `MonthSpan`, feeds the existing list and balance, and drops the month arrows.
**Where**: `src/ui/pages/TransactionsPage.tsx`
**Depends on**: T2
**Reuses**: `useTransactions`, `useAccountBalance`, the current sort and balance walk
**Requirement**: PERIOD-01, PERIOD-20, PERIOD-21, PERIOD-22, PERIOD-23, PERIOD-24, PERIOD-25, PERIOD-26, PERIOD-27

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Opening the page selects the current local month. The balance date is `dayBeforeSpan`. The empty copy is `No transactions for {label}.`
- [ ] Previous month and Next month buttons are gone. Changing account keeps the span. Leaving the page and returning resets to the current month
- [ ] One account stays oldest-first with the running balance. All accounts stays newest-first with no balance column
- [ ] `e2e/transactions.spec.ts` covers the current-month label, Last 12 months, a row inside the span and a row outside it, the empty copy, reset on return, and the removed arrows
- [ ] Gate check passes: `npm test && npm run test:e2e`
- [ ] Test count: the transactions e2e file passes with the stepper test replaced, and no other e2e test is deleted

**Tests**: e2e
**Gate**: full

**Commit**: `feat(transactions): filter the ledger by a month span`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1
Phase 2:  T2
Phase 3:  T3
```

Execution is strictly sequential. Three tasks fit one batch, so Execute runs inline.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Add calendar month span values | 1 domain module | Granular |
| T2: Add the period range popover | 1 component | Granular |
| T3: Filter the ledger by the month span | 1 page | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | no incoming arrow | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Add calendar month span values | Domain | unit | unit | OK |
| T2: Add the period range popover | UI component | unit | unit | OK |
| T3: Filter the ledger by the month span | Transactions route | e2e | e2e | OK |
