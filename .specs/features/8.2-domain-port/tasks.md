# Phase 8.2 — Domain Port Tasks

**Spec**: `.specs/features/8.2-domain-port/spec.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1
```

### Phase 2: Core Types (Parallel)

```
T1 ──┬→ T2 (Money)
     └→ T3 (Category + Tag) [P]
```

### Phase 3: Entity Models (Parallel)

```
T2 ──┬→ T4 (Account)
     └→ T5 (Transaction) [P]
T3 ──→ T7 (AutoCat types) [P]
```

### Phase 4: Domain Services (Parallel)

```
T4, T5 ──→ T6 (Balance + Snapshot)
T5, T7 ──→ T8 (AutoCat service + learning) [P]
```

---

## Test Convention

No TESTING.md exists yet. Convention for Phase 8.2:

| Layer | Test Type | Pattern | Gate Command |
|-------|-----------|---------|-------------|
| Domain types | unit | `src/domain/*.test.ts` | `npx vitest run` |
| Domain services | unit | `src/domain/*.test.ts` | `npx vitest run` |

**Quick gate**: `npx vitest run`
**Coverage gate**: `npx vitest run --coverage` (target ≥ 80% on `src/domain/`)

---

## Task Breakdown

### T1: Scaffold main app with Vite + React + TypeScript + Vitest

**What**: Create the main app project at repo root with Vite, React, TypeScript (strict), Vitest, ESLint, and Prettier. Establish the `src/domain/` directory structure.
**Where**: repo root (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/`)
**Depends on**: None
**Reuses**: None
**Requirement**: Prerequisite for all DOM-* requirements

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `package.json` with React, TypeScript, Vitest, ESLint, Prettier
- [ ] `tsconfig.json` with `strict: true`
- [ ] `vite.config.ts` with React plugin
- [ ] `vitest.config.ts` configured
- [ ] `.eslintrc` / `eslint.config.js` configured
- [ ] `.prettierrc` configured
- [ ] `src/domain/` directory exists
- [ ] `npx vitest run` succeeds (even with no tests)
- [ ] `npx tsc --noEmit` succeeds
- [ ] `npm run build` succeeds

**Tests**: none (scaffold)
**Gate**: `npm run build && npx vitest run`

**Commit**: `chore: scaffold vite + react + typescript + vitest app`

---

### T2: Money type with integer-cent arithmetic

**What**: Create a Money value type that stores amounts as integer cents, with creation from strings/numbers, arithmetic (add, subtract, negate, abs), comparison, and display formatting.
**Where**: `src/domain/money.ts`, `src/domain/money.test.ts`
**Depends on**: T1
**Reuses**: None
**Requirement**: DOM-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Money` type defined (branded number or class wrapping integer cents)
- [ ] `Money.fromCents(n)` creates from integer
- [ ] `Money.fromDecimal(s)` creates from string like "150.75" → 15075 cents
- [ ] `add(a, b)`, `subtract(a, b)`, `negate(a)`, `abs(a)` — all exact integer arithmetic
- [ ] `format(money, locale?)` returns display string with 2 decimals and grouping
- [ ] `toCents(money)` returns the raw integer
- [ ] Negative values work correctly (e.g., credit card balances)
- [ ] Gate check passes: `npx vitest run src/domain/money.test.ts`
- [ ] Test count: ≥ 8 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): money type with integer-cent arithmetic`

---

### T3: Category and Tag models [P]

**What**: Create Category (hierarchical, typed) and Tag (flat, colored) domain types with factory functions and validation.
**Where**: `src/domain/category.ts`, `src/domain/tag.ts`, `src/domain/category.test.ts`, `src/domain/tag.test.ts`
**Depends on**: T1
**Reuses**: None
**Requirement**: DOM-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Category` type: id, parentId (optional), name, type ('revenue' | 'expense'), description (optional)
- [ ] `CategoryType` discriminated union: 'revenue' | 'expense'
- [ ] `createCategory(params)` factory with validation (name required, type required)
- [ ] `Tag` type: id, name, color (hex string, default '#808080')
- [ ] `createTag(params)` factory with validation
- [ ] Gate check passes: `npx vitest run src/domain/category.test.ts src/domain/tag.test.ts`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): category and tag models`

---

### T4: Account model

**What**: Create Account domain type with account type discriminated union, factory function, and immutable initial balance.
**Where**: `src/domain/account.ts`, `src/domain/account.test.ts`
**Depends on**: T2
**Reuses**: `src/domain/money.ts` (Money type)
**Requirement**: DOM-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `AccountType` union: 'bank' | 'credit_card' | 'wallet' | 'transitional'
- [ ] `Account` type: id, name, type (AccountType), initialBalance (Money), isActive (boolean), description (optional)
- [ ] `createAccount(params)` factory with validation
- [ ] `initialBalance` is `Readonly` — cannot be mutated after creation
- [ ] Exhaustive switch on `AccountType` compiles (never guard)
- [ ] Gate check passes: `npx vitest run src/domain/account.test.ts`
- [ ] Test count: ≥ 5 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): account model with type-safe account types`

---

### T5: Transaction model [P]

**What**: Create Transaction domain type with credit/debit discriminated union, factory function, and positive-amount constraint.
**Where**: `src/domain/transaction.ts`, `src/domain/transaction.test.ts`
**Depends on**: T2
**Reuses**: `src/domain/money.ts` (Money type)
**Requirement**: DOM-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `TransactionType` union: 'credit' | 'debit'
- [ ] `Transaction` type: id, accountId, categoryId (optional), amount (Money, always positive), description, transactionDate (string ISO date), settledDate (optional), type (TransactionType), externalId (optional)
- [ ] `createTransaction(params)` factory — validates amount > 0, rejects zero/negative
- [ ] Type narrowing works on `transaction.type`
- [ ] Gate check passes: `npx vitest run src/domain/transaction.test.ts`
- [ ] Test count: ≥ 6 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): transaction model with credit/debit types`

---

### T6: Balance calculation and snapshot service

**What**: Create pure functions for computing account balance at a date (using snapshot-based formula) and computing/updating monthly snapshots.
**Where**: `src/domain/balance.ts`, `src/domain/balance.test.ts`
**Depends on**: T4, T5
**Reuses**: `src/domain/money.ts`, `src/domain/account.ts`, `src/domain/transaction.ts`
**Requirement**: DOM-05, DOM-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `AccountBalance` type: accountId, year, month, closingBalance (Money)
- [ ] `calculateBalance(account, transactions, snapshots, targetDate)` — pure function
- [ ] Uses most recent snapshot before target date as base (or initialBalance if none)
- [ ] Adds credits, subtracts debits from base
- [ ] Credit card scenarios produce negative balances correctly
- [ ] Cross-month boundary calculations use correct snapshot
- [ ] `computeMonthSnapshot(account, transactions, snapshots, year, month)` — returns updated/new snapshot
- [ ] Snapshot = previous snapshot (or initialBalance) + credits - debits for that month
- [ ] Gate check passes: `npx vitest run src/domain/balance.test.ts`
- [ ] Test count: ≥ 12 tests pass (normal, credit card, cross-month, empty, snapshot update, no-snapshot)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): balance calculation and snapshot service`

---

### T7: Auto-categorization types [P]

**What**: Create domain types for auto-categorization rules, learned patterns, and correction records.
**Where**: `src/domain/auto-categorization.ts`
**Depends on**: T3
**Reuses**: `src/domain/category.ts` (Category type references)
**Requirement**: DOM-07 (types only), DOM-08 (types only)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `AutoCategoryRule` type: id, pattern, categoryId, priority, isActive
- [ ] `LearnedCategoryPattern` type: id, categoryId, keyword, occurrenceCount, confidenceScore (0-100), firstLearnedAt, lastMatchedAt, isActive
- [ ] `CorrectionType` union: 'override' | 'manual_assign' | 'reject_suggestion'
- [ ] `AutoCategoryCorrection` type: id, transactionId, originalCategoryId (optional), correctedCategoryId, descriptionText, correctionType, confidenceAtCorrection (optional)
- [ ] `CategorizationSuggestion` type: categoryId, confidence, source ('explicit_rule' | 'learned_pattern')
- [ ] All types compile with strict mode, no `any`

**Tests**: none (pure type definitions — no runtime behavior)
**Gate**: `npx tsc --noEmit`

**Commit**: `feat(domain): auto-categorization types`

---

### T8: Auto-categorization service with learning [P]

**What**: Create pure functions for suggesting a category from rules/patterns and for updating learned patterns from user corrections.
**Where**: `src/domain/auto-categorization-service.ts`, `src/domain/auto-categorization-service.test.ts`
**Depends on**: T5, T7
**Reuses**: `src/domain/auto-categorization.ts`, `src/domain/transaction.ts`
**Requirement**: DOM-07, DOM-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `suggestCategory(description, rules, patterns)` — pure function returning `CategorizationSuggestion | null`
- [ ] Checks explicit rules first in priority order (lowest number = highest priority)
- [ ] Pattern matching is case-insensitive substring
- [ ] First matching rule wins with confidence ≥ 80
- [ ] Falls back to learned patterns if no rule matches
- [ ] Highest confidence pattern wins if confidence ≥ 70
- [ ] Returns null if nothing matches
- [ ] `processCorrection(correction, existingPatterns)` — returns updated/new learned patterns
- [ ] Extracts keywords from description text
- [ ] Increments occurrenceCount for existing keyword+category pairs
- [ ] Creates new patterns for unknown keywords (occurrenceCount=1)
- [ ] Confidence formula: `min(95, 50 + (occurrenceCount * 5) + recencyBonus)`
- [ ] Gate check passes: `npx vitest run src/domain/auto-categorization-service.test.ts`
- [ ] Test count: ≥ 10 tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(domain): auto-categorization service with learning`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1

Phase 2 (Parallel):
  T1 complete, then:
    ├── T2 (Money)
    └── T3 (Category + Tag) [P]

Phase 3 (Parallel):
  T2 complete, then:
    ├── T4 (Account)
    └── T5 (Transaction) [P]
  T3 complete, then:
    └── T7 (AutoCat types) [P]

Phase 4 (Parallel):
  T4, T5 complete, then:
    └── T6 (Balance + Snapshot)
  T5, T7 complete, then:
    └── T8 (AutoCat service + learning) [P]
```

**Parallelism notes:**
- T2/T3 are independent types — fully parallel
- T4/T5 both need Money but not each other — parallel
- T7 needs Category but not Money/Account/Transaction — parallel with T4/T5
- T6 and T8 target different services with no shared mutable state — parallel
- All tests are unit tests (Vitest) — parallel-safe

---

## Validation

### Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: Scaffold app | 1 project scaffold | ✅ Granular |
| T2: Money type | 1 type + functions (1 file) | ✅ Granular |
| T3: Category + Tag | 2 small related types (2 files) | ⚠️ Acceptable — both are classification types, cohesive |
| T4: Account model | 1 type (1 file) | ✅ Granular |
| T5: Transaction model | 1 type (1 file) | ✅ Granular |
| T6: Balance + Snapshot | 2 related functions (1 file) | ⚠️ Acceptable — snapshot IS balance logic |
| T7: AutoCat types | 5 type definitions (1 file) | ✅ Granular (pure types, no logic) |
| T8: AutoCat service + learning | 2 related functions (1 file) | ⚠️ Acceptable — learning feeds suggestion |

### Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|------|------------------------|---------------|--------|
| T1 | None | No incoming arrows | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T2 | T2 → T4 | ✅ Match |
| T5 | T2 | T2 → T5 | ✅ Match |
| T6 | T4, T5 | T4, T5 → T6 | ✅ Match |
| T7 | T3 | T3 → T7 | ✅ Match |
| T8 | T5, T7 | T5, T7 → T8 | ✅ Match |

### Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|------|-----------|----------------|-----------|--------|
| T1 | Scaffold | N/A | none | ✅ OK |
| T2 | Domain type | unit | unit | ✅ OK |
| T3 | Domain type | unit | unit | ✅ OK |
| T4 | Domain type | unit | unit | ✅ OK |
| T5 | Domain type | unit | unit | ✅ OK |
| T6 | Domain service | unit | unit | ✅ OK |
| T7 | Domain type (pure types) | none | none | ✅ OK |
| T8 | Domain service | unit | unit | ✅ OK |
