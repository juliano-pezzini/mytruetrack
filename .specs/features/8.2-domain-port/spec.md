# Phase 8.2 — Domain Port Specification

## Problem Statement

v2 needs the same domain logic as v1 (balance calculation, account/transaction models, categories, auto-categorization) ported to pure TypeScript. These are the core business rules that every other layer depends on. Getting them wrong cascades everywhere.

## Goals

- [ ] Port all v1 domain types to strict TypeScript
- [ ] Port balance calculation with monthly snapshot logic
- [ ] Port auto-categorization decision tree
- [ ] Money as integer cents — never floats
- [ ] ≥ 80% test coverage on domain services (Vitest)

## Out of Scope

| Feature | Reason |
|---------|--------|
| SQLite schema / repositories | Phase 8.3 |
| UI components | Phase 8.7 |
| Crypto / encryption | Phase 8.4 |
| OFX/XLSX import parsing | Phase 8.6 |
| `user_id` on models | v2 is single-user; no user table |

---

## User Stories

### P1: Money type and arithmetic ⭐ MVP

**User Story**: As a developer, I want a Money type that stores amounts as integer cents so that all financial calculations are exact.

**Acceptance Criteria**:

1. WHEN a money value is created from a display string (e.g., "150.75") THEN Money SHALL store 15075 as integer cents
2. WHEN two money values are added or subtracted THEN the result SHALL be exact (no floating-point drift)
3. WHEN a money value is formatted for display THEN it SHALL show 2 decimal places with locale-aware grouping
4. WHEN a money value is created from a negative string (e.g., "-500.00") THEN it SHALL correctly represent negative cents

**Independent Test**: Create Money values, perform arithmetic, assert exact cent values.

**Requirement ID**: DOM-01

---

### P1: Account model ⭐ MVP

**User Story**: As a developer, I want typed Account models so that account types and initial balances are enforced at the type level.

**Acceptance Criteria**:

1. WHEN an account is created THEN it SHALL have: id, name, type (bank | credit_card | wallet | transitional), initialBalance (Money), isActive (boolean)
2. WHEN an account type is checked THEN it SHALL be one of the discriminated union values — exhaustive switch required
3. WHEN account.initialBalance is set THEN it SHALL be immutable after creation

**Independent Test**: Create accounts of each type, verify type narrowing works.

**Requirement ID**: DOM-02

---

### P1: Transaction model ⭐ MVP

**User Story**: As a developer, I want typed Transaction models so that credit/debit direction and amount constraints are enforced.

**Acceptance Criteria**:

1. WHEN a transaction is created THEN it SHALL have: id, accountId, categoryId (optional), amount (Money, always positive), description, transactionDate, settledDate (optional), type (credit | debit), externalId (optional)
2. WHEN transaction.amount is set THEN it SHALL be positive (absolute value); type controls direction
3. WHEN transaction.type is 'credit' THEN it SHALL increase account balance
4. WHEN transaction.type is 'debit' THEN it SHALL decrease account balance

**Independent Test**: Create transactions, verify amount is positive, type discriminates direction.

**Requirement ID**: DOM-03

---

### P1: Category and Tag models ⭐ MVP

**User Story**: As a developer, I want Category (hierarchical, typed) and Tag (flat, colored) models for transaction classification.

**Acceptance Criteria**:

1. WHEN a category is created THEN it SHALL have: id, parentId (optional), name, type (revenue | expense), description (optional)
2. WHEN a tag is created THEN it SHALL have: id, name, color (hex string, default '#808080')
3. WHEN a category has a parentId THEN it SHALL reference another category of the same type

**Independent Test**: Create category trees and tags, verify parent-child relationships.

**Requirement ID**: DOM-04

---

### P1: Balance calculation service ⭐ MVP

**User Story**: As a developer, I want a pure function that calculates account balance at any date using the snapshot-based formula from v1.

**Acceptance Criteria**:

1. WHEN calculating balance with no snapshot THEN service SHALL use account.initialBalance as base
2. WHEN calculating balance with a snapshot THEN service SHALL use the most recent snapshot's closingBalance as base
3. WHEN accumulating transactions THEN service SHALL add credits and subtract debits from base
4. WHEN a credit card account has purchases THEN balance SHALL go negative (more owed)
5. WHEN a credit card receives a payment (credit) THEN balance SHALL move toward zero
6. WHEN calculating across month boundaries THEN service SHALL correctly select the right snapshot

**Independent Test**: Build scenarios with snapshots, transactions across months, verify balances match expected.

**Requirement ID**: DOM-05

---

### P1: Monthly snapshot computation ⭐ MVP

**User Story**: As a developer, I want a pure function that computes/updates the current month's balance snapshot after a transaction write.

**Acceptance Criteria**:

1. WHEN a transaction is added THEN snapshot service SHALL compute closing balance for that month
2. WHEN a snapshot already exists for the month THEN it SHALL be updated (not duplicated)
3. WHEN no snapshot exists for the month THEN a new one SHALL be created
4. WHEN computing a snapshot THEN it SHALL equal: previous snapshot (or initialBalance) + credits - debits for that month

**Independent Test**: Add transactions across months, verify snapshots are correct.

**Requirement ID**: DOM-06

---

### P2: Auto-categorization service

**User Story**: As a developer, I want a pure function that suggests a category for a transaction description using explicit rules and learned patterns.

**Acceptance Criteria**:

1. WHEN a description matches an explicit rule pattern (case-insensitive substring) THEN service SHALL return that rule's category with confidence ≥ 80
2. WHEN multiple rules match THEN service SHALL use the highest-priority (lowest number) rule
3. WHEN no explicit rule matches THEN service SHALL fall back to learned patterns
4. WHEN a learned pattern matches with confidence ≥ 70 THEN service SHALL return that category
5. WHEN no match is found THEN service SHALL return null (no suggestion)

**Independent Test**: Build rules and patterns, run descriptions through the service, verify suggestions.

**Requirement ID**: DOM-07

---

### P2: Auto-categorization learning

**User Story**: As a developer, I want a pure function that updates learned patterns when a user corrects a categorization.

**Acceptance Criteria**:

1. WHEN a user corrects a category THEN learning service SHALL extract keywords from the description
2. WHEN a keyword already exists for that category THEN it SHALL increment occurrence_count and update confidence
3. WHEN a keyword is new THEN it SHALL be created with occurrence_count=1 and base confidence
4. WHEN confidence is calculated THEN formula SHALL be: min(95, 50 + (occurrence_count * 5) + recency_bonus)

**Independent Test**: Simulate corrections, verify learned patterns and confidence scores.

**Requirement ID**: DOM-08

---

## Edge Cases

- WHEN balance calculation spans a month with no transactions THEN snapshot SHALL carry forward previous balance
- WHEN a transaction date is before any existing snapshot THEN calculation SHALL fall back to initialBalance
- WHEN amount is 0 THEN transaction creation SHALL reject it (CHECK amount > 0)
- WHEN a category is deleted THEN transactions referencing it SHALL retain categoryId as null
- WHEN auto-categorization has two patterns with equal confidence THEN service SHALL prefer the most recently matched

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
|---------------|-------|----------|--------|
| DOM-01 | Money type | P1 | Pending |
| DOM-02 | Account model | P1 | Pending |
| DOM-03 | Transaction model | P1 | Pending |
| DOM-04 | Category + Tag models | P1 | Pending |
| DOM-05 | Balance calculation | P1 | Pending |
| DOM-06 | Monthly snapshot | P1 | Pending |
| DOM-07 | Auto-categorization | P2 | Pending |
| DOM-08 | Auto-cat learning | P2 | Pending |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped

---

## Success Criteria

- [ ] All domain types compile with `strict: true`, no `any`
- [ ] Balance calculation passes all v1 scenarios (normal, credit card, cross-month, empty)
- [ ] Vitest coverage ≥ 80% on `src/domain/`
- [ ] All functions are pure (inputs → outputs, no I/O, no DB)
