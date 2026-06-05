# Roadmap

**Current Milestone:** Phase 8 — Local-First Foundation
**Status:** Phase 8.1 complete — Phase 8.2 next

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

### 8.2 — Domain port (TypeScript services)

Port v1's domain logic — pure functions, no I/O.

- [ ] Money type (integer cents)
- [ ] Account / Transaction / Category / Tag models
- [ ] Balance calculation service (with monthly snapshot rule)
- [ ] Auto-categorization service (port v1 Phase 7 logic)
- [ ] Vitest coverage ≥ 80% on services

### 8.3 — Storage layer

- [ ] SQLite-WASM schema (mirrors v1 tables: accounts, transactions, categories, tags, account_balances)
- [ ] cr-sqlite CRDT setup on all tables
- [ ] Repository pattern over SQL
- [ ] Migration framework

### 8.4 — Crypto layer

- [ ] Passphrase → key derivation (PBKDF2 or Argon2)
- [ ] Non-extractable Web Crypto wrap key in IndexedDB
- [ ] WebAuthn biometric unlock flow
- [ ] Encrypt/decrypt blob primitives (AES-GCM)
- [ ] Recovery sheet generator (printable / downloadable)

### 8.5 — Sync layer + Google Drive provider

- [ ] Abstract `CloudProvider` interface
- [ ] Sync engine (push local CRDT changes; pull remote; merge)
- [ ] Google Drive provider (`appDataFolder`)
- [ ] Conflict-free guarantee verified with two-device test

### 8.6 — Web Worker imports

- [ ] OFX import worker
- [ ] XLSX import worker
- [ ] Progress reporting to UI

### 8.7 — UI port

- [ ] React Router setup
- [ ] Layout + nav port from v1
- [ ] Accounts screen
- [ ] Transactions screen
- [ ] Categories / Tags screen
- [ ] Dashboard with monthly charts
- [ ] Settings screen

### 8.8 — Onboarding flow

- [ ] Welcome → passphrase creation → biometric enrollment → recovery sheet → cloud connection → done
- [ ] Restore flow (passphrase + cloud → decrypt → import)

### 8.9 — WebDAV provider

- [ ] WebDAV `CloudProvider` implementation (covers Nextcloud, ownCloud, generic)
- [ ] Settings UI for endpoint + credentials

### 8.10 — PWA + offline polish

- [ ] Manifest + icons
- [ ] Service worker (cache app shell, queue sync ops when offline)
- [ ] Install prompts
- [ ] Cross-browser QA (Chrome, Edge, Safari, Firefox)
- [ ] Release v2.0.0

---

## Future Considerations (post-Phase 8)

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
