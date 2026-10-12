# Transactions Account Filter Specification

## Problem Statement

The Transactions screen always pins the account filter to one account (the first account when none is chosen). Users cannot clear that filter to review the month across every account. Issue #9 asks for an All-accounts view with a clear path back to a single account.

## Goals

- [ ] User can select All accounts and see that month’s transactions from every active account
- [ ] User can create a transaction from All accounts via an account picker on the create form
- [ ] Single-account view keeps running balance; All-accounts view does not invent a cross-account balance

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Changing a transaction’s account on edit | Edit stays non-account-mutating; deferred if ever needed |
| Multi-account select / exclude lists | Issue asks only for clear → all |
| Persisting the last filter choice across sessions | Not requested; session default is All accounts |
| Filtering inactive/soft-deleted accounts into the list | Active accounts only, same as today |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Default filter on open | All accounts | User choice (Guided discuss) | y |
| Create in All accounts | Required account picker on create form | User choice | y |
| Balance column in All accounts | Hidden | Cross-account running balance is meaningless | y |
| Account column in All accounts | Shown (account name) | Rows must be identifiable | y |
| Create with single-account filter | No picker; target is the filtered account | Matches current form contract | y |
| Edit account | Unchanged; no picker on edit | Update API does not move accounts | y |
| Option label | “All accounts” | Clear and matches issue language | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Clear account filter to All accounts ⭐ MVP

**User Story**: As a user, I want to clear the account filter on Transactions so that I can see every account’s transactions for the selected month.

**Why P1**: This is the whole of issue #9.

**Acceptance Criteria**:

1. WHEN the user opens the Transactions screen and at least one active account exists THEN the system SHALL select the All accounts filter by default
2. WHEN the user selects All accounts THEN the system SHALL list transactions for the selected month across all active accounts, ordered by transaction date descending then by id
3. WHEN the user selects a specific account THEN the system SHALL list only that account’s transactions for the selected month
4. WHILE All accounts is selected the system SHALL show an Account column with each row’s account name
5. WHILE a specific account is selected the system SHALL hide the Account column
6. WHILE All accounts is selected the system SHALL hide the Balance column
7. WHILE a specific account is selected the system SHALL show the Balance column with the per-account running balance
8. IF there are no active accounts THEN the system SHALL show the existing empty guidance to create an account first and SHALL not offer All accounts as a usable filter target

**Independent Test**: Two accounts, one debit each in the current month → open Transactions → both rows visible with account names → pick one account → only that account’s row remains with Balance shown.

---

### P1: Create from All accounts with account picker ⭐ MVP

**User Story**: As a user, I want to create a transaction while viewing All accounts so that I do not have to switch the filter first.

**Why P1**: Without this, All accounts blocks create; discuss chose picker over disabling the button.

**Acceptance Criteria**:

1. WHILE All accounts is selected the system SHALL keep the + New Transaction control enabled
2. WHEN the user opens the create form under All accounts THEN the system SHALL show a required account picker listing active accounts
3. WHEN the user submits the create form under All accounts without choosing an account THEN the system SHALL not create a transaction
4. WHEN the user submits the create form under All accounts with an account selected THEN the system SHALL create the transaction on that account and refresh the All-accounts list so the new row appears
5. WHEN the user opens the create form under a specific account filter THEN the system SHALL not show the account picker and SHALL create on the filtered account
6. WHEN the user opens the edit form THEN the system SHALL not show an account picker and SHALL not change the transaction’s account

**Independent Test**: All accounts → New Transaction → pick account B → create → row appears attributed to B.

---

## Edge Cases

- IF All accounts is selected and the month has no transactions THEN the system SHALL show the existing empty-month message
- WHEN accounts exist but the selected month is empty on every account THEN the system SHALL show the empty-month message (not the “create an account” message)
- WHEN the user switches from a specific account to All accounts (or the reverse) THEN the system SHALL close any open create/edit form for that switch so the form’s account target cannot disagree with the new filter mode

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| TXNF-01 | P1: Clear filter — default All accounts | Execute | Verified |
| TXNF-02 | P1: Clear filter — list all active accounts for month | Execute | Verified |
| TXNF-03 | P1: Clear filter — list single account for month | Execute | Verified |
| TXNF-04 | P1: Clear filter — Account column while All | Execute | Verified |
| TXNF-05 | P1: Clear filter — hide Account column when filtered | Execute | Verified |
| TXNF-06 | P1: Clear filter — hide Balance while All | Execute | Verified |
| TXNF-07 | P1: Clear filter — show Balance when filtered | Execute | Verified |
| TXNF-08 | P1: Clear filter — no accounts empty state | Execute | Verified |
| TXNF-09 | P1: Create — New Transaction enabled on All | Execute | Verified |
| TXNF-10 | P1: Create — required account picker on All | Execute | Verified |
| TXNF-11 | P1: Create — reject submit with no account | Execute | Verified |
| TXNF-12 | P1: Create — create on chosen account and refresh | Execute | Verified |
| TXNF-13 | P1: Create — no picker when single-account filter | Execute | Verified |
| TXNF-14 | P1: Create — edit has no account picker / no account change | Execute | Verified |
| TXNF-15 | Edge — empty month under All accounts | Execute | Verified |
| TXNF-16 | Edge — close open form on filter mode switch | Execute | Verified |

**Coverage:** 16 total, 16 verified (see `validation.md`)

---

## Success Criteria

- [ ] User can clear the account filter and see all accounts’ transactions for the month
- [ ] User can create from All accounts by picking the target account once
- [ ] Single-account running balance behavior is unchanged when a specific account is selected
- [ ] Existing Transactions e2e flows still pass after adjusting for the new default filter
