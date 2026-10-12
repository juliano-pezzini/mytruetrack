# Transactions Account Filter Context

**Gathered:** 2026-10-12
**Spec:** `.specs/features/transactions-account-filter/spec.md`
**Status:** Ready for design

---

## Feature Boundary

On the Transactions screen, the account control can be cleared so the user sees transactions from all active accounts for the selected month. Single-account filtering remains available. Month navigation, edit, and delete stay as they are today.

---

## Implementation Decisions

### Default filter on open

- Transactions opens with **All accounts** selected (not the first account).

### Create while All accounts is selected

- **+ New Transaction** stays enabled.
- The create form shows a **required account picker**.
- When a single account is selected in the filter, create uses that account and does **not** show the picker (current behavior).

### Balance column (All accounts)

- Hide the Balance column while All accounts is selected.
- Running balance remains when a single account is selected.

### Account column (All accounts)

- Show an Account column (account name) while All accounts is selected.
- Hide that column when a single account is selected.

### Edit

- Edit does not change the transaction’s account.
- Account picker is create-only.

### Agent's Discretion

- Exact select option label (e.g. “All accounts”) and column ordering.
- Empty-state copy when All accounts has no rows for the month.
- How soft-deleted accounts are excluded (follow existing active-account listing).

### Declined / Undiscussed Gray Areas → Assumptions

None beyond the settled decisions above. Assumptions are recorded in the spec.

---

## Specific References

- GitHub issue: https://github.com/juliano-pezzini/mytruetrack/issues/9
- Current auto-select of first account lives in `TransactionsPage` (`selectedAccountId ?? accounts[0]`).

---

## Deferred Ideas

None - discussion stayed within feature scope.
