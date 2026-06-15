# Phase 8.6 — Statement Import Tasks

**Spec**: `.specs/features/8.6-statement-import/spec.md`
**Status**: Done

---

## Test Strategy

- **OFX parser**: Unit tests with inline OFX strings (bank + credit card). No I/O, no browser APIs.
- **XLSX parser**: Unit tests with programmatically-built XLSX buffers via `xlsx` write utils. No file I/O.
- **Import service**: Integration tests with sql.js database + repositories. Tests dedup, validation, batch insert.
- **Gate check**: `npx tsc --noEmit && npx vitest run`
- **Coverage gate**: `npx vitest run --coverage` (≥ 80% on `src/workers/**`)

---

## Execution Plan

### Phase 1: Dependencies (Sequential)

```
T1 (install deps) → T2 → T3 → T4
```

### Phase 2: Parsers (Parallel after T1)

```
     ┌→ T2 (OFX) ─┐
T1 ──┤             ├→ T4 (import service)
     └→ T3 (XLSX) ─┘
```

---

## Task Breakdown

### T1: Install dependencies + types + config

**What**: Add `ofx-js` and `xlsx` to the project. Add `src/workers/**` to vitest coverage config.
**Where**: `package.json`, `vitest.config.ts`
**Depends on**: None
**Requirement**: IMP-01, IMP-02

**Done when**:

- [ ] `ofx-js` added as dependency
- [ ] `xlsx` added as dependency
- [ ] `src/workers/**` added to vitest coverage include
- [ ] `ParsedTransaction` and `ParsedStatement` types defined in `src/workers/types.ts`
- [ ] Gate passes: `npx tsc --noEmit`

**Tests**: none
**Gate**: build

---

### T2: OFX parser

**What**: Pure-function OFX parser: string → `ParsedStatement`. Uses `ofx-js` for parsing, maps to domain types.
**Where**: `src/workers/ofx-parser.ts`, `src/workers/ofx-parser.test.ts`
**Depends on**: T1
**Reuses**: `fromDecimal`, `abs` from `src/domain/money.ts`
**Requirement**: IMP-01

**Done when**:

- [ ] `parseOfx(content: string): Promise<ParsedStatement>` implemented
- [ ] Handles bank statements (`BANKMSGSRSV1`)
- [ ] Handles credit card statements (`CREDITCARDMSGSRSV1`)
- [ ] Handles single-transaction (object) and multi-transaction (array)
- [ ] OFX date `YYYYMMDD[HHmmss]` → ISO `YYYY-MM-DD`
- [ ] Negative `TRNAMT` → positive amount + debit type
- [ ] `NAME` + `MEMO` concatenated for description
- [ ] `FITID` → `externalId`
- [ ] Account info (bankId, accountId, accountType) extracted
- [ ] Balance + balanceDate extracted from `LEDGERBAL`
- [ ] Tests: bank 3-txn, credit card 2-txn, single-txn edge case, missing memo
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: unit
**Gate**: quick

---

### T3: XLSX parser

**What**: Pure-function XLSX parser: `Uint8Array` → `ParsedTransaction[]`. Uses `xlsx` library.
**Where**: `src/workers/xlsx-parser.ts`, `src/workers/xlsx-parser.test.ts`
**Depends on**: T1
**Reuses**: `fromDecimal` from `src/domain/money.ts`
**Requirement**: IMP-02

**Done when**:

- [ ] `parseXlsx(data: Uint8Array, options?: XlsxParseOptions): ParsedTransaction[]` implemented
- [ ] Reads first sheet
- [ ] Default column mapping: 0=Date, 1=Description, 2=Amount
- [ ] Optional type column; if absent, infer from amount sign
- [ ] Skips header row (configurable)
- [ ] Skips empty rows
- [ ] Handles dates (Excel serial numbers → ISO date)
- [ ] Tests: basic 3-row sheet, no-type-column (sign inference), custom column mapping, empty rows skipped
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: unit
**Gate**: quick

---

### T4: Import service

**What**: Validate + dedup + persist parsed transactions into the database.
**Where**: `src/workers/import-service.ts`, `src/workers/import-service.test.ts`
**Depends on**: T2, T3 (uses same `ParsedTransaction` type)
**Reuses**: `createTransaction` from `src/domain/transaction.ts`, `createTransactionRepository` from `src/storage/repositories/transaction-repository.ts`
**Requirement**: IMP-03

**Done when**:

- [ ] `importTransactions(db, accountId, transactions): ImportResult` implemented
- [ ] `ImportResult = { imported: number; skipped: number; errors: ImportError[] }`
- [ ] Generates UUIDs for new transaction IDs
- [ ] Validates via `createTransaction()` domain factory
- [ ] Dedup: checks `externalId` existence in DB for the target account, skips duplicates
- [ ] Inserts non-duplicate transactions via repository
- [ ] Validation errors collected (not thrown) — continues with remaining transactions
- [ ] Tests: import 3 new txns, re-import same (all skipped), import with 1 invalid (collected as error), import without externalId (no dedup)
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

## Validation

### Diagram-Definition Cross-Check

| Task | Depends on (definition) | Depends on (diagram) | Match |
| ---- | ----------------------- | -------------------- | ----- |
| T1   | None                    | None                 | ✅    |
| T2   | T1                      | T1                   | ✅    |
| T3   | T1                      | T1                   | ✅    |
| T4   | T2, T3                  | T2, T3               | ✅    |

### Test Co-location Validation

| Task | Code layer             | Test type   | Co-located                | Valid |
| ---- | ---------------------- | ----------- | ------------------------- | ----- |
| T1   | workers/types          | none        | N/A                       | ✅    |
| T2   | workers/ofx-parser     | unit        | ✅ ofx-parser.test.ts     | ✅    |
| T3   | workers/xlsx-parser    | unit        | ✅ xlsx-parser.test.ts    | ✅    |
| T4   | workers/import-service | integration | ✅ import-service.test.ts | ✅    |
