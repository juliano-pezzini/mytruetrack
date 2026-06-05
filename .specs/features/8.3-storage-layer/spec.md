# Phase 8.3 — Storage Layer Specification

## Problem Statement

Domain types from Phase 8.2 exist only in memory. The app needs persistent local storage via SQLite-WASM with cr-sqlite CRDT support so that data survives page reloads, can be synced conflict-free across devices, and can be queried efficiently. This is the foundation every higher layer (crypto, sync, UI) depends on.

## Goals

- [ ] Define SQLite schema matching all domain types (accounts, transactions, categories, tags, account_balances, auto_category_rules, learned_category_patterns, auto_category_corrections, transaction_tags)
- [ ] Enable cr-sqlite CRDT (`crsql_as_crr`) on all tables for conflict-free multi-device sync
- [ ] Implement repository pattern — typed async CRUD over SQL, returning domain types
- [ ] Build a versioned migration framework for future schema changes
- [ ] Integration tests against in-memory SQLite-WASM verifying round-trips

## Out of Scope

| Feature | Reason |
|---------|--------|
| Encryption of stored data | Phase 8.4 (Crypto Layer) |
| Sync engine / cloud push-pull | Phase 8.5 (Sync Layer) |
| UI components consuming repositories | Phase 8.7 |
| React hooks wrapping repositories | Phase 8.7 |
| Full-text search on transactions | Post-Phase 8; not in v1 |
| `user_id` columns | v2 is single-user; no user table |

---

## User Stories

### P1: SQLite schema and CRDT setup ⭐ MVP

**User Story**: As a developer, I want a SQLite schema that mirrors the domain types and is CRDT-enabled so that data persists locally and is sync-ready from day one.

**Acceptance Criteria**:

1. WHEN the database initializes THEN it SHALL create all tables: `accounts`, `transactions`, `categories`, `tags`, `transaction_tags`, `account_balances`, `auto_category_rules`, `learned_category_patterns`, `auto_category_corrections`
2. WHEN tables are created THEN each table SHALL be registered as a CRDT via `crsql_as_crr()`
3. WHEN a non-PK column has NOT NULL THEN it SHALL also have a DEFAULT value (cr-sqlite constraint from Spike A)
4. WHEN money columns are stored THEN they SHALL be INTEGER (cents), never REAL
5. WHEN date columns are stored THEN they SHALL be TEXT in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)

**Independent Test**: Initialize DB, verify all tables exist, verify `crsql_as_crr` succeeds on each table.

**Requirement ID**: STR-01

---

### P1: Account repository ⭐ MVP

**User Story**: As a developer, I want an AccountRepository so that I can create, read, update, and list accounts with typed domain objects.

**Acceptance Criteria**:

1. WHEN `create(params)` is called THEN it SHALL insert a row and return a domain `Account`
2. WHEN `getById(id)` is called THEN it SHALL return `Account | null`
3. WHEN `getAll()` is called THEN it SHALL return all active accounts by default
4. WHEN `update(id, changes)` is called THEN it SHALL update only the provided fields
5. WHEN `softDelete(id)` is called THEN it SHALL set `is_active = 0` (no hard deletes — CRDT-safe)

**Independent Test**: Create account, read back, verify domain types match. Update, verify changes persisted.

**Requirement ID**: STR-02

---

### P1: Transaction repository ⭐ MVP

**User Story**: As a developer, I want a TransactionRepository so that I can persist and query transactions with proper money/type handling.

**Acceptance Criteria**:

1. WHEN `create(params)` is called THEN it SHALL insert a row, store amount as integer cents, and return a domain `Transaction`
2. WHEN `getByAccount(accountId, dateRange?)` is called THEN it SHALL return transactions ordered by `transaction_date DESC`
3. WHEN `getById(id)` is called THEN it SHALL return `Transaction | null`
4. WHEN `update(id, changes)` is called THEN it SHALL update only the provided fields
5. WHEN `delete(id)` is called THEN it SHALL hard-delete the row (transactions are user-deletable; CRDT delete-wins per Spike A)
6. WHEN tags are associated THEN `addTags(transactionId, tagIds)` and `removeTags(transactionId, tagIds)` SHALL manage the `transaction_tags` junction

**Independent Test**: Create transaction, query by account, verify amount round-trips as Money.

**Requirement ID**: STR-03

---

### P1: Category and Tag repositories ⭐ MVP

**User Story**: As a developer, I want CategoryRepository and TagRepository so that I can manage categories (with parent hierarchy) and tags.

**Acceptance Criteria**:

1. WHEN `CategoryRepository.create(params)` is called THEN it SHALL insert and return a domain `Category`
2. WHEN `CategoryRepository.getAll()` is called THEN it SHALL return categories with parent-child relationships intact (parentId populated)
3. WHEN `TagRepository.create(params)` is called THEN it SHALL insert and return a domain `Tag`
4. WHEN `TagRepository.getAll()` is called THEN it SHALL return all tags ordered by name
5. WHEN `CategoryRepository.update(id, changes)` / `TagRepository.update(id, changes)` are called THEN they SHALL update only the provided fields

**Independent Test**: Create parent + child categories, read back, verify parentId linkage.

**Requirement ID**: STR-04

---

### P1: Account balance repository ⭐ MVP

**User Story**: As a developer, I want an AccountBalanceRepository to persist monthly snapshots so that balance calculation can use them as base points.

**Acceptance Criteria**:

1. WHEN `upsert(accountId, year, month, closingBalance)` is called THEN it SHALL insert or update the snapshot for that month
2. WHEN `getByAccount(accountId)` is called THEN it SHALL return all snapshots ordered by year/month DESC
3. WHEN `getLatest(accountId, beforeDate)` is called THEN it SHALL return the most recent snapshot at or before the given date, or null

**Independent Test**: Create snapshots for multiple months, query latest, verify correct one returned.

**Requirement ID**: STR-05

---

### P1: Migration framework ⭐ MVP

**User Story**: As a developer, I want a versioned migration system so that future schema changes are applied automatically on app startup without data loss.

**Acceptance Criteria**:

1. WHEN the app starts THEN it SHALL check the current schema version and apply any pending migrations in order
2. WHEN a migration is applied THEN it SHALL record the version number so it is not re-applied
3. WHEN all migrations succeed THEN CRDT registration (`crsql_as_crr`) SHALL be re-validated
4. WHEN a migration fails THEN it SHALL throw an error with the migration version and message (no silent failures)

**Independent Test**: Start with v0, apply migrations to vN, verify schema matches expectations.

**Requirement ID**: STR-06

---

### P2: Auto-categorization repositories

**User Story**: As a developer, I want repositories for auto-categorization rules, learned patterns, and corrections so that the auto-cat service can persist its state.

**Acceptance Criteria**:

1. WHEN `AutoCategoryRuleRepository.getActive()` is called THEN it SHALL return rules where `is_active = 1` ordered by priority DESC
2. WHEN `LearnedCategoryPatternRepository.getByKeyword(keyword)` is called THEN it SHALL return matching patterns
3. WHEN `AutoCategoryCorrectionRepository.create(correction)` is called THEN it SHALL persist the correction for future learning
4. WHEN `LearnedCategoryPatternRepository.upsert(pattern)` is called THEN it SHALL insert or update by keyword+categoryId composite

**Independent Test**: Create rules and patterns, query, verify filtering and ordering.

**Requirement ID**: STR-07

---

### P2: Database initialization and lifecycle

**User Story**: As a developer, I want a single `initDatabase()` entry point so that the entire storage layer bootstraps cleanly with one call.

**Acceptance Criteria**:

1. WHEN `initDatabase()` is called THEN it SHALL load cr-sqlite WASM, open a named database, run migrations, and return a handle
2. WHEN `closeDatabase()` is called THEN it SHALL finalize all CRDT state and close the connection cleanly
3. WHEN `initDatabase()` is called with an existing database THEN it SHALL skip already-applied migrations and return the handle

**Independent Test**: Init, close, re-init — verify no errors and data survives.

**Requirement ID**: STR-08

---

## Edge Cases

- WHEN a transaction amount is read from SQLite THEN it SHALL be converted from INTEGER to `Money` via `fromCents()` — never raw number
- WHEN `transaction_date` is stored THEN it SHALL be TEXT (YYYY-MM-DD), not SQLite date type (avoids timezone ambiguity)
- WHEN a category with children is deleted THEN the repository SHALL reject the operation (orphan prevention)
- WHEN the cr-sqlite WASM fails to load THEN `initDatabase()` SHALL throw a descriptive error (not silently degrade)
- WHEN two snapshots exist for the same account+year+month THEN `upsert` SHALL update the existing row (not insert a duplicate)

---

## Requirement Traceability

| ID | Story | Priority |
|----|-------|----------|
| STR-01 | SQLite schema + CRDT setup | P1 |
| STR-02 | Account repository | P1 |
| STR-03 | Transaction repository | P1 |
| STR-04 | Category + Tag repositories | P1 |
| STR-05 | Account balance repository | P1 |
| STR-06 | Migration framework | P1 |
| STR-07 | Auto-categorization repositories | P2 |
| STR-08 | Database initialization + lifecycle | P2 |
