# GitHub Copilot Instructions for mytruetrack

## Project Overview

**mytruetrack** is a local-first, privacy-respecting personal finance PWA. All data lives in the browser (SQLite-WASM), is end-to-end encrypted, and syncs via user-owned cloud storage. There is **no backend**.

Successor to [truetrack](https://github.com/juliano-pezzini/truetrack) (Laravel/PHP/PostgreSQL). v2 abandons that stack entirely — see `.specs/project/STATE.md` (AD-001, AD-002) for the architectural decisions.

## Stack

- **Language:** TypeScript (strict mode)
- **UI:** React 18+ with React Router
- **Build:** Vite
- **Styling:** Tailwind CSS
- **Local DB:** SQLite-WASM (`@sqlite.org/sqlite-wasm`) with cr-sqlite (`@vlcn.io/crsqlite-wasm`) for CRDT
- **Key-value:** IndexedDB (via `idb`)
- **Crypto:** Web Crypto API (AES-GCM, PBKDF2); optional Argon2-WASM
- **Auth (local unlock):** WebAuthn platform authenticator (Touch ID / Windows Hello / Android biometric)
- **Cloud sync:** Pluggable `CloudProvider` interface (Google Drive `appDataFolder` + WebDAV at launch)
- **Imports:** `ofx-js` (or hand-rolled), `xlsx` / `exceljs` — both run in Web Workers
- **Testing:** Vitest (unit), Playwright (e2e)
- **Lint/format:** ESLint + Prettier

## Critical Domain Rules — Personal Finance Balance Logic

**This is non-negotiable and ported verbatim from v1.**

### Transaction direction

- `credit` → **INCREASES** account balance (income, deposit, refund, payment received on credit card)
- `debit` → **DECREASES** account balance (expense, withdrawal, purchase on credit card)

This is **personal-finance logic**, not double-entry-bookkeeping logic. A purchase on a credit card is a `debit` on that credit card account (balance becomes more negative = more owed). A payment from a bank to a credit card is `debit` on the bank account and `credit` on the credit card account.

### Account types

- `bank` — checking / savings (normally positive)
- `credit_card` — normally **negative** (amount owed); reaches 0 only when fully paid
- `wallet` — cash on hand (positive)
- `transitional` — temporary, used for transfers

### Balance formula

```
balance(date) = base_balance + sum(credits) - sum(debits)   // over [base_date, date]
```

`base_balance` comes from the most recent monthly snapshot in `account_balances` (or `accounts.initial_balance` if no snapshot exists). Always update / create the current month's snapshot after writing a transaction.

### Money representation

Store amounts as **integer cents** (`number` or `bigint`), never floats. Format for display only.

## Architectural Constraints

1. **No backend, ever.** Anything you build must run in the browser.
2. **Cloud never sees plaintext.** Encrypt before upload; decrypt after download. The user's passphrase-derived key is the only path to data.
3. **CRDT means no merge prompts.** Conflict-free is the user-facing guarantee. If you find yourself prompting the user to resolve a conflict, the design is wrong.
4. **Web Workers for heavy work.** Statement parsing, large imports, encryption of large blobs — all off the main thread.
5. **Strict TypeScript.** No `any`. No implicit returns. Exhaustive switches with `never` guards.
6. **Pure domain layer.** Domain services (balance, categorization) take inputs and return outputs — no I/O, no DB calls. Repositories sit between domain and SQLite.

## Code Style & Conventions

### TypeScript

- `strict: true` in `tsconfig.json`
- Prefer `type` over `interface` for data shapes; `interface` for nominal contracts
- Use `Readonly<T>` / `readonly` aggressively for immutable data
- Use discriminated unions for variants (e.g., `TransactionType = 'credit' | 'debit'`)
- Use `zod` (or similar) at trust boundaries (file imports, cloud-restored blobs, user input)

### React

- Functional components + hooks only
- Co-locate component + test (`Foo.tsx` + `Foo.test.tsx`)
- Extract data fetching / persistence into hooks (`useAccount`, `useTransactions`)
- No Redux unless complexity demands it; React Context + `useReducer` first

### File organization (target)

```
src/
├── domain/          # pure logic: types, balance, categorization
├── storage/         # SQLite + cr-sqlite repositories
├── crypto/          # key derivation, wrap/unwrap, AES-GCM
├── sync/            # CloudProvider interface + implementations
│   └── providers/   # google-drive, webdav
├── workers/         # web workers (imports, encryption)
├── ui/              # components, pages, layouts
│   ├── components/
│   ├── pages/
│   └── hooks/
└── app/             # bootstrap, router
```

### Naming

- Components: `PascalCase` (`AccountForm.tsx`)
- Hooks: `useCamelCase` (`useAccountBalance.ts`)
- Pure functions: `camelCase` (`calculateBalance`)
- Types: `PascalCase` (`Account`, `TransactionType`)
- DB tables: `snake_case` plural (`accounts`, `transactions`, `account_balances`)
- Constants: `UPPER_SNAKE` (`MAX_TRANSACTION_AMOUNT`)

## Testing

- **Domain layer:** ≥ 80% coverage. Test balance edge cases (month boundaries, snapshot rollover, credit-card payment scenarios).
- **Storage layer:** integration tests against in-memory SQLite-WASM
- **Crypto layer:** test wrap/unwrap round-trips, recovery flow
- **Sync layer:** mock `CloudProvider`; test conflict-free convergence with simulated two-device scenarios
- **E2E (Playwright):** onboarding flow, transaction CRUD, import flow, sync flow

## Security

- **No `eval`, no `Function()` constructor**
- **CSP:** strict; no inline scripts; allow only the cloud provider origins needed
- **Crypto:** non-extractable Web Crypto keys where possible; never log keys / passphrases
- **WebAuthn:** platform authenticators only (no roaming for v1); user verification required
- **OAuth (Google Drive):** PKCE flow; minimal scope (`drive.appdata`); no client secret in source
- **Imports:** parse in Web Worker (isolates parser bugs); validate parsed data with `zod` before persisting
- **Dependency audit:** use `audit-ci` (not `npm audit` directly) — config in `audit-ci.jsonc`. New advisories must be either fixed or explicitly allowlisted with a documented rationale and a linked TODO to resolve them.

## Git Conventions

- **All changes must be made via Pull Requests.** Direct commits to `main` are not allowed.
- Commits: `feat:` / `fix:` / `test:` / `refactor:` / `docs:` / `chore:` / `perf:` / `spike:`
- Branches: `feat/<short-desc>`, `fix/<short-desc>`, `spike/<short-desc>`
- **Before every commit, you MUST run all quality checks locally:** typecheck, lint, unit tests, e2e tests (when present), and `audit-ci` security audit. Do not commit if any check fails.
- PRs must pass the same checks in CI. Local passing is a prerequisite, not a substitute.

## Spec-Driven Workflow

This repo uses the `tlc-spec-driven` workflow. Before implementing any non-trivial feature:

1. Check `.specs/project/STATE.md` for current focus and decisions
2. Check `.specs/features/<feature>/spec.md` (create one if missing)
3. Update `STATE.md` when recording architectural decisions (AD-NNN entries)

## What This Project Is NOT

- Not a shared / household finance tool (single user per device)
- Not a real-time bank-feed app (no Plaid)
- Not a server with login (no accounts, no email reset)
- Not a native mobile app (PWA covers it)
- Not a v1 migration target (no production users to migrate)

## When You Encounter Ambiguity

1. Check `.specs/project/PROJECT.md` (Constraints, Scope)
2. Check v1 phase docs (linked from `.specs/project/PROJECT.md`) — the domain knowledge ports forward even though the stack does not
3. If still unclear, write a `quick/` note proposing the decision and ask the user
