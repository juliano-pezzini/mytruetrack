# Mercado Pago Import Specification

## Problem Statement

Mercado Pago movements never reach mytruetrack unless the user exports a file by hand. InvestPass already imports through a companion extension that holds the browser session, while the PWA only validates and stores rows. This feature does the same for the Mercado Pago account statement (COMPE 323), including a period frontier and a deletable import log.

## Goals

- [ ] An active account marked Mercado Pago can import a chosen period from the dashboard without storing Mercado Pago credentials.
- [ ] Re-imports skip existing `movement_id`s, and deleting an import run removes only the transactions that run inserted.
- [ ] A failed page leaves the database unchanged. A bad row does not.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Credit-card invoice and sales / settlement reports | The issue limits this import to balance-changing account movements. |
| Official PDF / XLSX / CSV statement generator | Asynchronous Relatórios path is a different product. |
| Full COMPE catalog | The form offers Mercado Pago and Outros bancos only. |
| Unattended or background sync | The user starts each import from the dashboard card. |
| Storing Mercado Pago credentials in the PWA or the extension | The existing browser session is the only credential. |
| Auto-categorizing imported rows | File import does not categorize; this import does not either. |
| Replacing the spreadsheet parser | Separate open item; not part of this import. |
| Changing the InvestPass extension id model | The install-time id TODO stays as it is. |

---

## Assumptions & Open Questions

Decisions in GitHub issue 123 are closed. Rows below are the readings this spec uses where the issue did not spell out a literal.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Amount sign and cent composition | Integer cents. A movement that increases the balance is `credit`; one that decreases it is `debit`. The JSON field that carries the sign, and how `fraction` and `cents` combine, is read from a real binnacle response at implementation time. | The issue forbids guessing the sign from a screenshot. The stored outcome is fixed. | y |
| Nested movement list | Import objects that carry `movement_id` inside each day group. Do not import the group `title` or `right_content`. The array property name is taken from the same real response. | The issue says groups are day buckets and only items are transactions. | y |
| "Written immediately" | Hold every page until the walk finishes, then commit valid rows and one log row. There is no preview screen. | A later page failure must leave the database unchanged, so pages cannot commit one by one. | y |
| First suggested range | First calendar day of the current month in `America/Sao_Paulo` through today. The user can edit it. | Later runs already end today, and `period_end` is clamped to today. | y |
| Later runs are editable | The suggested start and end can be changed before every run, including a range older than the frontier. | The issue requires that an older range does not move the frontier backward, which only matters if the user can pick one. | y |
| `period_end` clamp | Store the requested end date, or today in `America/Sao_Paulo` when the requested end is later than today. | Issue text. | y |
| Date query parameters | Send `begin_date` and `end_date` as `YYYY-MM-DD`, plus `client=binnacle` and `page`. | Those are the parameter names in the issue, and stored dates are already `YYYY-MM-DD`. | y |
| Reversed range | If the start date is after the end date, refuse before any request and write nothing. | A reversed range is not a period. | y |
| Empty title or invalid `datetime` | Count the row as an error and do not insert it. | `createTransaction` already rejects an empty description. An unparseable datetime has no calendar day. | y |
| Missing `currency_id` | Same as non-BRL: error count, no insert. | The issue accepts only BRL. | y |
| Second active 323 message | The save is rejected and the form shows "An active Mercado Pago account already exists." | The issue requires an error and no save. | y |
| Institution labels | The choices are labeled "Mercado Pago" and "Outros bancos". | Issue text, including the Portuguese second label. | y |
| Action name | Accessible name "Import from Mercado Pago". Any icon is a local SVG. No request to a Mercado Pago image host. | The issue requires a local mark, with the accessible name as the fallback. | y |
| Sign-in wait copy | The modal shows "Sign in to Mercado Pago" and a Cancel control. It does not close itself on a timer. | The issue requires a wait until authenticated or cancel, and no 30-second timeout. | y |
| Authenticated list | A response is authenticated when it is JSON with numeric `total` and `pages` and an array `groups`. Anything else on the first request is a missing session. | Distinguishes the login wait from a failed page. | y |
| Page failure | After the first authenticated response, a non-OK HTTP status, a non-list body, or a thrown request on any page discards the attempt. | Issue: any failed page writes nothing. | y |
| Zero pages | `pages` of 0 is a finished import with zero inserted rows and still writes a log row. | A finished import that inserts nothing still writes a log row. | y |
| Snapshot on delete | After deleting a log row, recompute and store the current month's `account_balances` row for that account so today's balance matches `initial_balance` plus remaining credits minus remaining debits when no earlier snapshot applies, and matches the balance formula when one does. Import itself does not add a snapshot write that file import lacks. | The issue requires the refresh on delete. File import does not write snapshots today. | y |
| Fetch transport | The extension may call binnacle from the service worker or from an open `www.mercadopago.com.br` tab. | The issue says the product contract does not change if the worker cannot send the cookie. | y |
| Dashboard membership | The dashboard already lists active accounts only. The new action is shown only when `bank_code` is `323`. | `getAll` defaults to `is_active = 1`. | y |
| Rows this import did not insert | Deleting Mercado Pago log rows does not delete transactions whose import-run id is empty. | The issue removes transactions Mercado Pago inserted, not manual or file-import rows. | y |
| Import log table name | Shared table `account_import_logs` with a `source` discriminator (`mercado_pago` for this feature). Period frontier and list queries are scoped by `(account_id, source)`. | Keeps the log reusable for other statement imports without mixing frontiers. | y |
| Extension id | The PWA keeps the current install-time extension id. | Existing InvestPass TODO, restated by the issue. | y |
| Single user, two devices | No merge UI. A second device that imports the same movement skips it by `external_id`. Log deletes propagate because transactions are hard-deleted and the log table is a CRDT. | Existing sync rules. | y |
| Observability beyond the log | No metrics or remote logging. | No backend. The modal counts are the record. | y |

**Open questions:** none — all resolved or logged above.

### Implicit-requirement dimensions

| Dimension | Resolution |
| --- | --- |
| Input validation and bounds | MPAG-04, MPAG-23, MPAG-25, MPAG-26, MPAG-37. Only `323` or empty is writable from the form. |
| Failure and partial failure | MPAG-16, MPAG-28, MPAG-31. |
| Idempotency and duplicates | MPAG-27, MPAG-40. |
| Auth boundaries | MPAG-14, MPAG-17. No rate-limit handling beyond failing the page. |
| Concurrency and ordering | N/A as a new protocol because this device is single-user. Pages are ordered 1..`pages`. Cross-device overlap is the assumption "Single user, two devices". |
| Data lifecycle | MPAG-10, MPAG-44, MPAG-48, MPAG-50. |
| Observability | N/A beyond MPAG-43. See the assumption above. |
| External-dependency failure | MPAG-14, MPAG-28. |
| State-transition integrity | MPAG-10, MPAG-11, MPAG-32, MPAG-33, MPAG-35, MPAG-38, MPAG-39. |

---

## User Stories

### P1: Mark an account as Mercado Pago ⭐ MVP

**User Story**: As a user, I want to mark one active account as Mercado Pago so that the dashboard knows where this import belongs.

**Why P1**: Nothing else on the card can appear until `bank_code` exists and the one-active-323 rule holds.

**Acceptance Criteria**:

1. WHEN the user chooses "Mercado Pago" and saves the account THEN the system SHALL store `bank_code` `323`.
2. WHEN the user chooses "Outros bancos" and saves the account THEN the system SHALL store `bank_code` as empty.
3. The system SHALL keep account type (`bank`, `credit_card`, `wallet`, `transitional`) independent of `bank_code`.
4. IF a save would leave two active accounts with `bank_code` `323` THEN the system SHALL reject the save and show "An active Mercado Pago account already exists."
5. WHILE an account with `bank_code` `323` is inactive the system SHALL NOT count it toward that limit.
6. The account form SHALL offer only "Mercado Pago" and "Outros bancos" as institution choices.

**Independent Test**: Create two accounts, set the first to Mercado Pago, and confirm the second active save with Mercado Pago is rejected. Deactivate the first and confirm the second save then succeeds.

---

### P1: See the Mercado Pago action on the right card ⭐ MVP

**User Story**: As a user, I want the Mercado Pago action only on the active Mercado Pago card so that I still import files everywhere else.

**Why P1**: The import starts from this card, and the file import must remain.

**Acceptance Criteria**:

1. WHILE an active account has `bank_code` `323` the dashboard card SHALL show the existing file import and an action named "Import from Mercado Pago".
2. WHILE an active account has an empty `bank_code` the dashboard card SHALL show the file import and SHALL NOT show "Import from Mercado Pago".
3. The "Import from Mercado Pago" action SHALL NOT load an image from a Mercado Pago host.
4. WHEN the user changes that account from Mercado Pago to Outros bancos THEN the system SHALL hide the action and keep that account's transactions and import-log rows.
5. WHEN the user changes that account back to Mercado Pago THEN the system SHALL show the action and the existing import-log rows again.

**Independent Test**: Toggle the institution on one account and confirm the action and the log appear and disappear together, while a second account never shows the action.

---

### P1: Import a statement period ⭐ MVP

**User Story**: As a user, I want the extension to read my Mercado Pago session and store the movements so that I do not type them or export a spreadsheet.

**Why P1**: This is the import itself.

**Acceptance Criteria**:

1. WHEN the user confirms a period THEN the extension SHALL request `GET /activities/api/list/binnacle` for every page from 1 through `pages`, with the existing Mercado Pago cookie, `client=binnacle`, `begin_date`, and `end_date`.
2. IF the first response is not an authenticated list THEN the extension SHALL open `https://www.mercadopago.com.br/` and the modal SHALL show "Sign in to Mercado Pago" until an authenticated list arrives or the user cancels.
3. WHILE the modal is waiting for sign-in the system SHALL NOT apply a 30-second timeout.
4. IF the user cancels during that wait THEN the system SHALL write no transaction and no import-log row.
5. The extension and the PWA SHALL NOT persist a Mercado Pago password, cookie, or API token.
6. WHEN every page has been fetched THEN the system SHALL insert movement items only, and SHALL NOT insert day-balance group headers.
7. WHEN a movement is inserted THEN the system SHALL store `movement_id` as `external_id`, `title` as `description`, the `America/Sao_Paulo` calendar day of `datetime` as `transaction_date`, an empty category, and an empty `settled_date`.
8. WHEN a movement is inserted THEN the system SHALL store a positive integer cent amount.
9. WHEN a movement increases the account balance THEN the system SHALL store type `credit`.
10. WHEN a movement decreases the account balance THEN the system SHALL store type `debit`.
11. IF `currency_id` is missing or is not `BRL` THEN the system SHALL count that row as an error and insert no transaction for it.
12. IF the amount is not positive THEN the system SHALL count that row as an error and insert no transaction for it.
13. IF `title` is empty or `datetime` is not a valid ISO datetime THEN the system SHALL count that row as an error and insert no transaction for it.
14. WHEN `movement_id` is already stored for the same account THEN the system SHALL skip the row and leave the existing transaction linked to the run that first inserted it.
15. IF any page fails after the first authenticated response THEN the system SHALL leave transactions and the import log unchanged.
16. WHEN every page succeeds THEN the system SHALL commit the valid rows and one log row without a row preview.
17. WHILE an attempt has row-level errors and every page succeeded the system SHALL commit the valid rows.
18. WHEN a finished attempt inserts zero transactions THEN the system SHALL still write one import-log row.
19. The importer SHALL NOT drop a movement because of `metadata.kind`.

**Independent Test**: Feed a two-page fixture that includes one BRL credit, one BRL debit, one non-BRL row, one existing `movement_id`, and a day header. Confirm the counts, then fail page 2 on a second attempt and confirm the database is unchanged.

---

### P1: Suggest the next period ⭐ MVP

**User Story**: As a user, I want the next import to start where the last one ended so that I do not retype the range, and so that an older import does not drag that start backward.

**Why P1**: The frontier is what makes repeated imports usable.

**Acceptance Criteria**:

1. WHEN the account has no import-log rows with `source` `mercado_pago` THEN the modal SHALL suggest the first day of the current `America/Sao_Paulo` month through today.
2. WHEN the account has import-log rows with `source` `mercado_pago` THEN the modal SHALL suggest a start equal to the greatest stored `period_end` among those rows (inclusive) and an end equal to today in `America/Sao_Paulo`.
3. WHEN the user edits those dates and confirms THEN the system SHALL import the edited range.
4. WHEN a finished run's requested end is after today in `America/Sao_Paulo` THEN the system SHALL store `period_end` as today.
5. WHEN a finished run's requested end is on or before today THEN the system SHALL store that date as `period_end`.
6. IF the start date is after the end date THEN the system SHALL refuse the import and write nothing.
7. WHEN a finished run's `period_end` is earlier than the greatest `period_end` already stored for that account and `source` `mercado_pago` THEN the next suggestion SHALL still start at that greatest `period_end`.
8. WHEN the log row with the greatest `period_end` for that account and `source` `mercado_pago` is deleted THEN the next suggestion SHALL start at the greatest `period_end` still stored for that pair.
9. WHEN the account has no import-log rows left with `source` `mercado_pago` THEN the next suggestion SHALL again be the current `America/Sao_Paulo` month through today.
10. WHEN a previously imported movement was deleted, so its `external_id` is gone, THEN a later import SHALL insert that `movement_id` again.

**Independent Test**: Import January, then an older December, and confirm the next suggestion still starts on the January `period_end`. Delete the January row and confirm the suggestion falls back to December, then to the current month after the last row is gone.

---

### P1: Review and delete an import run ⭐ MVP

**User Story**: As a user, I want each finished import listed, and I want to delete one run, so that I can undo what that run inserted without touching the rest of the account.

**Why P1**: The log is the only record of what was imported, and delete is the undo.

**Acceptance Criteria**:

1. The system SHALL store one `account_import_logs` row per finished import with the account id, `source` `mercado_pago`, period start, period end, timestamp, imported count, skipped count, and error count.
2. WHEN the import inserts a transaction THEN the system SHALL store that log row's id on the transaction.
3. The modal SHALL list each log row for the account with `source` `mercado_pago` with its period, timestamp, imported count, skipped count, and error count.
4. WHEN the user asks to delete a log row THEN the system SHALL ask for a normal confirmation and SHALL NOT require the typed word DELETE.
5. IF the user dismisses that confirmation THEN the system SHALL leave the log row and its transactions in place.
6. WHEN the user confirms deletion of a log row THEN the system SHALL hard-delete every transaction linked to that row, including transactions the user later edited or categorized.
7. WHEN those transactions are deleted THEN the system SHALL recompute the current month's balance snapshot for that account from the transactions that remain.
8. WHEN a log row is deleted THEN the system SHALL keep transactions whose import-run id belongs to a different log row.
9. WHEN a log row is deleted THEN the system SHALL keep transactions whose import-run id is empty.
10. WHEN every import-log row for the account with `source` `mercado_pago` is deleted THEN the system SHALL leave no transaction that a Mercado Pago import inserted on that account.
11. The system SHALL give every new non-primary-key column a SQL default and SHALL register `account_import_logs` for cr-sqlite sync.
12. WHEN an import commits or a log row is deleted THEN the system SHALL notify the existing auto-sync path.

**Independent Test**: Import two runs where the second skips ids inserted by the first. Delete the second run and confirm the first run's transactions remain. Delete the first run and confirm those transactions are gone while a manually created transaction remains.

---

### P1: One extension for InvestPass and Mercado Pago ⭐ MVP

**User Story**: As a user, I want one companion extension so that InvestPass keeps working and Mercado Pago can use the same connection.

**Why P1**: The PWA cannot call Mercado Pago with the user's cookie by itself.

**Acceptance Criteria**:

1. The companion extension SHALL be named "mytruetrack Import".
2. The extension SHALL hold host permission for `https://www.mercadopago.com.br/*` and SHALL keep host permission for `https://pass-api.invest-pass.com/*`.
3. WHEN the PWA sends the existing InvestPass bridge message THEN the extension SHALL still complete that import.
4. WHEN the PWA sends the Mercado Pago import message THEN the extension SHALL answer with the fetched movements or with a session-missing signal.
5. The PWA SHALL connect with `chrome.runtime.connect` using the existing install-time extension id.

**Independent Test**: With the renamed extension loaded, run the existing InvestPass bridge test and a Mercado Pago fetch against a fixture, and confirm both messages still resolve.

---

## Edge Cases

- IF the start date is after the end date THEN the system SHALL refuse the import and write nothing.
- IF any page fails after the first authenticated response THEN the system SHALL leave transactions and the import log unchanged.
- IF `currency_id` is missing or is not `BRL` THEN the system SHALL count that row as an error and insert no transaction for it.
- WHEN a finished attempt inserts zero transactions THEN the system SHALL still write one import-log row.
- WHEN the user cancels during the sign-in wait THEN the system SHALL write no transaction and no import-log row.
- WHILE an account with `bank_code` `323` is inactive the system SHALL NOT count it toward the one-active limit.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MPAG-01 | P1: Mark an account as Mercado Pago | Design | Pending |
| MPAG-02 | P1: Mark an account as Mercado Pago | Design | Pending |
| MPAG-03 | P1: Mark an account as Mercado Pago | Design | Pending |
| MPAG-04 | P1: Mark an account as Mercado Pago | Design | Pending |
| MPAG-05 | P1: Mark an account as Mercado Pago | Design | Pending |
| MPAG-06 | P1: Mark an account as Mercado Pago | Design | Pending |
| MPAG-07 | P1: See the Mercado Pago action on the right card | Design | Pending |
| MPAG-08 | P1: See the Mercado Pago action on the right card | Design | Pending |
| MPAG-09 | P1: See the Mercado Pago action on the right card | Design | Pending |
| MPAG-10 | P1: See the Mercado Pago action on the right card | Design | Pending |
| MPAG-11 | P1: See the Mercado Pago action on the right card | Design | Pending |
| MPAG-12 | P1: Import a statement period | Design | Pending |
| MPAG-13 | P1: Import a statement period | Design | Pending |
| MPAG-14 | P1: Import a statement period | Design | Pending |
| MPAG-15 | P1: Import a statement period | Design | Pending |
| MPAG-16 | P1: Import a statement period | Design | Pending |
| MPAG-17 | P1: Import a statement period | Design | Pending |
| MPAG-18 | P1: Import a statement period | Design | Pending |
| MPAG-19 | P1: Import a statement period | Design | Pending |
| MPAG-20 | P1: Import a statement period | Design | Pending |
| MPAG-21 | P1: Import a statement period | Design | Pending |
| MPAG-22 | P1: Import a statement period | Design | Pending |
| MPAG-23 | P1: Import a statement period | Design | Pending |
| MPAG-24 | P1: Import a statement period | Design | Pending |
| MPAG-25 | P1: Import a statement period | Design | Pending |
| MPAG-26 | P1: Import a statement period | Design | Pending |
| MPAG-27 | P1: Import a statement period | Design | Pending |
| MPAG-28 | P1: Import a statement period | Design | Pending |
| MPAG-29 | P1: Import a statement period | Design | Pending |
| MPAG-30 | P1: Import a statement period | Design | Pending |
| MPAG-31 | P1: Suggest the next period | Design | Pending |
| MPAG-32 | P1: Suggest the next period | Design | Pending |
| MPAG-33 | P1: Suggest the next period | Design | Pending |
| MPAG-34 | P1: Suggest the next period | Design | Pending |
| MPAG-35 | P1: Suggest the next period | Design | Pending |
| MPAG-36 | P1: Suggest the next period | Design | Pending |
| MPAG-37 | P1: Suggest the next period | Design | Pending |
| MPAG-38 | P1: Suggest the next period | Design | Pending |
| MPAG-39 | P1: Suggest the next period | Design | Pending |
| MPAG-40 | P1: Suggest the next period | Design | Pending |
| MPAG-41 | P1: Review and delete an import run | Design | Pending |
| MPAG-42 | P1: Review and delete an import run | Design | Pending |
| MPAG-43 | P1: Review and delete an import run | Design | Pending |
| MPAG-44 | P1: Review and delete an import run | Design | Pending |
| MPAG-45 | P1: Review and delete an import run | Design | Pending |
| MPAG-46 | P1: Review and delete an import run | Design | Pending |
| MPAG-47 | P1: Review and delete an import run | Design | Pending |
| MPAG-48 | P1: Review and delete an import run | Design | Pending |
| MPAG-49 | P1: Review and delete an import run | Design | Pending |
| MPAG-50 | P1: Review and delete an import run | Design | Pending |
| MPAG-51 | P1: Review and delete an import run | Design | Pending |
| MPAG-52 | P1: Review and delete an import run | Design | Pending |
| MPAG-53 | P1: One extension for InvestPass and Mercado Pago | Design | Pending |
| MPAG-54 | P1: One extension for InvestPass and Mercado Pago | Design | Pending |
| MPAG-55 | P1: One extension for InvestPass and Mercado Pago | Design | Pending |
| MPAG-56 | P1: One extension for InvestPass and Mercado Pago | Design | Pending |
| MPAG-57 | P1: One extension for InvestPass and Mercado Pago | Design | Pending |

**Coverage:** 57 total, 0 mapped to tasks, 57 unmapped.

---

## Success Criteria

- [ ] A second active account cannot be saved with `bank_code` `323`.
- [ ] A card without `323` shows file import only. A card with `323` shows file import and "Import from Mercado Pago".
- [ ] Re-importing a boundary day skips existing `movement_id`s and still stores the run's `period_end`.
- [ ] A failed page leaves transactions and the import log unchanged.
- [ ] A non-BRL row increments the error count and is absent from `transactions`.
- [ ] Deleting a log row removes only its inserted transactions. A later run's skipped duplicates stay on the earlier row.
- [ ] Deleting the latest row makes the next suggestion use the previous `period_end`.
- [ ] Changing the institution to empty hides the action and keeps the data.
- [ ] The InvestPass bridge message still completes after the extension is renamed.
