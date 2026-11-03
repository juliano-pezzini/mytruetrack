# Transaction Period Filter Specification

## Problem Statement

The Transactions period control moves one calendar month per click. Reaching a window a year back takes twelve clicks, and the list can show only one month. The user needs to view a span of months, including a span that sits well in the past.

## Goals

- [ ] Select any inclusive span of calendar months, including one a year or more back, from one popover
- [ ] Apply This month, Last 3 months, This year, and Last 12 months in one action
- [ ] The transaction list, empty state, and single-account running balance follow that span

## Out of Scope

| Feature | Reason |
| --- | --- |
| Dashboard period control | The Dashboard stays on the current month |
| InvestPass and Mercado Pago period fields | Those fields choose an import window, not the ledger view |
| Day-level ranges | The agreed grain is a whole calendar month |
| Paging or a summary of a long span | The table shows every row in the span |
| Remembering the span after leaving Transactions | The span resets the way the month stepper does today |
| Previous and next month arrow buttons | The popover replaces them |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Span grain | Whole calendar months, first day through last day, inclusive | The user chose a month span | y |
| Control | Range popover with four shortcuts and From / To month grids | The user chose this control | y |
| Shortcut windows | End on the current local month. Last 3 months is that month plus the two before it. Last 12 months is that month plus the eleven before it. This year is January of the current year through the current month | The user chose windows that end on this month | y |
| Opening span | The current local calendar month | Transactions opens on the current month today | y |
| Reset | Leaving Transactions and returning selects the current month again | The month stepper is component state and already resets | y |
| One account list | Oldest `transaction_date` first, id ascending on a tie, with a running balance from the day before the start month | Keeps the current single-account ledger across a longer span | y |
| All accounts list | Newest `transaction_date` first, id descending on a tie, no balance column | Keeps the current all-accounts list | y |
| Empty copy | `No transactions for {label}.` using the period button label | The empty state names the span on screen | y |
| Future months | Allowed. An empty future month shows the empty state | The grids do not block a later month | y |
| Surface | Transactions only | Dashboard and import period fields stay as they are | y |
| Unfinished popover | Escape or a click outside discards the pending start and keeps the applied span | A half-chosen range must not change the list | y |
| Grid years on open | From opens on the applied start year. To opens on the applied end year | The open popover shows the span already in effect | y |
| Button label | en-US short month and year. One month is `Nov 2026`. A longer span is `Dec 2025 – Nov 2026` (space, en dash, space) | The label has to fit the existing toolbar | y |
| Account filter | Changing account keeps the applied span | Account and period are separate filters today | y |
| First click | A click on From or on To, before a start exists, sets the start | Matches "the first click sets the start" | y |
| List length | Every matching row is rendered. There is no page size and no maximum span | No page size was requested | y |
| Year range | Each year stepper has no minimum or maximum year | An old year has to stay reachable | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Choose a month span ⭐ MVP

**User Story**: As a person reviewing my ledger, I want to pick a span of months from one control so that I can open an old period without stepping one month at a time.

**Why P1**: This is the control issue 144 asks for.

**Acceptance Criteria**:

1. WHEN the user opens Transactions THEN the system SHALL select the device's current local calendar month and show the transactions in that month.
2. WHEN the user activates the period control THEN the system SHALL open a popover that offers shortcuts named This month, Last 3 months, This year, and Last 12 months, plus a start-month choice and an end-month choice.
3. WHEN the user chooses This month THEN the system SHALL select the current local calendar month, show the transactions in that month, and close the popover.
4. WHEN the user chooses Last 3 months on 2026-11-02 THEN the system SHALL select September 2026 through November 2026, show the transactions in that span, and close the popover.
5. WHEN the user chooses This year on 2026-11-02 THEN the system SHALL select January 2026 through November 2026, show the transactions in that span, and close the popover.
6. WHEN the user chooses Last 12 months on 2026-11-02 THEN the system SHALL select December 2025 through November 2026, show the transactions in that span, and close the popover.
7. WHEN the user chooses a start month THEN the system SHALL keep the popover open and SHALL keep showing the previously applied span.
8. WHEN the user chooses an end month on or after the start month THEN the system SHALL select the inclusive span from that start month through that end month, show its transactions, and close the popover.
9. IF the user chooses an end month earlier than the start month THEN the system SHALL set that earlier month as the start, keep the popover open, and keep showing the previously applied span.
10. WHEN the user chooses the same month as start and as end THEN the system SHALL select that single month, show its transactions, and close the popover.
11. WHEN the applied span is one month THEN the period control SHALL show the en-US short month and year, for example `Nov 2026`.
12. WHEN the applied span covers more than one month THEN the period control SHALL show the start and end short labels joined by ` – `, for example `Dec 2025 – Nov 2026`.
13. IF the user dismisses the popover before the range is complete THEN the system SHALL keep the previously applied span.
14. WHEN the user steps the year on the start choice or the end choice THEN the system SHALL change only that choice's year, with no minimum year and no maximum year.
15. The Transactions page SHALL NOT show a Previous month button or a Next month button.
16. The popover SHALL apply a shortcut or a completed range without a separate Apply control.

**Independent Test**: Open Transactions, apply Last 12 months, and confirm the button reads `Dec 2025 – Nov 2026` and the popover has closed. Then pick January 2024 through December 2024 from the grids.

---

### P1: Show the span in the ledger ⭐ MVP

**User Story**: As a person reviewing my ledger, I want the rows and the running balance to follow the span I picked so that the table matches that period.

**Why P1**: A span control that does not change the list is not the filter.

**Acceptance Criteria**:

1. The system SHALL include a transaction whose `transaction_date` is on or between the first calendar day of the start month and the last calendar day of the end month, and SHALL exclude a transaction outside that span.
2. IF the end month is February 2024 THEN the system SHALL treat the last day of the span as 2024-02-29.
3. IF the end month is February 2025 THEN the system SHALL treat the last day of the span as 2025-02-28.
4. WHILE one account is selected, the system SHALL list the span by `transaction_date` ascending, breaking ties by id ascending.
5. WHILE one account is selected, the system SHALL show each row's balance as the account balance on the last calendar day before the start month after applying that row and every earlier row in the span, with a credit increasing the balance and a debit decreasing it.
6. WHILE All accounts is selected, the system SHALL list the span by `transaction_date` descending, breaking ties by id descending.
7. WHILE All accounts is selected, the system SHALL omit the balance column.
8. WHEN the span contains no transactions THEN the system SHALL show `No transactions for {label}.`, where `{label}` is the period control text.
9. WHEN the user leaves Transactions and opens it again THEN the system SHALL reset the span to the current local calendar month.
10. WHEN the user changes the account filter THEN the system SHALL keep the applied span.
11. WHEN the user selects a future month that contains no transactions THEN the system SHALL show the empty state for that month.

**Independent Test**: With one account, apply January 2024 through March 2024 and confirm a 2024-01-15 row is present, a 2023-12-31 row is absent, the rows run oldest first, and the first balance includes that first row on top of the 2023-12-31 balance.

---

## Edge Cases

- IF the end month is February 2024 THEN the system SHALL use 2024-02-29 as the last day.
- IF the end month is February 2025 THEN the system SHALL use 2025-02-28 as the last day.
- IF the user chooses an end month earlier than the start THEN the system SHALL treat it as a new start and SHALL NOT change the list.
- IF the user dismisses the popover before the range is complete THEN the system SHALL keep the applied span.
- WHEN the chosen span has no transactions THEN the system SHALL show `No transactions for {label}.`.
- WHEN the user selects a future month with no transactions THEN the system SHALL show that empty state.

---

## Requirement Traceability

| Requirement ID | Story | Task | Status |
| --- | --- | --- | --- |
| PERIOD-01 | P1: Choose a month span | T3 | In Tasks |
| PERIOD-02 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-03 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-04 | P1: Choose a month span | T1 | Verified |
| PERIOD-05 | P1: Choose a month span | T1 | Verified |
| PERIOD-06 | P1: Choose a month span | T1 | Verified |
| PERIOD-07 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-08 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-09 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-10 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-11 | P1: Choose a month span | T1 | Verified |
| PERIOD-12 | P1: Choose a month span | T1 | Verified |
| PERIOD-13 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-14 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-15 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-16 | P1: Choose a month span | T2 | In Tasks |
| PERIOD-17 | P1: Show the span in the ledger | T1 | Verified |
| PERIOD-18 | P1: Show the span in the ledger | T1 | Verified |
| PERIOD-19 | P1: Show the span in the ledger | T1 | Verified |
| PERIOD-20 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-21 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-22 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-23 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-24 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-25 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-26 | P1: Show the span in the ledger | T3 | In Tasks |
| PERIOD-27 | P1: Show the span in the ledger | T3 | In Tasks |

**Coverage:** 27 total, 27 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] From the current month, Last 12 months applies in one action and the button shows the twelve-month label
- [ ] January 2024 through December 2024 can be applied from the month grids by stepping the year and choosing two months
- [ ] A single-account balance column still runs from the day before the span through the last row
- [ ] The previous-month and next-month buttons are gone
