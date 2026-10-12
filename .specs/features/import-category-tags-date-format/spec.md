# Import Category, Tags, and Date Format Specification

## Problem Statement

CSV and XLSX import can map a date, a description, and an amount, and it can choose a number format. It cannot map a category or tags, so those fields stay empty on every imported transaction. The date parser also guesses: ISO when it sees one, otherwise day-first when a value such as `01/02/2026` could be either order. Issues [#116](https://github.com/juliano-pezzini/mytruetrack/issues/116) and [#117](https://github.com/juliano-pezzini/mytruetrack/issues/117).

## Goals

- [ ] A mapped Category column and Tags column are stored on each imported transaction, creating a category or tag only when no existing name matches.
- [ ] The user can select a date format, and an ambiguous date follows that selection.

## Out of Scope

| Feature | Reason |
| --- | --- |
| OFX import | OFX has no column mapper. |
| InvestPass import | InvestPass rows already carry their own fields and do not use this mapper. |
| One category or tag set applied to every row | The user chose columns in the file. |
| Editing category or tags on a single preview row | The preview stays a check of the parse. |
| Auto-categorization rule changes | Rules stay as they are. This import does not run them. |
| Excel serial numbers stored as text | Real Excel date cells are already ISO before mapping. A text serial such as `46036` is not a date format in this feature. |
| Replacing the spreadsheet parser | Called out as separate work in the project rules. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Category and tags are optional file columns | Unmapped means the field is empty | User decision. Same picker pattern as Date and Description | y |
| Match, then create | Create a category or tag only when the name key matches nothing | User decision | y |
| New category type | Type comes from the first imported row that uses that name: debit → `expense`, credit → `revenue` | User decision. A skipped row is not imported, so it cannot supply the type | y |
| Later rows reuse that category | The same name key in one import links to the category already created, even when a later row has the other direction | User decision | y |
| Tag color | `suggestTagColor` over colors already stored plus tags created earlier in this import | Tags created in the app already use this helper | y |
| Several tags in one cell | Split on comma and semicolon, trim, drop empties, attach each name once | Stated during discussion and left in place | y |
| Name key | Trim, collapse each whitespace run to one space, then compare case-insensitively. A single space inside the name still counts. Accents and punctuation stay significant | "Ignoring spaces" was confirmed as extra space, not deleting every space. `Super Market` does not match `SuperMarket`. `Café` does not match `Cafe` | n |
| Stored name | Trim and collapse whitespace, and keep the casing of the first imported cell for that name | The key is for matching. The stored label should stay readable | n |
| One existing category | Use it even when its type differs from the row. Do not create a second category | "Match first" wins over the type guess. The type guess applies only when creating | n |
| Several existing categories with the same key | Prefer the type that fits the row (`credit` → `revenue`, `debit` → `expense`). Among that set, pick the lexicographically smallest stored name, then the smallest id. If none have the fitting type, pick from all matches with the same ordering | Needs one deterministic row when duplicates already exist | n |
| Several existing tags with the same key | Smallest stored name, then smallest id. Do not create | Same deterministic rule, without a type | n |
| Header keywords | Category: `category`, `categoria`, `classificação`, `classificacao`. Tags: `tag`, `tags`, `etiqueta`, `etiquetas`. Leftmost header that contains a keyword wins. Substring match, case-insensitive | Same header style as the existing bilingual detector | n |
| Overlapping auto-map | Date, description, and amount detection stay as they are today. The user can change a picker when a positional fallback lands on the category or tags column | No new conflict resolver was requested | n |
| Date formats | `DD/MM/YYYY` (default), `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MMM/YYYY`, `MMM/DD/YYYY` | User decision, including three-letter months | y |
| Three-letter months | English and Portuguese, exactly three letters, case-insensitive. See the month table in the date story | Both languages already appear in statement headers. No token maps to two different months | y |
| ISO always accepted | A cell whose first 10 characters are `YYYY-MM-DD` parses as that date under every selected format | Excel date cells are already normalized to ISO before mapping | y |
| Bad date | That row is skipped with a warning. Other rows import | Stated during discussion | y |
| Calendar check | Month must be 1–12 and day must be 1–31. `31/02/2026` is accepted under day-first | The current parser does not check the calendar. This feature does not add that | n |
| Two-digit years | Rejected | The current parser requires a four-digit year | n |
| Trailing time | `15/01/2026 10:30` is invalid under a numeric or month-name format. `2026-01-15T13:00:00` is valid under every format because of the ISO prefix rule | Keeps the current ISO prefix behavior and refuses extra text on the other formats | n |
| Sample vote tie | Among formats tied for the most votes, pick the first of: `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MMM/YYYY`, `MMM/DD/YYYY`. Zero votes selects `DD/MM/YYYY` | An ambiguous file stays day-first, which is the default already confirmed | n |
| Saved mappings | Store the date format and both column indexes. A record missing them loads as `DD/MM/YYYY` with both columns unmapped | Stated during discussion | y |
| Auto-categorization | This import does not run rules. An empty category cell stays empty | Rules were left unchanged. Import does not call them today | n |
| Created category shape | `parentId` null and `description` null | The file does not carry a parent or a description | n |
| Preview | Shows the category name, the tag names, and `expense` or `revenue` when that category will be created. Existing five-row preview cap stays | The user needs to see the new fields before importing | n |
| Second import of rows without `externalId` | Transactions insert again, which is current behavior. Categories and tags do not duplicate | Dedup of transactions without an external id is existing behavior and is not this feature | y |
| Auth, concurrency, external calls, new logs | N/A | One local user, one import at a time, no network, and the preview warnings are the signal | y |
| Clear-all / full reset | N/A | Categories and tags created here use the existing delete paths | y |

**Open questions:** none. All resolved or logged above.

---

## Definitions

**Name key.** Trim the text. Collapse each run of whitespace to one space. Compare with Unicode case fold. Accents and punctuation are part of the key.

**Imported row.** A data row that becomes a transaction: the date matches the selected format, the amount parses under the current amount rules, and the row is not skipped as a duplicate `externalId`.

**Direction.** The transaction type this import already derives. `debit` is a negative single amount, the debit column, or a debit type cell. `credit` is the opposite. `debit` guesses category type `expense`. `credit` guesses `revenue`.

**Month tokens.** Case-insensitive, exactly three letters.

| Token | Month |
| --- | --- |
| jan | 01 |
| feb, fev | 02 |
| mar | 03 |
| apr, abr | 04 |
| may, mai | 05 |
| jun | 06 |
| jul | 07 |
| aug, ago | 08 |
| sep, set | 09 |
| oct, out | 10 |
| nov | 11 |
| dec, dez | 12 |

**Date sample vote.** Each non-empty cell in the date column casts at most one vote:

1. If the cell matches `YYYY-MM-DD` as its first ten characters, vote `YYYY-MM-DD`.
2. Otherwise, if one part is a month token and it is the first part, vote `MMM/DD/YYYY`. If the month token is the second part, vote `DD/MMM/YYYY`.
3. Otherwise, if the cell is a numeric date with a four-digit year: vote `DD/MM/YYYY` when the first number is greater than 12 and the second is 1–12; vote `MM/DD/YYYY` when the second number is greater than 12 and the first is 1–12; cast no vote when both numbers are 1–12 or both are greater than 12.

The selected default is the format with the most votes. Ties use the order in the assumptions table. No votes selects `DD/MM/YYYY`.

---

## User Stories

### P1: Category and tags columns ⭐ MVP

**User Story**: As a person importing a CSV or XLSX statement, I want to map category and tags columns so that each imported transaction keeps the classification from the file.

**Why P1**: Issue #116. Without this, import always stores an empty category and no tags.

**Acceptance Criteria**:

1. WHEN the column mapper is shown for a grid whose headers match neither a category keyword nor a tags keyword THEN the system SHALL show a Category picker and a Tags picker, both unmapped.
2. WHEN the headers include `Categoria` THEN the system SHALL pre-select that column as Category.
3. WHEN the headers include `Etiquetas` THEN the system SHALL pre-select that column as Tags.
4. WHEN Category and Tags are unmapped and the date, description, and amount columns required by the selected amount strategy are mapped THEN the system SHALL allow the import to run.
5. WHEN a mapped category cell is empty or only whitespace THEN the system SHALL store that transaction with no category.
6. WHEN a mapped tags cell is empty or only whitespace THEN the system SHALL store that transaction with no tags.
7. The system SHALL match category and tag names by the name key. `  Super   Market ` matches a category named `Super Market` and does not create another. `Super Market` does not match `SuperMarket`. `Café` does not match `Cafe`.
8. WHEN no category matches and the first imported cell for that key is `  Super   Market ` THEN the system SHALL create the category with stored name `Super Market`.
9. WHEN no category matches and the first imported row for that key is a debit THEN the system SHALL create the category with type `expense`.
10. WHEN no category matches and the first imported row for that key is a credit THEN the system SHALL create the category with type `revenue`.
11. WHEN a later imported row uses a category key created earlier in the same import THEN the system SHALL link that row to the existing new category, including when the later row has the other direction.
12. WHEN exactly one existing category matches the name key THEN the system SHALL link it, including when its type differs from the row, and SHALL NOT create a category.
13. WHEN an existing `revenue` category and an existing `expense` category share the name key THEN the system SHALL link a credit row to the `revenue` category and a debit row to the `expense` category.
14. WHEN several existing categories of the fitting type share the name key THEN the system SHALL link the one with the lexicographically smallest stored name, then the smallest id.
15. WHEN several existing categories share the name key and none has the fitting type THEN the system SHALL link the one with the lexicographically smallest stored name, then the smallest id, and SHALL NOT create a category.
16. WHEN the tags cell is `food, travel; work` THEN the system SHALL attach the tags `food`, `travel`, and `work`.
17. WHEN the tags cell is `food, food,, travel` THEN the system SHALL attach `food` and `travel` once each.
18. WHEN the tags cell is ` , ; ` THEN the system SHALL attach no tags.
19. WHEN no tag matches the name key and no tags exist yet THEN the system SHALL create the tag with color `#E11D48`.
20. WHEN a second new tag is created in the same import and `#E11D48` is already used THEN the system SHALL give that tag color `#0EA5E9`.
21. WHEN a tag named `Food` exists and the cell contains `  food ` THEN the system SHALL link `Food` and SHALL NOT create a tag.
22. WHEN the preview lists a transaction THEN the system SHALL show its category name and its tag names, and SHALL show `expense` or `revenue` for a category that this import will create.
23. WHEN the import commits a transaction THEN the system SHALL store that category id on the transaction and SHALL store one `transaction_tags` link per attached tag.
24. WHEN a row is skipped because its date or amount is invalid THEN the system SHALL NOT create a category or tag from that row. The next imported row for that name key is the first row for type and stored name.
25. WHEN a row is skipped because its `externalId` is already stored on that account THEN the system SHALL NOT create a category or tag from that row.
26. IF resolving a category or tag throws for a row THEN the system SHALL record an error for that row index and SHALL continue with the remaining rows.
27. The system SHALL NOT apply auto-categorization rules during this import. A description that would match a rule stays uncategorized when the category cell is empty.
28. WHEN the system creates a category THEN the system SHALL store `parentId` null and `description` null.
29. WHEN a second import contains a category name key created by the first import THEN the system SHALL link the existing category and SHALL NOT insert another category with that key.

**Independent Test**: Import a CSV with columns Date, Description, Amount, Categoria, and Etiquetas. A new debit category is stored as `expense`, its tags are linked, and a second import reuses that category.

---

### P1: Date format selection

**User Story**: As a person importing a CSV or XLSX statement, I want to choose the date format so that an ambiguous date is read in the order I selected.

**Why P1**: Issue #117. The current guess treats every ambiguous numeric date as day-first, and it has no three-letter month choice.

**Acceptance Criteria**:

1. WHEN the column mapper is shown THEN the system SHALL offer date formats `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MMM/YYYY`, and `MMM/DD/YYYY`.
2. WHEN every non-empty date sample is ambiguous, as with `01/02/2026`, THEN the system SHALL pre-select `DD/MM/YYYY`.
3. WHEN a date sample is `15/01/2026` THEN the system SHALL pre-select `DD/MM/YYYY`.
4. WHEN a date sample is `01/15/2026` THEN the system SHALL pre-select `MM/DD/YYYY`.
5. WHEN a date sample is `2026-01-15` THEN the system SHALL pre-select `YYYY-MM-DD`.
6. WHEN a date sample is `15/fev/2026` or `15-Jan-2026` THEN the system SHALL pre-select `DD/MMM/YYYY`.
7. WHEN a date sample is `Jan/15/2026` or `Jan 15, 2026` THEN the system SHALL pre-select `MMM/DD/YYYY`.
8. WHEN the only voting sample is `01/15/2026` and the other samples are `01/02/2026` THEN the system SHALL pre-select `MM/DD/YYYY`.
9. WHEN two formats tie for the most votes THEN the system SHALL pre-select the earliest of `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MMM/YYYY`, `MMM/DD/YYYY` among the tied formats.
10. WHEN the selected format is `DD/MM/YYYY` and the cell is `15/01/2026` THEN the system SHALL parse the date as `2026-01-15`.
11. WHEN the selected format is `DD/MM/YYYY` and the cell is `01/15/2026` THEN the system SHALL skip that row and the warning message SHALL be `invalid date: "01/15/2026"`.
12. WHEN the selected format is `MM/DD/YYYY` and the cell is `01/15/2026` THEN the system SHALL parse the date as `2026-01-15`.
13. WHEN the selected format is `YYYY-MM-DD` and the cell is `2026-01-15` THEN the system SHALL parse the date as `2026-01-15`.
14. WHEN the selected format is not `YYYY-MM-DD` and the cell is `2026-01-15` THEN the system SHALL parse the date as `2026-01-15`.
15. WHEN the selected format is `DD/MMM/YYYY` and the cell is `15/fev/2026` THEN the system SHALL parse the date as `2026-02-15`.
16. WHEN the selected format is `DD/MMM/YYYY` and the cell is `15/FEV/2026` THEN the system SHALL parse the date as `2026-02-15`.
17. WHEN the selected format is `MMM/DD/YYYY` and the cell is `Jan 15, 2026` THEN the system SHALL parse the date as `2026-01-15`.
18. The system SHALL map month tokens as listed in the month table, case-insensitive.
19. WHEN the selected format is `DD/MMM/YYYY` and the cell is `15/Xxx/2026` THEN the system SHALL skip that row and the warning message SHALL be `invalid date: "15/Xxx/2026"`.
20. WHEN the selected format is `DD/MM/YYYY` and the cell is `15.01.2026` or `15-01-2026` THEN the system SHALL parse the date as `2026-01-15`.
21. WHEN one row has an invalid date and another row has a valid date THEN the system SHALL import the valid row and skip only the invalid row.
22. WHEN the user selects a different date format THEN the system SHALL parse the preview again with that format.
23. WHEN the selected format is `DD/MM/YYYY` and the cell is `15/01/26` THEN the system SHALL skip that row and the warning message SHALL contain `invalid date: "15/01/26"`.
24. WHEN the selected format is `DD/MM/YYYY` and the cell is `15/01/2026 10:30` THEN the system SHALL skip that row.
25. WHEN the cell is `2026-01-15T13:00:00` THEN the system SHALL parse the date as `2026-01-15` under every date format.
26. WHEN the selected format is `DD/MM/YYYY` and the cell is `15/13/2026` or `32/01/2026` THEN the system SHALL skip that row.
27. WHEN the selected format is `DD/MM/YYYY` and the cell is `31/02/2026` THEN the system SHALL parse the date as `2026-02-31`.

**Independent Test**: Load a CSV whose dates are `01/02/2026`. Day-first stores `2026-02-01`. Switching the selector to month-first stores `2026-01-02`. A `15/fev/2026` file pre-selects the day-first month-name format and stores `2026-02-15`.

---

### P1: Saved mappings keep the new fields

**User Story**: As a person who reuses a bank's column layout, I want the saved mapping to remember the date format and the category and tags columns so that the next import starts from that layout.

**Why P1**: The mapper already saves a layout. Leaving the new fields out would drop the user's date format on the next visit.

**Acceptance Criteria**:

1. WHEN the user saves the current mapping THEN the system SHALL store the selected date format, the category column index, and the tags column index, using null for an unmapped column.
2. WHEN the user loads that saved mapping THEN the system SHALL apply those three values and SHALL replace the auto-detected mapping.
3. WHEN a saved mapping has no date format and no category or tags column THEN the system SHALL load date format `DD/MM/YYYY` with Category unmapped and Tags unmapped.

**Independent Test**: Save a mapping with month-first dates and a category column, load it on a new file, and confirm the selector and the category picker match the saved values. Load a mapping written before this feature and confirm day-first with both pickers unmapped.

---

## Edge Cases

- An invalid date, an unknown month token, a two-digit year, or a day or month outside 1–31 and 1–12 skips that row only (date story criteria 11, 19, 21, 23, 24, 26).
- A skipped row does not create a category or tag (IMAP-24, IMAP-25).
- A tags cell of commas and semicolons attaches nothing (category story criterion 18).
- `31/02/2026` is stored as `2026-02-31` under day-first (date story criterion 27).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IMAP-01 | P1: Category and tags columns | T10 | Done |
| IMAP-02 | P1: Category and tags columns | T7 | Done |
| IMAP-03 | P1: Category and tags columns | T7 | Done |
| IMAP-04 | P1: Category and tags columns | T4 | Pending |
| IMAP-05 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-06 | P1: Category and tags columns | T3 | Done |
| IMAP-07 | P1: Category and tags columns | T2 | Done |
| IMAP-08 | P1: Category and tags columns | T3 | Done |
| IMAP-09 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-10 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-11 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-12 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-13 | P1: Category and tags columns | T3 | Done |
| IMAP-14 | P1: Category and tags columns | T3 | Done |
| IMAP-15 | P1: Category and tags columns | T3 | Done |
| IMAP-16 | P1: Category and tags columns | T2 | Done |
| IMAP-17 | P1: Category and tags columns | T2 | Done |
| IMAP-18 | P1: Category and tags columns | T2 | Done |
| IMAP-19 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-20 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-21 | P1: Category and tags columns | T3 | Done |
| IMAP-22 | P1: Category and tags columns | Design | Pending |
| IMAP-23 | P1: Category and tags columns | T8 | Done |
| IMAP-24 | P1: Category and tags columns | T6, T8 | Done |
| IMAP-25 | P1: Category and tags columns | T8 | Done |
| IMAP-26 | P1: Category and tags columns | T8 | Done |
| IMAP-27 | P1: Category and tags columns | T8 | Done |
| IMAP-28 | P1: Category and tags columns | T8 | Done |
| IMAP-29 | P1: Category and tags columns | T3, T8 | Done |
| IMAP-30 | P1: Date format selection | T10 | Done |
| IMAP-31 | P1: Date format selection | T1 | Done |
| IMAP-32 | P1: Date format selection | T1 | Done |
| IMAP-33 | P1: Date format selection | T1 | Done |
| IMAP-34 | P1: Date format selection | T1 | Done |
| IMAP-35 | P1: Date format selection | T1, T7 | Done |
| IMAP-36 | P1: Date format selection | T1 | Done |
| IMAP-37 | P1: Date format selection | T1 | Done |
| IMAP-38 | P1: Date format selection | T1 | Done |
| IMAP-39 | P1: Date format selection | T1, T6 | Done |
| IMAP-40 | P1: Date format selection | T1 | Done |
| IMAP-41 | P1: Date format selection | T1 | Done |
| IMAP-42 | P1: Date format selection | T1 | Done |
| IMAP-43 | P1: Date format selection | T1, T6 | Done |
| IMAP-44 | P1: Date format selection | T1 | Done |
| IMAP-45 | P1: Date format selection | T1 | Done |
| IMAP-46 | P1: Date format selection | T1 | Done |
| IMAP-47 | P1: Date format selection | T1 | Done |
| IMAP-48 | P1: Date format selection | T1 | Done |
| IMAP-49 | P1: Date format selection | T1 | Done |
| IMAP-50 | P1: Date format selection | T6 | Done |
| IMAP-51 | P1: Date format selection | Design | Pending |
| IMAP-52 | P1: Date format selection | T1 | Done |
| IMAP-53 | P1: Date format selection | T1 | Done |
| IMAP-54 | P1: Date format selection | T1 | Done |
| IMAP-55 | P1: Date format selection | T1 | Done |
| IMAP-56 | P1: Date format selection | T1 | Done |
| IMAP-57 | P1: Saved mappings keep the new fields | T9 | Done |
| IMAP-58 | P1: Saved mappings keep the new fields | T9 | Done |
| IMAP-59 | P1: Saved mappings keep the new fields | T5, T9 | Done |

**Coverage:** 59 total, 57 mapped to tasks, 2 unmapped.

Category story criteria 1–29 are IMAP-01 through IMAP-29. Date story criteria 1–27 are IMAP-30 through IMAP-56. Saved-mapping criteria 1–3 are IMAP-57 through IMAP-59.

---

## Success Criteria

- [ ] A CSV with a category column and a tags column imports those links, creates a missing debit category as `expense`, and reuses it on a second import.
- [ ] `01/02/2026` stores `2026-02-01` under day-first and `2026-01-02` under month-first.
- [ ] `15/fev/2026` stores `2026-02-15` under the day-first month-name format.
- [ ] A saved mapping restores the date format and the category and tags columns. A pre-feature mapping loads as day-first with those columns unmapped.
