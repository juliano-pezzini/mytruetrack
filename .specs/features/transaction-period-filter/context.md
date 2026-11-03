# Transaction Period Filter Context

**Gathered:** 2026-11-02
**Spec:** `.specs/features/transaction-period-filter/spec.md`
**Status:** Ready for design

---

## Feature Boundary

On Transactions, replace the one-month stepper with a span of whole calendar months. The user can show the current month, a recent multi-month window, or any older month range, including one a year or more back. Issue 144.

---

## Implementation Decisions

### Range popover

- One period button in the toolbar, in the place of the `‹ month ›` stepper.
- The button opens a popover. There is no Apply control.
- The popover has four shortcuts, then two month grids labeled From and To. Each grid shows Jan–Dec for one year and has its own year stepper. The steppers have no minimum or maximum year.
- From opens on the applied start year. To opens on the applied end year.
- Visible month cells use the en-US short name (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec).
- The first click on either grid sets the start month. The popover stays open. The list stays on the last applied span.
- A later click on From replaces the start and waits.
- A later click on To on or after the start applies that inclusive span and closes the popover.
- A later click on To before the start becomes the new start. The popover stays open. The list does not change.
- Choosing the same month as start and end selects that month alone.
- Escape or a click outside discards the pending start and keeps the applied span.
- The closed button reads `Nov 2026` for one month and `Nov 2025 – Oct 2026` for a longer span (en-US short month, space, en dash, space).
- The previous-month and next-month buttons are removed.

### Shortcuts

Shortcuts apply immediately and close the popover. They end on the current local calendar month. On 2026-11-02:

- **This month:** Nov 2026
- **Last 3 months:** Sep 2026 – Nov 2026
- **This year:** Jan 2026 – Nov 2026
- **Last 12 months:** Dec 2025 – Nov 2026

This year is January of the current calendar year through the current month.

### List

- The span is inclusive: the first day of the start month through the last day of the end month. February uses the real last day, including 29 Feb in a leap year.
- Opening Transactions selects the current month. Leaving the page and coming back resets to the current month.
- Changing the account filter keeps the span.
- One account: oldest `transaction_date` first, id ascending on a tie. The balance column starts from the account balance on the last day before the start month and applies each row in that order.
- All accounts: newest `transaction_date` first, id descending on a tie. No balance column.
- Empty span: `No transactions for {label}.` where `{label}` is the period button text.
- A future month can be selected. The list is empty when it has no transactions.
- The table renders every row in the span. There is no page size.

### Agent's Discretion

- Hover preview of the months between the start and the month under the pointer.
- Stack the two grids vertically when the popover would overflow the viewport.
- Match the existing toolbar styling (surface, border, radius, type size).
- Return focus to the period button when the popover closes.

### Declined / Undiscussed Gray Areas → Assumptions

Recorded in the spec Assumptions table:

- Month grain, not exact days.
- Dismissing an unfinished popover keeps the applied span.
- Grids open on the applied span's years.
- Short-month button label with an en dash.
- The account filter does not clear the span.
- Either grid can take the first click.
- No paging and no maximum span.
- Year steppers are unbounded.

---

## Specific References

- GitHub issue 144: reaching a period a year back with the month stepper takes too many clicks.
- The user chose the range popover (presets plus two month grids) over always-visible From/To fields, a length-plus-shift control, and toolbar chips.
- Shortcut windows end on this month.
- Examples above are anchored to 2026-11-02.

---

## Deferred Ideas

- A period control on the Dashboard. The Dashboard stays on the current month.
- Changing the InvestPass or Mercado Pago import period fields.
- Remembering the span after the user leaves Transactions.
- Paging or summarizing a long span.
- A day-level range.
