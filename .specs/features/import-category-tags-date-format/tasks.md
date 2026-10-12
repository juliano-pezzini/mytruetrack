# Import Category, Tags, and Date Format Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/import-category-tags-date-format/design.md`
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` (domain and sync coverage follow `vitest.config.ts`; co-locate tests; Playwright covers import), `vitest.config.ts` (include `src/**/*.test.ts`, 80% lines/functions/branches/statements on domain, storage, crypto, sync, workers), `package.json`, `.github/workflows/pr-checks.yml` (Prettier, ESLint, `tsc`, Vitest coverage, Vite build).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain | unit | All branches; 1:1 to the spec ACs for date parsing, name keys, and classification, including every listed edge case | `src/domain/*.test.ts` | `npm test` |
| Workers | unit | Mapping, detection, and import persistence outcomes from the spec, including skip, dedup, and per-row errors | `src/workers/*.test.ts` | `npm test` |
| Storage | unit | Saved-mapping read path fills missing fields; save keeps the new fields | `src/storage/*.test.ts` | `npm test` |
| UI component | unit | Picker options and preview text. Vitest only includes `*.test.ts`, so use a jsdom `*.test.ts` beside the component | `src/ui/**/*.test.ts` | `npm test` |
| Import flow | e2e | Happy path: date format changes the preview; a CSV category and tags are stored | `e2e/import.spec.ts` | `npm run test:e2e` |
| Types | none | Build gate only | - | `npm run typecheck` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit-test tasks | `npm test` |
| Full | The task that changes the import e2e | `npm test` and `npm run test:e2e` |
| Build | Type-only task, and the phase close | `npx prettier --check "src/**/*.{ts,tsx}"` and `npm run lint` and `npm run typecheck` and `npm test` |

---

## Execution Plan

Phases run in order. Tasks inside a phase run in order. Twelve tasks pack as two batches at Execute: phases 1–3 (seven tasks), then phases 4–5 (five tasks).

### Phase 1: Date format

```
T1
```

### Phase 2: Names and classification

```
T2 → T3
```

### Phase 3: Mapping pipeline

```
T4 → T5
T4 → T6
T4 → T7
```

### Phase 4: Persistence

```
T8
T9
```

### Phase 5: Wizard

```
T10 → T12
T11 → T12
```

---

## Task Breakdown

### Phase 1: Date format

### T1: Parse and detect import dates

**Status**: Complete

**What**: Add `parseImportDate` and `detectDateFormat` for `dmy`, `mdy`, `ymd`, `dmony`, and `mondy`, including the month-token table, ISO prefix, separators, and the vote rules.
**Where**: `src/domain/date-format.ts`
**Depends on**: None
**Reuses**: `src/domain/number-format.ts` (detect plus parse that throws), the bounds in `src/workers/apply-mapping.ts`
**Requirement**: IMAP-31, IMAP-32, IMAP-33, IMAP-34, IMAP-35, IMAP-36, IMAP-37, IMAP-38, IMAP-39, IMAP-40, IMAP-41, IMAP-42, IMAP-43, IMAP-44, IMAP-45, IMAP-46, IMAP-47, IMAP-48, IMAP-49, IMAP-52, IMAP-53, IMAP-54, IMAP-55, IMAP-56

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `15/01/2026` under `dmy` is `2026-01-15`, and `01/15/2026` under `dmy` throws `invalid date: "01/15/2026"`
- [x] `01/15/2026` under `mdy` is `2026-01-15`
- [x] `2026-01-15` and `2026-01-15T13:00:00` parse under every format
- [x] `15/fev/2026` and `15/FEV/2026` under `dmony` are `2026-02-15`
- [x] `Jan 15, 2026` under `mondy` is `2026-01-15`
- [x] `15.01.2026` and `15-01-2026` under `dmy` are `2026-01-15`
- [x] `15/Xxx/2026`, `15/01/26`, `15/01/2026 10:30`, `15/13/2026`, and `32/01/2026` throw `invalid date:` plus the original cell
- [x] `31/02/2026` under `dmy` is `2026-02-31`
- [x] Samples vote as the spec says, including a tie broken by `dmy`, `mdy`, `ymd`, `dmony`, `mondy`, and no votes selects `dmy`
- [x] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): parse explicit statement date formats`

---

### Phase 2: Names and classification

### T2: Normalize category and tag names

**Status**: Complete

**What**: Add `storedName`, `nameKey`, and `splitTagNames`.
**Where**: `src/domain/import-names.ts`
**Depends on**: None
**Reuses**: `toLowerCase` header matching in `src/workers/column-detection.ts`
**Requirement**: IMAP-07, IMAP-16, IMAP-17, IMAP-18

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `  Super   Market ` stores and matches `Super Market`, and does not match `SuperMarket`
- [x] `Café` does not match `Cafe`
- [x] `food, travel; work` yields `food`, `travel`, `work`
- [x] `food, food,, travel` yields `food`, `travel`
- [x] ` , ; ` yields no names
- [x] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): normalize imported category and tag names`

---

### T3: Plan category and tag links

**Status**: Complete

**What**: Add `classifyImportRows`, which links existing records or marks the first unseen name for creation.
**Where**: `src/domain/import-classification.ts`
**Depends on**: T2
**Reuses**: `suggestTagColor` from `src/domain/tag.ts`
**Requirement**: IMAP-05, IMAP-06, IMAP-08, IMAP-09, IMAP-10, IMAP-11, IMAP-12, IMAP-13, IMAP-14, IMAP-15, IMAP-19, IMAP-20, IMAP-21, IMAP-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] An empty category cell is `none` and an empty tags cell has no tag refs
- [x] `  Super   Market ` creates stored name `Super Market`; a debit creates `expense` and a credit creates `revenue`
- [x] A later row with the same key is `planned` and keeps that type
- [x] One existing category is linked even when its type differs from the row
- [x] When both types exist, a credit links to `revenue` and a debit links to `expense`
- [x] Several matches resolve by stored name, then id, using `<`
- [x] The first new tag color is `#E11D48` and the next is `#0EA5E9` when `#E11D48` is used
- [x] `  food ` links an existing tag named `Food`
- [x] A second plan against a catalog that already contains the created category links it and does not create another
- [x] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): plan category and tag links for a statement`

---

### Phase 3: Mapping pipeline

### T4: Extend the import mapping types

**Status**: Complete

**What**: Add optional `dateFormat`, `categoryColumn`, and `tagsColumn` on `ColumnMapping`, and optional `categoryName` and `tagNames` on `ParsedTransaction`. Absence means day-first, unmapped columns, and no names, so current literals still typecheck.
**Where**: `src/workers/types.ts`
**Depends on**: T1
**Reuses**: `DateFormat` from `src/domain/date-format.ts`
**Requirement**: IMAP-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] The new fields are exported on the two types
- [x] `npm run typecheck` passes without edits to existing object literals

**Tests**: none
**Gate**: build
**Commit**: `feat(import): add date format and label columns to mapping types`

---

### T5: Normalize saved column mappings

**What**: Add `normalizeColumnMapping`, filling a missing date format with `dmy` and missing category and tags columns with null.
**Where**: `src/workers/column-mapping.ts`
**Depends on**: T4
**Reuses**: `src/workers/types.ts`
**Requirement**: IMAP-59

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] A config with no `dateFormat`, `categoryColumn`, or `tagsColumn` normalizes to `dmy`, null, and null
- [ ] A config that already has `mondy` and column indexes is unchanged
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): default legacy column mappings`

---

### T6: Apply the date format and label columns

**What**: Make `applyMapping` parse dates with `parseImportDate` and copy `categoryName` and `tagNames` onto each parsed transaction. A missing `dateFormat` behaves as `dmy`.
**Where**: `src/workers/apply-mapping.ts`
**Depends on**: T1, T4
**Reuses**: `parseImportDate`, `storedName`, `splitTagNames`
**Requirement**: IMAP-24, IMAP-39, IMAP-43, IMAP-50

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `mdy` parses `01/15/2026` as `2026-01-15`, and `dmy` skips that cell with warning `invalid date: "01/15/2026"` while a sibling valid row remains
- [ ] An ISO cell parses when `dateFormat` is `dmy`
- [ ] A mapped category cell becomes `categoryName`, and a tags cell becomes `tagNames`
- [ ] An unmapped or blank category column yields `categoryName` null, and a blank tags cell yields an empty list
- [ ] A row skipped for a bad date or amount is absent from `transactions`
- [ ] Existing apply-mapping tests still pass
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): map statement dates, categories, and tags`

---

### T7: Detect category, tags, and date format

**What**: Extend `guessMapping` with the category and tags header keywords and `detectDateFormat` on the date column.
**Where**: `src/workers/column-detection.ts`
**Depends on**: T1, T4
**Reuses**: `findColumn` and `detectDateFormat`
**Requirement**: IMAP-02, IMAP-03, IMAP-35

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Header `Categoria` sets `categoryColumn`, and `Etiquetas` sets `tagsColumn`
- [ ] Headers with neither keyword leave both columns null
- [ ] A `15/fev/2026` date column sets `dateFormat` to `dmony`
- [ ] An ambiguous `01/02/2026` column sets `dateFormat` to `dmy`
- [ ] Existing date, description, amount, and number-format expectations still pass
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): detect category, tags, and date format columns`

---

### Phase 4: Persistence

### T8: Store categories and tags on import

**What**: Extend `importTransactions` so non-duplicate rows are classified, missing categories and tags are created, and the transaction stores `categoryId` plus tag links. Rows with no names skip the catalog reads.
**Where**: `src/workers/import-service.ts`
**Depends on**: T3, T6
**Reuses**: category, tag, and transaction repositories; `classifyImportRows`
**Requirement**: IMAP-05, IMAP-09, IMAP-10, IMAP-11, IMAP-12, IMAP-19, IMAP-20, IMAP-23, IMAP-24, IMAP-25, IMAP-26, IMAP-27, IMAP-28, IMAP-29

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] A new debit category is stored as `expense` with null parent and null description, and its id is on the transaction
- [ ] A new credit category is stored as `revenue`
- [ ] A later row in the same import reuses that category when its direction differs
- [ ] One existing category is linked even when its type differs
- [ ] The first new tag is `#E11D48` and the next new tag is `#0EA5E9`, with one `transaction_tags` row each
- [ ] A duplicate `externalId` is skipped and creates neither a category nor a tag
- [ ] A thrown create records that row index and a later row still imports
- [ ] A second import links the category created by the first and does not insert another
- [ ] An empty category stays null when an auto-category rule would match the description
- [ ] Existing import-service tests still pass
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): persist statement categories and tags`

---

### T9: Load saved mappings with the new fields

**What**: Run every stored config through `normalizeColumnMapping` in `listMappings`, and cover save plus load of the new fields.
**Where**: `src/storage/import-mappings.ts`
**Depends on**: T5
**Reuses**: `normalizeColumnMapping`
**Requirement**: IMAP-57, IMAP-58, IMAP-59

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Saving a mapping with `mondy`, a category column, and a tags column returns those values from `listMappings`
- [ ] A stored config missing the new fields loads as `dmy` with both columns null
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): round-trip date format and label columns`

---

### Phase 5: Wizard

### T10: Add the mapper controls

**What**: Add the date-format selector and the Category and Tags column pickers to `ColumnMapper`.
**Where**: `src/ui/components/import/ColumnMapper.tsx`
**Depends on**: T4
**Reuses**: `ColumnSelect` and the number-format `<select>`
**Requirement**: IMAP-01, IMAP-30

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] The date-format control lists `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MMM/YYYY`, and `MMM/DD/YYYY`, and uses `data-testid="map-date-format"`
- [ ] Category and Tags pickers use `map-category` and `map-tags` and can be cleared
- [ ] Choosing a format or a column calls `onChange` with that field updated
- [ ] A missing `dateFormat` renders as `DD/MM/YYYY`
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): show date format, category, and tags mappers`

---

### T11: Show category and tags in the preview

**What**: Render the category name, the create/planned type suffix, and the tag names in `PreviewTable`.
**Where**: `src/ui/components/import/PreviewTable.tsx`
**Depends on**: None
**Reuses**: the current five-row preview and warning list
**Requirement**: IMAP-22

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] An existing category renders as its stored name
- [ ] A category this import will create renders as `Name (expense)` or `Name (revenue)`
- [ ] Tags render in order joined by `, `
- [ ] An empty category and empty tags render as blank cells
- [ ] `npm test` passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(import): preview statement category and tags`

---

### T12: Wire the wizard and the import e2e

**What**: Load categories and tags in `ImportWizard`, classify the preview, keep import available when the new columns are unmapped, and cover the flow in Playwright.
**Where**: `src/ui/components/import/ImportWizard.tsx`
**Depends on**: T6, T8, T10, T11
**Reuses**: `applyMapping`, `classifyImportRows`, the category and tag repositories
**Requirement**: IMAP-04, IMAP-22, IMAP-51

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] The preview uses `classifyImportRows` against the loaded catalog
- [ ] Import stays enabled when Category and Tags are unmapped and the required amount columns are mapped
- [ ] Changing the date format reparses the preview
- [ ] `e2e/import.spec.ts` shows `01/02/2026` becoming `2026-01-02` after month-first is selected, and a CSV with category and tags imports those values
- [ ] `npm test` and `npm run test:e2e` pass

**Tests**: e2e
**Gate**: full
**Commit**: `feat(import): classify categories and tags in the import wizard`

---

## Phase Execution Map

```
Phase 1: T1
Phase 2: T2 → T3
Phase 3: T4 → T5
Phase 3: T4 → T6
Phase 3: T4 → T7
Phase 4: T8
Phase 4: T9
Phase 5: T10 → T12
Phase 5: T11 → T12
```

Twelve tasks. At Execute they pack into two batches: phases 1–3, then phases 4–5. Batches run one after the other.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Parse and detect import dates | 1 module | ✅ Granular |
| T2: Normalize category and tag names | 1 module | ✅ Granular |
| T3: Plan category and tag links | 1 module | ✅ Granular |
| T4: Extend the import mapping types | 1 type module | ✅ Granular |
| T5: Normalize saved column mappings | 1 module | ✅ Granular |
| T6: Apply the date format and label columns | 1 module | ✅ Granular |
| T7: Detect category, tags, and date format | 1 module | ✅ Granular |
| T8: Store categories and tags on import | 1 module | ✅ Granular |
| T9: Load saved mappings with the new fields | 1 module | ✅ Granular |
| T10: Add the mapper controls | 1 component | ✅ Granular |
| T11: Show category and tags in the preview | 1 component | ✅ Granular |
| T12: Wire the wizard and the import e2e | 1 component plus its e2e | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | no incoming arrow | ✅ Match |
| T2 | None | no incoming arrow | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T1 | no intra-phase arrow (T1 is an earlier phase) | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T1, T4 | T4 → T6 (T1 is the previous phase) | ✅ Match |
| T7 | T1, T4 | T4 → T7 (T1 is the previous phase) | ✅ Match |
| T8 | T3, T6 | no intra-phase arrow (T3 and T6 are earlier phases) | ✅ Match |
| T9 | T5 | no intra-phase arrow (T5 is the previous phase) | ✅ Match |
| T10 | T4 | no intra-phase arrow (T4 is an earlier phase) | ✅ Match |
| T11 | None | no incoming arrow | ✅ Match |
| T12 | T6, T8, T10, T11 | T10 → T12 and T11 → T12 (T6 and T8 are earlier phases) | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Parse and detect import dates | Domain | unit | unit | ✅ OK |
| T2: Normalize category and tag names | Domain | unit | unit | ✅ OK |
| T3: Plan category and tag links | Domain | unit | unit | ✅ OK |
| T4: Extend the import mapping types | Types | none | none | ✅ OK |
| T5: Normalize saved column mappings | Workers | unit | unit | ✅ OK |
| T6: Apply the date format and label columns | Workers | unit | unit | ✅ OK |
| T7: Detect category, tags, and date format | Workers | unit | unit | ✅ OK |
| T8: Store categories and tags on import | Workers | unit | unit | ✅ OK |
| T9: Load saved mappings with the new fields | Storage | unit | unit | ✅ OK |
| T10: Add the mapper controls | UI component | unit | unit | ✅ OK |
| T11: Show category and tags in the preview | UI component | unit | unit | ✅ OK |
| T12: Wire the wizard and the import e2e | Import flow | e2e | e2e | ✅ OK |
