# Phase 8.7 — UI Port

**Status**: Draft  
**Depends on**: 8.2 (domain), 8.3 (storage), 8.6 (import service)

---

## Objective

Build the full React UI: app shell with navigation, data hooks bridging React to SQLite repositories, and all core screens (Accounts, Transactions, Categories/Tags, Dashboard, Settings). Tailwind CSS v4 for styling. React Router v7 for routing.

---

## Requirements

### UI-01: App Shell & Navigation

- Responsive sidebar layout: collapsible sidebar on desktop, drawer on mobile
- Navigation links: Dashboard, Accounts, Transactions, Categories, Settings
- App header with page title
- Active route highlighting

### UI-02: Database Context

- `DatabaseProvider` wraps the app, initializes SQLite on mount
- `useDatabase()` hook returns the `Database` instance
- Loading state while DB initializes
- Error boundary for DB init failures

### UI-03: Data Hooks

- `useAccounts()` — CRUD + refresh for accounts list
- `useTransactions(accountId, dateRange?)` — filtered list + CRUD
- `useCategories()` — full category tree + CRUD
- `useTags()` — list + CRUD
- `useAccountBalance(accountId, date)` — computed balance
- Hooks call repositories directly (no state management library)
- Use `useState` + `useCallback` pattern; re-fetch on mutation

### UI-04: Accounts Page

- List all accounts with name, type badge, current balance
- Create account form (name, type, initial balance)
- Edit account inline or via modal
- Soft-delete with confirmation
- Type filters (bank, credit_card, wallet)

### UI-05: Transactions Page

- List transactions for selected account
- Date range filter (month picker, default: current month)
- Create transaction form (amount, description, date, type, category)
- Edit transaction
- Delete with confirmation
- Running balance column
- Category assignment (select from existing categories)

### UI-06: Categories & Tags Page

- Two tabs: Categories | Tags
- Category list with parent/child hierarchy (indented)
- Category CRUD (name, type: income/expense, parent)
- Tag list with color swatches
- Tag CRUD (name, color picker)

### UI-07: Dashboard

- Account cards showing name + current balance
- Total net worth (sum of all active account balances)
- Recent transactions (last 10 across all accounts)
- Monthly summary: income vs expenses for current month

### UI-08: Settings Page

- Import section: file picker → parse OFX/XLSX → preview → import to selected account
- Placeholder sections for: Sync, Security, About
- App version display

---

## Non-Goals

- Onboarding flow (Phase 8.8)
- Sync UI (Phase 8.8/8.9)
- Charts/visualizations beyond basic summary (post-8.10)
- Dark mode (can be added later with Tailwind)
- Internationalization (English only for now)
- Component-level unit tests (Playwright e2e in Phase 8.8 covers UI)

---

## Design Notes

### Tailwind CSS v4

- Uses `@tailwindcss/vite` plugin (no PostCSS config needed)
- Global CSS: `src/ui/styles/index.css` with `@import "tailwindcss"`
- Utility-first approach; minimal custom CSS

### State Management

- React Context for database instance (`DatabaseProvider`)
- Local `useState` + `useEffect` in hooks for data fetching
- No global state store — each page fetches its own data
- Mutations trigger local re-fetch via callback

### File Structure

```
src/
├── app/
│   ├── router.tsx          # route definitions
│   └── database-provider.tsx
├── ui/
│   ├── styles/
│   │   └── index.css
│   ├── components/
│   │   ├── Layout.tsx      # sidebar + header shell
│   │   ├── Sidebar.tsx
│   │   ├── Modal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── MoneyDisplay.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── AccountsPage.tsx
│   │   ├── TransactionsPage.tsx
│   │   ├── CategoriesPage.tsx
│   │   └── SettingsPage.tsx
│   └── hooks/
│       ├── useDatabase.ts
│       ├── useAccounts.ts
│       ├── useTransactions.ts
│       ├── useCategories.ts
│       ├── useTags.ts
│       └── useAccountBalance.ts
```
