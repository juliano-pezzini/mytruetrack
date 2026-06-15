# Phase 8.3 — Storage Layer Tasks

**Spec**: `.specs/features/8.3-storage-layer/spec.md`
**Status**: Done

---

## Test Strategy

No TESTING.md exists yet. Storage layer tests are **integration tests** running against an in-memory SQLite instance.

- **Production DB**: `@vlcn.io/crsqlite-wasm` (browser, includes cr-sqlite CRDT extensions)
- **Test DB**: `sql.js` (pure WASM SQLite for Node.js — no native deps, works in Vitest)
- **Abstraction**: A `Database` interface that both implement; repositories code against the interface
- **CRDT registration**: `crsql_as_crr()` calls are separated from table DDL — runs only with cr-sqlite (production), skipped in sql.js tests. Repositories don't depend on CRDT behavior; sync layer (Phase 8.5) tests will cover that.
- **Gate check**: `npx tsc --noEmit && npx vitest run`
- **Coverage gate**: `npx vitest run --coverage` (≥ 80% on `src/storage/`)

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1 → T2 → T3
```

### Phase 2: Repositories (Parallel)

```
     ┌→ T4 [P] ─┐
     ├→ T5 [P] ─┤
T3 ──┼→ T6 [P] ─┼→ (done)
     ├→ T7 [P] ─┤
     └→ T8 [P] ─┘
```

---

## Task Breakdown

### T1: Install dependencies + database abstraction

**What**: Install cr-sqlite (prod) and sql.js (test). Create a `Database` interface that both can implement. Create a sql.js test adapter and helper to stand up in-memory DBs for tests. Update vitest.config.ts to cover `src/storage/`.
**Where**: `package.json`, `src/storage/database.ts`, `src/storage/test-helpers.ts`, `vitest.config.ts`
**Depends on**: None
**Reuses**: None
**Requirement**: STR-08

**Done when**:

- [ ] `@vlcn.io/crsqlite-wasm` in dependencies
- [ ] `sql.js` + `@types/sql.js` in devDependencies
- [ ] `Database` interface exported from `src/storage/database.ts` with `exec`, `execA`, `execO`, `close`
- [ ] `createTestDatabase()` in `src/storage/test-helpers.ts` returns a `Database` backed by sql.js
- [ ] `vitest.config.ts` coverage includes `src/storage/**` (alongside existing `src/domain/**`)
- [ ] Smoke test: create table, insert row, read back via test helper
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration (smoke test in test-helpers.test.ts)
**Gate**: quick

---

### T2: Migration framework

**What**: Create a versioned migration runner that tracks applied versions in a `_migrations` table and applies pending migrations in order. Pure SQL — no CRDT dependency.
**Where**: `src/storage/migrations/types.ts`, `src/storage/migrations/runner.ts`, `src/storage/migrations/runner.test.ts`
**Depends on**: T1
**Reuses**: `Database` interface from T1
**Requirement**: STR-06

**Done when**:

- [ ] `Migration` type defined: `{ version: number; name: string; up: string | string[] }`
- [ ] `runMigrations(db, migrations)` creates `_migrations` table if missing, applies pending migrations in version order, records each version
- [ ] Skips already-applied migrations
- [ ] Throws on migration failure with version + message
- [ ] Tests: apply fresh, skip applied, error on bad SQL, out-of-order detection
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T3: Initial schema + database initialization

**What**: Write migration 001 with all 9 table DDL statements. Create `initDatabase()` / `closeDatabase()` entry points that open the DB, run migrations, optionally register CRDT, and return the handle. Create integration test verifying all tables exist with correct columns.
**Where**: `src/storage/migrations/001-initial-schema.ts`, `src/storage/migrations/index.ts`, `src/storage/init.ts`, `src/storage/init.test.ts`
**Depends on**: T2
**Reuses**: `Database` from T1, `runMigrations` from T2
**Requirement**: STR-01, STR-08

**Schema tables** (all money columns INTEGER, all dates TEXT):

- `accounts` (id TEXT PK, name TEXT, type TEXT, initial_balance INTEGER, is_active INTEGER DEFAULT 1, description TEXT DEFAULT '')
- `transactions` (id TEXT PK, account_id TEXT, category_id TEXT DEFAULT '', amount INTEGER, description TEXT, transaction_date TEXT, settled_date TEXT DEFAULT '', type TEXT, external_id TEXT DEFAULT '')
- `categories` (id TEXT PK, parent_id TEXT DEFAULT '', name TEXT, type TEXT, description TEXT DEFAULT '')
- `tags` (id TEXT PK, name TEXT, color TEXT DEFAULT '#808080')
- `transaction_tags` (transaction_id TEXT, tag_id TEXT, PK(transaction_id, tag_id))
- `account_balances` (account_id TEXT, year INTEGER, month INTEGER, closing_balance INTEGER, PK(account_id, year, month))
- `auto_category_rules` (id TEXT PK, pattern TEXT, category_id TEXT, priority INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1)
- `learned_category_patterns` (id TEXT PK, category_id TEXT, keyword TEXT, occurrence_count INTEGER DEFAULT 0, confidence_score INTEGER DEFAULT 0, first_learned_at TEXT, last_matched_at TEXT DEFAULT '', is_active INTEGER DEFAULT 1)
- `auto_category_corrections` (id TEXT PK, transaction_id TEXT, original_category_id TEXT DEFAULT '', corrected_category_id TEXT, description_text TEXT, correction_type TEXT, confidence_at_correction INTEGER DEFAULT 0)

**Done when**:

- [ ] Migration 001 creates all 9 tables with correct column types
- [ ] `migrations/index.ts` exports the ordered migration list
- [ ] `initDatabase(options?)` opens DB, runs migrations, returns `Database`
- [ ] `closeDatabase(db)` closes cleanly
- [ ] Test verifies all 9 tables exist after init
- [ ] Test verifies column names/types on key tables
- [ ] Test: init → close → re-init preserves data (for named DBs) or at minimum doesn't error
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T4: Account repository [P]

**What**: Implement `AccountRepository` with typed CRUD methods that convert between SQL rows and domain `Account` type.
**Where**: `src/storage/repositories/account-repository.ts`, `src/storage/repositories/account-repository.test.ts`
**Depends on**: T3
**Reuses**: `Account` / `createAccount` from `src/domain/account.ts`, `fromCents` from `src/domain/money.ts`, `createTestDatabase` + migration setup from T1/T3
**Requirement**: STR-02

**Done when**:

- [ ] `create(params)` inserts row, returns domain `Account`
- [ ] `getById(id)` returns `Account | null`
- [ ] `getAll()` returns active accounts (default), or all with `includeInactive` option
- [ ] `update(id, changes)` updates only provided fields
- [ ] `softDelete(id)` sets `is_active = 0`
- [ ] Money fields round-trip through `fromCents` / `toCents`
- [ ] Tests: create + read back, update, soft delete, getAll filtering
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T5: Transaction repository [P]

**What**: Implement `TransactionRepository` with CRUD, date-range queries, and tag junction management.
**Where**: `src/storage/repositories/transaction-repository.ts`, `src/storage/repositories/transaction-repository.test.ts`
**Depends on**: T3
**Reuses**: `Transaction` / `createTransaction` from `src/domain/transaction.ts`, `fromCents` from `src/domain/money.ts`
**Requirement**: STR-03

**Done when**:

- [ ] `create(params)` inserts row, returns domain `Transaction`
- [ ] `getById(id)` returns `Transaction | null`
- [ ] `getByAccount(accountId, dateRange?)` returns transactions ordered by `transaction_date DESC`
- [ ] `update(id, changes)` updates only provided fields
- [ ] `delete(id)` hard-deletes the row
- [ ] `addTags(transactionId, tagIds)` inserts into `transaction_tags`
- [ ] `removeTags(transactionId, tagIds)` deletes from `transaction_tags`
- [ ] `getTagIds(transactionId)` returns associated tag IDs
- [ ] Money fields round-trip correctly
- [ ] Tests: CRUD, date range filtering, tag association/removal
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T6: Category + Tag repositories [P]

**What**: Implement `CategoryRepository` and `TagRepository` with CRUD and hierarchy support for categories.
**Where**: `src/storage/repositories/category-repository.ts`, `src/storage/repositories/tag-repository.ts`, `src/storage/repositories/category-repository.test.ts`, `src/storage/repositories/tag-repository.test.ts`
**Depends on**: T3
**Reuses**: `Category` / `Tag` from domain layer
**Requirement**: STR-04

**Done when**:

- [ ] `CategoryRepository.create(params)` inserts, returns domain `Category`
- [ ] `CategoryRepository.getById(id)` returns `Category | null`
- [ ] `CategoryRepository.getAll()` returns all categories with parentId intact
- [ ] `CategoryRepository.update(id, changes)` updates only provided fields
- [ ] `CategoryRepository.delete(id)` rejects if category has children (throws)
- [ ] `TagRepository.create(params)` inserts, returns domain `Tag`
- [ ] `TagRepository.getById(id)` returns `Tag | null`
- [ ] `TagRepository.getAll()` returns tags ordered by name
- [ ] `TagRepository.update(id, changes)` updates only provided fields
- [ ] `TagRepository.delete(id)` hard-deletes
- [ ] Tests: CRUD for both, parent-child rejection, ordering
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T7: Account balance repository [P]

**What**: Implement `AccountBalanceRepository` for monthly snapshot persistence with upsert semantics.
**Where**: `src/storage/repositories/account-balance-repository.ts`, `src/storage/repositories/account-balance-repository.test.ts`
**Depends on**: T3
**Reuses**: `AccountBalance` from `src/domain/balance.ts`, `fromCents` from `src/domain/money.ts`
**Requirement**: STR-05

**Done when**:

- [ ] `upsert(accountId, year, month, closingBalance)` inserts or updates the snapshot
- [ ] `getByAccount(accountId)` returns all snapshots ordered by year/month DESC
- [ ] `getLatest(accountId, beforeDate)` returns the most recent snapshot at or before the given date, or null
- [ ] Duplicate month upsert updates (not duplicates)
- [ ] Money round-trip correct
- [ ] Tests: upsert fresh, upsert update, getLatest with multiple months, getLatest returns null when none exist
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`

**Tests**: integration
**Gate**: quick

---

### T8: Auto-categorization repositories [P]

**What**: Implement repositories for auto-category rules, learned patterns, and corrections.
**Where**: `src/storage/repositories/auto-category-rule-repository.ts`, `src/storage/repositories/learned-pattern-repository.ts`, `src/storage/repositories/auto-category-correction-repository.ts`, `src/storage/repositories/auto-cat-repositories.test.ts`
**Depends on**: T3
**Reuses**: Types from `src/domain/auto-categorization.ts`
**Requirement**: STR-07

**Done when**:

- [ ] `AutoCategoryRuleRepository.create(rule)` inserts, returns domain type
- [ ] `AutoCategoryRuleRepository.getActive()` returns rules where `is_active = 1` ordered by priority DESC
- [ ] `LearnedPatternRepository.create(pattern)` inserts, returns domain type
- [ ] `LearnedPatternRepository.getByKeyword(keyword)` returns matching active patterns
- [ ] `LearnedPatternRepository.upsert(pattern)` inserts or updates by keyword+categoryId
- [ ] `AutoCategoryCorrectionRepository.create(correction)` persists correction
- [ ] Tests: CRUD, active filtering, keyword lookup, upsert
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
| T3   | T2                      | T2                   | ✅    |
| T4   | T3                      | T3                   | ✅    |
| T5   | T3                      | T3                   | ✅    |
| T6   | T3                      | T3                   | ✅    |
| T7   | T3                      | T3                   | ✅    |
| T8   | T3                      | T3                   | ✅    |

### Test Co-location Validation

| Task | Code layer                | Test type   | Co-located                            | Valid |
| ---- | ------------------------- | ----------- | ------------------------------------- | ----- |
| T1   | storage/database          | integration | ✅ smoke test in test-helpers.test.ts | ✅    |
| T2   | storage/migrations        | integration | ✅ runner.test.ts                     | ✅    |
| T3   | storage/init + migrations | integration | ✅ init.test.ts                       | ✅    |
| T4   | storage/repositories      | integration | ✅ account-repository.test.ts         | ✅    |
| T5   | storage/repositories      | integration | ✅ transaction-repository.test.ts     | ✅    |
| T6   | storage/repositories      | integration | ✅ category + tag .test.ts            | ✅    |
| T7   | storage/repositories      | integration | ✅ account-balance-repository.test.ts | ✅    |
| T8   | storage/repositories      | integration | ✅ auto-cat-repositories.test.ts      | ✅    |

### Granularity Check

| Task | Files created/modified                                           | Single concept       | Atomic |
| ---- | ---------------------------------------------------------------- | -------------------- | ------ |
| T1   | 4 (package.json, database.ts, test-helpers.ts, vitest.config.ts) | DB abstraction       | ✅     |
| T2   | 3 (types.ts, runner.ts, runner.test.ts)                          | Migration framework  | ✅     |
| T3   | 4 (001-initial-schema.ts, index.ts, init.ts, init.test.ts)       | Schema + init        | ✅     |
| T4   | 2 (repository + test)                                            | Account CRUD         | ✅     |
| T5   | 2 (repository + test)                                            | Transaction CRUD     | ✅     |
| T6   | 4 (2 repos + 2 tests)                                            | Category + Tag CRUD  | ✅     |
| T7   | 2 (repository + test)                                            | Balance snapshots    | ✅     |
| T8   | 4 (3 repos + 1 test)                                             | Auto-cat persistence | ✅     |
