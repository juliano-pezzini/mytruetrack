# Phase 8.6 — Statement Import (OFX + XLSX)

**Status**: Draft
**Depends on**: 8.2 (domain types), 8.3 (storage/repositories)

---

## Objective

Implement pure-function parsers for OFX and XLSX bank/credit-card statements, plus an import service that validates, deduplicates, and persists parsed transactions. All code runs synchronously in Node.js for testing; the Web Worker wrapper is deferred to the UI phase (8.7).

---

## Requirements

### IMP-01: OFX Parser

Parse OFX 1.x (SGML) and 2.x (XML) files into an intermediate `ParsedTransaction[]` array. Uses `ofx-js` library (validated in Spike D).

- Parse bank statements (`BANKMSGSRSV1 → STMTRS`)
- Parse credit card statements (`CREDITCARDMSGSRSV1 → CCSTMTRS`)
- Handle single-transaction edge case (`STMTTRN` is object, not array)
- Map OFX fields to intermediate type:
  - `TRNTYPE` → `type: 'credit' | 'debit'`
  - `DTPOSTED` → ISO date (`YYYYMMDD` → `YYYY-MM-DD`)
  - `TRNAMT` → `amount` (absolute value via `fromDecimal`)
  - `FITID` → `externalId`
  - `NAME` + `MEMO` → `description`
- Expose account info (bank ID, account ID, account type) from the statement
- Pure function: `parseOfx(content: string) → ParsedStatement`

### IMP-02: XLSX Parser

Parse XLSX spreadsheets with a known column layout into `ParsedTransaction[]`. Uses a lightweight XLSX library.

- Accept a `Uint8Array` (file bytes)
- Read the first sheet
- Expect columns: Date, Description, Amount, Type (optional)
- If no Type column, determine credit/debit from amount sign
- Skip header row and empty rows
- Pure function: `parseXlsx(data: Uint8Array, options?: XlsxParseOptions) → ParsedTransaction[]`

### IMP-03: Import Service

Validate and persist parsed transactions, with deduplication by `externalId`.

- Accept `ParsedTransaction[]` + `accountId` + `Database`
- Validate each transaction with `createTransaction()` (domain factory)
- Deduplicate: skip transactions whose `externalId` already exists in the database for the target account
- Insert non-duplicate transactions via the transaction repository
- Return import result: `{ imported: number; skipped: number; errors: ImportError[] }`
- No auto-categorization at import time (that's a separate pass the UI triggers)

---

## Non-Goals

- Web Worker wrapper (deferred to 8.7 — UI phase)
- Progress callbacks / streaming (deferred to 8.7)
- CSV import (can be added later with same pattern)
- Auto-categorization during import
- Account creation from OFX account info (user selects target account in UI)

---

## Design Notes

### ParsedTransaction (intermediate type)

```typescript
type ParsedTransaction = {
  date: string; // ISO: YYYY-MM-DD
  description: string;
  amount: Money; // always positive
  type: TransactionType; // 'credit' | 'debit'
  externalId: string | null;
};
```

### ParsedStatement (OFX result)

```typescript
type ParsedStatement = {
  accountInfo: {
    bankId: string | null;
    accountId: string;
    accountType: 'bank' | 'credit_card';
  };
  currency: string;
  transactions: ParsedTransaction[];
  balance: Money | null;
  balanceDate: string | null;
};
```

### XLSX column mapping

Configurable via `XlsxParseOptions`:

```typescript
type XlsxParseOptions = {
  dateColumn?: number; // default: 0
  descriptionColumn?: number; // default: 1
  amountColumn?: number; // default: 2
  typeColumn?: number; // default: undefined (infer from sign)
  headerRow?: boolean; // default: true (skip first row)
};
```

### Library choice for XLSX

Use `xlsx` (SheetJS Community Edition) — well-maintained, works in Node.js and browser, reads .xlsx files. Lighter than `exceljs` for read-only use.

---

## Test Strategy

- **OFX parser**: Unit tests with inline OFX strings (bank + credit card samples from Spike D). Test single-transaction edge case, missing fields.
- **XLSX parser**: Unit tests with programmatically-generated XLSX buffers (using `xlsx` write utils in tests).
- **Import service**: Integration tests with sql.js database. Test deduplication, validation errors, happy path.
- **Coverage gate**: ≥ 80% on `src/workers/**`
