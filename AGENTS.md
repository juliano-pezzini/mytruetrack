# mytruetrack

Local-first personal finance PWA. Data lives in the browser, is encrypted before it leaves the device, and syncs through storage the user owns. There is no backend.

Successor to [truetrack](https://github.com/juliano-pezzini/truetrack). The Laravel/PHP/PostgreSQL stack is gone. Architectural decisions are in `.specs/project/STATE.md`.

## Stack

- TypeScript (strict) and React 19
- React Router hash router (`createHashRouter`)
- Vite, Tailwind CSS
- Browser database: `@vlcn.io/crsqlite-wasm` on its IndexedDB `IDBBatchAtomicVFS` (`mytruetrack.db`). Cross-origin isolation is not required. COOP is `same-origin-allow-popups` so the Google sign-in popup can return.
- IndexedDB via `idb` for the keystore and sync bookkeeping
- Web Crypto: PBKDF2 (600000 iterations, SHA-256), AES-KW wrap, AES-GCM
- WebAuthn platform authenticator (PRF preferred, wrapped-key fallback)
- Google sign-in: Google Identity Services token client, scope `drive.appdata`, no client secret in source
- WebDAV as the other `CloudProvider`
- Statement import: `ofx-js` and `xlsx`, parsed in a web worker
- Vitest and Playwright
- ESLint, Prettier, `audit-ci`

## Balance rules

`credit` increases the account balance. `debit` decreases it. This is personal-finance direction, not double-entry. A card purchase is a `debit` on that credit-card account (the balance becomes more negative). A payment from a bank to a card is a `debit` on the bank and a `credit` on the card.

Account types: `bank`, `credit_card` (normally negative), `wallet`, `transitional`.

```
balance(date) = base_balance + sum(credits) - sum(debits)   // over [base_date, date]
```

`base_balance` is the latest monthly snapshot in `account_balances`, or `accounts.initial_balance` when no snapshot exists. Update the current month's snapshot after writing a transaction.

Store money as integer cents. Format only for display.

## Constraints

1. No backend. Everything runs in the browser.
2. The cloud stores ciphertext. The passphrase-derived key is the only path to plaintext.
3. CRDT sync does not ask the user to merge.
4. Heavy parsing runs in a web worker.
5. No `any`. Exhaustive switches end in a `never` check.
6. Domain code takes values and returns values. Repositories are the SQLite boundary.

## Style

- `strict: true`. Prefer `type` for data and `interface` for contracts.
- Immutable data uses `readonly`. Variants are discriminated unions.
- Validate file imports, restored blobs, and other trust boundaries before persisting.
- Function components and hooks. Co-locate `Foo.tsx` and `Foo.test.tsx`.
- Persistence goes through hooks. Context and `useReducer` come before adding a state library.

```
src/
├── domain/          # pure logic
├── storage/         # SQLite repositories and migrations
├── crypto/          # derivation, wrap, AES-GCM
├── sync/            # CloudProvider and providers/
├── workers/         # import workers
├── ui/              # components, pages, hooks
└── app/             # bootstrap, router
```

Components are `PascalCase`, hooks `useCamelCase`, functions `camelCase`, types `PascalCase`, tables `snake_case` plural, constants `UPPER_SNAKE`.

## Testing and security

Domain and sync coverage follow `vitest.config.ts`. Crypto tests cover wrap and unwrap. Sync tests use a fake `CloudProvider`. Playwright covers onboarding, transactions, import, and sync.

No `eval` or `Function`. Do not log keys or passphrases. WebAuthn is platform-only with user verification. Imports are checked before insert. Dependency review uses `audit-ci` (`audit-ci.jsonc`); a new advisory is fixed or allowlisted with a reason and a follow-up.

## Git

Changes land through pull requests. Commit types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`, `spike`. Branch names: `feat/<short>`, `fix/<short>`, `spike/<short>`.

## Where truth lives

Shipped behavior is the source tree plus `.specs/project/` (`PROJECT.md`, `ROADMAP.md`, `STATE.md`). `.specs/features/` is for work that has not shipped. Historical feature write-ups are GitHub issues listed in `.specs/project/spec-archive.md`. Do not recreate a deleted feature folder or treat one as the current product.

When this file and the code disagree, the code wins. Record a new decision in `STATE.md` instead of pasting a feature spec here.

## Out of scope

Single user per device. No bank feeds, no server accounts, no native app, no migration of v1 production data.

## Ambiguity

Read `.specs/project/PROJECT.md`, then `STATE.md`. If both are silent, ask. Do not fill the gap by copying a rejected plan from an old feature folder.
