# Playwright E2E Tests

**Spec**: inline (no separate spec file — this is a testing phase, not a feature)  
**Status**: Draft  
**Depends on**: Phase 8 complete (all features built)

---

## Test Strategy

- **Framework**: Playwright (`@playwright/test`)
- **Browser**: Chromium only (cross-browser deferred)
- **Mode**: Headless, with `webServer` directive in config to auto-start Vite dev server
- **Isolation**: Each test file clears IndexedDB + localStorage in `beforeEach`
- **Speed**: Most tests use local-only mode (skip passphrase) to avoid 2s PBKDF2 per test
- **Sync e2e**: Skipped (needs real WebDAV server; unit tests provide coverage)
- **Gate**: `npx playwright test`

---

## Setup

### Install

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Config (`playwright.config.ts`)

```ts
- baseURL: http://localhost:5173
- webServer: { command: 'npx vite dev', port: 5173 }
- projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
- retries: 0 (local), 2 (CI)
```

### Scripts (`package.json`)

```json
"test:e2e": "npx playwright test",
"test:e2e:headed": "npx playwright test --headed"
```

---

## Execution Plan

```
T1 (setup) → T2 (onboarding) → [T3, T4, T5] parallel → [T6] → T7 (gate)
```

---

## Task Breakdown

### T1: Install + Config

**Done when**:

- [ ] `@playwright/test` installed as devDep
- [ ] `playwright.config.ts` created
- [ ] `e2e/` directory created
- [ ] `e2e/fixtures/sample.ofx` created (minimal OFX fixture)
- [ ] `test:e2e` script in package.json
- [ ] `npx playwright test` runs (0 tests, no errors)

---

### T2: Onboarding tests

**File**: `e2e/setup-and-unlock.spec.ts`

**Tests**:

- [ ] Setup wizard: local-only path (skip passphrase) → dashboard loads
- [ ] Setup wizard: passphrase path → create passphrase → recovery step → done → dashboard
- [ ] Unlock: create vault → reload page → enter passphrase → dashboard loads
- [ ] Unlock: wrong passphrase → error message shown
- [ ] Vault reset: unlock page → "Reset vault" → confirm → setup wizard appears

---

### T3: Accounts CRUD

**File**: `e2e/accounts.spec.ts`

**Tests**:

- [ ] Create account (bank) → visible in table with correct type badge
- [ ] Create account (credit card) → visible with type badge
- [ ] Edit account name → table updates
- [ ] Delete account → confirm dialog → account gone
- [ ] Type filter buttons work (All, Bank, Credit Card, Wallet)

---

### T4: Transactions CRUD

**File**: `e2e/transactions.spec.ts`

**Tests**:

- [ ] Create debit transaction → visible in table, running balance decreases
- [ ] Create credit transaction → running balance increases
- [ ] Month navigation (prev/next) → table filters correctly
- [ ] Edit transaction amount → running balance updates
- [ ] Delete transaction → confirm → gone, balance updates

---

### T5: Categories & Tags CRUD

**File**: `e2e/categories-tags.spec.ts`

**Tests**:

- [ ] Create parent category → visible in list
- [ ] Create child category → indented under parent
- [ ] Edit category name → updates
- [ ] Delete child → gone, parent stays
- [ ] Create tag with color → color swatch visible
- [ ] Edit tag → updates
- [ ] Delete tag → gone

---

### T6: Dashboard + Import + Navigation

**File**: `e2e/dashboard.spec.ts`

- [ ] Create account + transactions → dashboard shows net worth, account card, monthly summary, recent transactions

**File**: `e2e/import.spec.ts`

- [ ] Select account → upload .ofx fixture → preview shows transactions → import → success result

**File**: `e2e/navigation.spec.ts`

- [ ] Sidebar links navigate to correct pages
- [ ] Page titles update per route
- [ ] Mobile viewport: hamburger opens/closes sidebar

---

### T7: Final gate

**Done when**:

- [ ] `npx playwright test` — all tests pass
- [ ] `npx tsc --noEmit && npx vite build && npx vitest run` — existing 266 tests still pass
- [ ] Update STATE.md, ROADMAP.md
