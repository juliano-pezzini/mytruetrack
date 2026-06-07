# Roadmap

**Current Milestone:** Phase 8 — Local-First Foundation
**Status:** Phase 8.9 complete — Phase 8.10 next

---

## Phase 8: Local-First Foundation

Goal: ship a working local-first PWA with encrypted multi-device sync and feature parity with v1's core (accounts, transactions, categories, statement import, dashboard).

### 8.1 — Architecture Spike (research) ✅

Validate the riskiest technical bets before committing to the stack. **All 5 bets validated — see [spike-report.md](../features/8.1-architecture-spike/spike-report.md).**

- [x] Prototype cr-sqlite end-to-end with two browser instances syncing via a shared blob
- [x] Prototype WebAuthn-wrapped encryption key (passphrase + biometric unlock)
- [x] Test Google Drive `appDataFolder` upload/download/quota patterns
- [x] Vet `ofx-js` (or pick an alternative) against v1 fixture files
- [x] Measure SQLite-WASM + cr-sqlite bundle size
- [x] Document go/no-go per bet in spike-report.md

### 8.2 — Domain port (TypeScript services) ✅

Port v1's domain logic — pure functions, no I/O. **93 tests, 94% coverage.**

- [x] Money type (integer cents)
- [x] Account / Transaction / Category / Tag models
- [x] Balance calculation service (with monthly snapshot rule)
- [x] Auto-categorization service (port v1 Phase 7 logic)
- [x] Vitest coverage ≥ 80% on services

### 8.3 — Storage layer ✅

SQLite-WASM schema, repository pattern, migration framework. **58 storage tests, 85% branch coverage.**

- [x] SQLite-WASM schema (9 tables: accounts, transactions, categories, tags, transaction_tags, account_balances, auto_category_rules, learned_category_patterns, auto_category_corrections)
- [x] cr-sqlite CRDT-compatible schema (all NOT NULL columns have DEFAULT values)
- [x] Repository pattern over SQL (7 repositories returning domain types)
- [x] Migration framework (versioned, auto-apply on init)

### 8.4 — Crypto layer ✅

Passphrase-based encryption pipeline. **35 crypto tests, 100% line coverage on testable modules.**

- [x] Passphrase → key derivation (PBKDF2, 600k iterations)
- [x] Non-extractable Web Crypto wrap key in IndexedDB (via `idb`)
- [x] WebAuthn biometric unlock flow (typed, browser-only)
- [x] Encrypt/decrypt blob primitives (AES-GCM, random IV)
- [x] Recovery sheet generator (printable HTML, checksum verification)

### 8.5 — Sync layer + Google Drive provider ✅

24 sync tests. CloudProvider interface, sync engine with encrypt/decrypt, Google Drive + OAuth PKCE (browser-only).

- [x] Abstract `CloudProvider` interface + mock in-memory provider
- [x] Sync state persistence (IndexedDB via `idb`)
- [x] Sync engine (export/import snapshots, push/pull with encryption)
- [x] Google Drive provider (`appDataFolder`)
- [x] OAuth 2.0 PKCE flow helpers
- [x] Two-database convergence test verified

### 8.6 — Web Worker imports ✅

29 import tests. OFX parser (bank + credit card), XLSX parser (configurable columns), import service with dedup.

- [x] OFX parser (ofx-js: SGML + XML, bank + credit card statements)
- [x] XLSX parser (xlsx library, configurable column mapping, sign-based type inference)
- [x] Import service (validation, dedup by externalId, batch insert)
- [x] Shared types (ParsedTransaction, ParsedStatement, ImportResult)

### 8.7 — UI port ✅

React UI with all core pages, responsive sidebar, data hooks. 68 modules, builds clean.

- [x] React Router setup + Layout shell (sidebar + header)
- [x] Database context provider + useDatabase hook
- [x] Data hooks (useAccounts, useTransactions, useCategories, useTags, useAccountBalance)
- [x] Accounts page (CRUD, type filter, balance display)
- [x] Transactions page (CRUD, month picker, running balance, category assignment)
- [x] Categories / Tags page (tabbed, parent-child tree, color swatches)
- [x] Dashboard (net worth, account cards, monthly summary, recent transactions)
- [x] Settings page (statement import with preview, placeholder sections)

### 8.8 — Onboarding flow ✅

VaultProvider gate, optional passphrase, setup wizard, unlock page. 6 vault tests.

- [x] VaultProvider + VaultContext (status: loading/needs-setup/needs-unlock/ready, mode: encrypted/local-only)
- [x] VaultGate component (renders SetupWizard, UnlockPage, or main app)
- [x] SetupWizard: Welcome → Choice (passphrase or skip) → Create Passphrase → Recovery Sheet → Biometric → Done
- [x] UnlockPage: passphrase input, biometric button, vault reset
- [x] PassphraseInput (show/hide toggle) + StrengthMeter components
- [x] useVault hook

### 8.9 — WebDAV provider + Sync Settings ✅

WebDAV CloudProvider, sync config persistence, Settings sync UI, optional unencrypted sync. 15 new tests.

- [x] Sync engine updated: `pushChanges`/`pullChanges` accept `dek: CryptoKey | null` (plaintext when null)
- [x] WebDAV CloudProvider (PUT, GET, PROPFIND, DELETE + Basic auth)
- [x] Sync config persistence (IndexedDB: provider type + WebDAV credentials)
- [x] Settings sync UI: provider selector, WebDAV config form, test connection, push/pull buttons, unencrypted warning
- [x] 8 WebDAV provider tests + 5 sync config tests + 2 unencrypted sync engine tests

### 8.10 — PWA + offline polish

- [ ] Manifest + icons
- [ ] Service worker (cache app shell, queue sync ops when offline)
- [ ] Install prompts
- [ ] Cross-browser QA (Chrome, Edge, Safari, Firefox)
- [ ] Release v2.0.0

---

## Future Considerations (post-Phase 8)

- Bulk select + delete/edit for CRUD screens (accounts, transactions, categories, tags)
- Dashboard account balance graph: horizontal bar per account showing past 3 months + 1 month projected
- OneDrive provider
- Dropbox provider
- Multi-currency with exchange rates
- Budget planning module
- Recurring transaction templates
- Investment portfolio tracking (manual)
- PDF report export
- Encrypted-export-to-CSV (decrypt locally before sharing)

## Explicitly Dropped (architectural trade-offs)

- Shared / household accounts
- Real-time bank feeds (Plaid)
- Server-pushed notifications
- Native mobile apps (PWA covers it)
