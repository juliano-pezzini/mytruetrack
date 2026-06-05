# Phase 8.7 — UI Port Tasks

**Spec**: `.specs/features/8.7-ui-port/spec.md`  
**Status**: Draft

---

## Test Strategy

- **No component unit tests** in this phase. UI is validated via:
  - `npx tsc --noEmit` (type-check)
  - `npx vite build` (build succeeds)
  - Manual smoke test (`npx vite dev`)
  - Playwright e2e in Phase 8.8
- **Data hooks** could have unit tests but are thin wrappers — coverage comes from repository tests (Phase 8.3).
- **Gate check**: `npx tsc --noEmit && npx vite build && npx vitest run`

---

## Execution Plan

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

Sequential — each task builds on the previous. T5–T8 are independent pages but share patterns from T4 (hooks) and T3 (layout).

---

## Task Breakdown

### T1: Tailwind CSS v4 setup

**What**: Install Tailwind CSS v4, configure Vite plugin, create global CSS file.
**Where**: `package.json`, `vite.config.ts`, `src/ui/styles/index.css`, `src/main.tsx`, `index.html`
**Depends on**: None
**Requirement**: UI-01

**Done when**:
- [ ] `tailwindcss` + `@tailwindcss/vite` installed
- [ ] Vite config includes `@tailwindcss/vite` plugin
- [ ] `src/ui/styles/index.css` created with `@import "tailwindcss"`
- [ ] CSS imported in `src/main.tsx`
- [ ] `index.html` has base font / body classes
- [ ] `App.tsx` renders a Tailwind-styled element (smoke test)
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T2: Database context provider

**What**: Create `DatabaseProvider` and `useDatabase()` hook. Initializes the database on mount and provides it via React Context.
**Where**: `src/app/database-provider.tsx`, `src/ui/hooks/useDatabase.ts`
**Depends on**: T1
**Reuses**: `initDatabase()` from `src/storage/init.ts`
**Requirement**: UI-02

**Done when**:
- [ ] `DatabaseContext` created with `Database | null`
- [ ] `DatabaseProvider` calls `initDatabase()` in `useEffect`, stores result
- [ ] Shows loading state while initializing
- [ ] `useDatabase()` hook throws if used outside provider or before init
- [ ] `App.tsx` wraps content in `DatabaseProvider`
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (integration — tested via e2e)
**Gate**: build

---

### T3: React Router + Layout shell

**What**: Configure React Router with route definitions. Build app shell with sidebar navigation and header.
**Where**: `src/app/router.tsx`, `src/ui/components/Layout.tsx`, `src/ui/components/Sidebar.tsx`, `src/main.tsx`, `src/App.tsx`
**Depends on**: T2
**Requirement**: UI-01

**Done when**:
- [ ] Routes defined: `/` (Dashboard), `/accounts`, `/transactions`, `/categories`, `/settings`
- [ ] `Layout` component wraps all routes (sidebar + header + `<Outlet />`)
- [ ] `Sidebar` with nav links, active route highlighting
- [ ] Responsive: sidebar visible on desktop, collapsible on mobile
- [ ] Page title in header updates per route
- [ ] Placeholder page components for each route
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T4: Data hooks

**What**: Create React hooks that bridge components to SQLite repositories.
**Where**: `src/ui/hooks/useAccounts.ts`, `src/ui/hooks/useTransactions.ts`, `src/ui/hooks/useCategories.ts`, `src/ui/hooks/useTags.ts`, `src/ui/hooks/useAccountBalance.ts`
**Depends on**: T2
**Reuses**: All repositories from `src/storage/repositories/`, `calculateBalance` from `src/domain/balance.ts`
**Requirement**: UI-03

**Done when**:
- [ ] `useAccounts()` → `{ accounts, create, update, remove, refresh, loading }`
- [ ] `useTransactions(accountId, dateRange?)` → `{ transactions, create, update, remove, refresh, loading }`
- [ ] `useCategories()` → `{ categories, create, update, remove, refresh, loading }`
- [ ] `useTags()` → `{ tags, create, update, remove, refresh, loading }`
- [ ] `useAccountBalance(accountId, date)` → `{ balance, loading }`
- [ ] All hooks auto-fetch on mount and re-fetch after mutations
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (thin wrappers)
**Gate**: build

---

### T5: Accounts page

**What**: List accounts with balances, create/edit forms, soft-delete.
**Where**: `src/ui/pages/AccountsPage.tsx`, `src/ui/components/AccountForm.tsx`, `src/ui/components/MoneyDisplay.tsx`, `src/ui/components/ConfirmDialog.tsx`
**Depends on**: T3, T4
**Requirement**: UI-04

**Done when**:
- [ ] Account list table: name, type badge, balance
- [ ] "New Account" button opens form (inline or modal)
- [ ] Account form: name (text), type (select), initial balance (number), description (text)
- [ ] Edit button per row
- [ ] Delete button with confirmation dialog
- [ ] Type filter buttons (All / Bank / Credit Card / Wallet)
- [ ] `MoneyDisplay` component: formats cents as currency, red for negative
- [ ] `ConfirmDialog` reusable component
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T6: Transactions page

**What**: Transaction list with date filtering, CRUD, category assignment.
**Where**: `src/ui/pages/TransactionsPage.tsx`, `src/ui/components/TransactionForm.tsx`
**Depends on**: T5 (reuses MoneyDisplay, ConfirmDialog)
**Requirement**: UI-05

**Done when**:
- [ ] Account selector (dropdown) at top
- [ ] Date range filter (month/year picker, defaults to current month)
- [ ] Transaction list: date, description, amount (green credit / red debit), category
- [ ] "New Transaction" button opens form
- [ ] Transaction form: amount, description, date, type (credit/debit), category (select)
- [ ] Edit / Delete per row
- [ ] Running balance column
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T7: Categories & Tags page

**What**: Two-tab page for managing categories and tags.
**Where**: `src/ui/pages/CategoriesPage.tsx`, `src/ui/components/CategoryForm.tsx`, `src/ui/components/TagForm.tsx`
**Depends on**: T5 (reuses ConfirmDialog)
**Requirement**: UI-06

**Done when**:
- [ ] Tab switcher: Categories | Tags
- [ ] Category list with parent/child indentation
- [ ] Category CRUD form: name, type (income/expense), parent (select), description
- [ ] Tag list with color swatches
- [ ] Tag CRUD form: name, color (input type=color)
- [ ] Delete with confirmation (categories: block if has children)
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T8: Dashboard page

**What**: Overview page with account summaries, net worth, recent transactions, monthly income/expense.
**Where**: `src/ui/pages/DashboardPage.tsx`
**Depends on**: T5 (reuses MoneyDisplay), T4 (hooks)
**Requirement**: UI-07

**Done when**:
- [ ] Account cards: name + type badge + balance
- [ ] Net worth card: sum of all active account balances
- [ ] Recent transactions: last 10 across all accounts
- [ ] Monthly summary: total income vs total expenses for current month
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

### T9: Settings page

**What**: Settings page with import functionality and placeholders.
**Where**: `src/ui/pages/SettingsPage.tsx`, `src/ui/components/ImportSection.tsx`
**Depends on**: T4
**Reuses**: `parseOfx`, `parseXlsx`, `importTransactions` from `src/workers/`
**Requirement**: UI-08

**Done when**:
- [ ] Import section: file picker (accept .ofx, .xlsx)
- [ ] Parse preview: show parsed transaction count + first few rows
- [ ] Account selector for import target
- [ ] Import button → calls `importTransactions`, shows result (imported/skipped/errors)
- [ ] Placeholder sections: Sync (coming soon), Security (coming soon), About (version)
- [ ] Gate: `npx tsc --noEmit && npx vite build`

**Tests**: none (visual)
**Gate**: build

---

## Validation

### Diagram-Definition Cross-Check

| Task | Depends on (definition) | Depends on (diagram) | Match |
|------|------------------------|---------------------|-------|
| T1 | None | None | ✅ |
| T2 | T1 | T1 | ✅ |
| T3 | T2 | T2 | ✅ |
| T4 | T2 | T2 | ✅ |
| T5 | T3, T4 | T4 | ✅ |
| T6 | T5 | T5 | ✅ |
| T7 | T5 | T5 | ✅ |
| T8 | T5, T4 | T5 | ✅ |
| T9 | T4 | T4 | ✅ |

### Granularity Check

| Task | Files created/modified | Single concept | Atomic |
|------|----------------------|----------------|--------|
| T1 | 4 (deps + config + css + main) | Tailwind setup | ✅ |
| T2 | 2 (provider + hook) | DB context | ✅ |
| T3 | 4 (router + layout + sidebar + main) | App shell | ✅ |
| T4 | 5 (one hook per entity) | Data hooks | ✅ |
| T5 | 3 (page + form + shared components) | Accounts UI | ✅ |
| T6 | 2 (page + form) | Transactions UI | ✅ |
| T7 | 3 (page + 2 forms) | Categories/Tags UI | ✅ |
| T8 | 1 (page) | Dashboard UI | ✅ |
| T9 | 2 (page + import section) | Settings UI | ✅ |
