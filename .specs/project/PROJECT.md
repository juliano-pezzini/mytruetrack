# Project: mytruetrack

## Vision

A personal finance tracker that respects privacy absolutely: data is stored locally, encrypted end-to-end, and synced through cloud storage the user already owns. No servers, no accounts, no third-party data access — and no hosting bills.

## Goals

- **Privacy by architecture** — data never reaches a server we control; cloud copies are encrypted blobs
- **Local-first UX** — instant, offline-capable, no spinners waiting on networks
- **Truthful accounting** — preserve v1's personal-finance balance model (credit increases, debit decreases; monthly snapshots; auto-categorization)
- **Multi-device** — seamless sync across phone, tablet, desktop via user-owned cloud
- **Zero ongoing cost** — static hosting only; no databases, no queues, no API tier
- **Easy onboarding** — biometric unlock after first-time passphrase setup; printable recovery sheet

## Non-Goals (Out of Scope)

- Multi-user / shared accounts (single user per device + cloud sync for multi-device)
- Real-time bank feeds (Plaid, Yodlee, Open Banking) — requires a server
- Server-pushed notifications (email reminders, SMS alerts) — requires a server
- Native mobile apps (PWA covers it)
- Migration tooling from v1 (no production users to migrate)
- Investment portfolio live pricing (manual entry only at launch)

## Scope (What We're Building)

### Phase 8: Local-First Foundation (current milestone)

Build the core local-first engine and port domain logic from v1.

- TypeScript domain layer (accounts, transactions, categories, balance calculation, monthly snapshots)
- SQLite-WASM storage with cr-sqlite (CRDT) for conflict-free multi-device sync
- Encryption layer (passphrase → PBKDF2/Argon2 → key wrapped by non-extractable Web Crypto key in IndexedDB; unlocked via WebAuthn)
- Pluggable cloud sync (abstract provider interface)
- Google Drive (`appDataFolder`) and WebDAV provider implementations
- React UI (port of v1 screens; drop Inertia, add React Router)
- Statement import (OFX + XLSX) running in Web Workers
- Onboarding flow (passphrase, biometric enrollment, cloud connection, recovery sheet)
- PWA manifest + service worker for offline + installability

## Constraints

- **Browser-only runtime** — no Node, no server processes; deployable as static files
- **Personal finance balance logic is law:**
  - `credit` = INCREASES balance (income, deposit, refund, payment received on credit card)
  - `debit` = DECREASES balance (expense, withdrawal, purchase on credit card)
  - Credit cards normally carry NEGATIVE balance (amount owed); reaching zero means paid in full
  - `balance = base_balance + sum(credits) - sum(debits)` from most-recent monthly snapshot
  - Monthly `account_balances` snapshots optimize historical queries
- **Encryption is non-optional** — every byte synced to cloud is ciphertext; cloud providers never see plaintext
- **Recovery passphrase = master key** — losing it means losing data; onboarding must enforce printable/exportable recovery sheet
- **CRDT conflict-free** — sync must never prompt the user to resolve a conflict
- **Money values** — store as integer cents (or `bigint`) to avoid floating-point drift; format for display only
- **Decimal display** — 2 fractional digits; locale-aware grouping

## Stack

| Layer                  | Technology                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Language               | TypeScript (strict mode)                                                           |
| UI framework           | React 18+                                                                          |
| Build tool             | Vite                                                                               |
| Routing                | React Router                                                                       |
| Styling                | Tailwind CSS                                                                       |
| Local DB               | SQLite-WASM (`@sqlite.org/sqlite-wasm`)                                            |
| CRDT layer             | cr-sqlite (`@vlcn.io/crsqlite-wasm`)                                               |
| Key-value / blob store | IndexedDB (via `idb`)                                                              |
| Crypto                 | Web Crypto API (AES-GCM, PBKDF2; Argon2 via WASM if needed)                        |
| Auth (local unlock)    | WebAuthn (platform authenticator: Touch ID, Windows Hello, Android biometric)      |
| Cloud sync             | Pluggable provider interface; v1 providers: Google Drive (`appDataFolder`), WebDAV |
| Statement parsing      | `ofx-js` (or hand-rolled) for OFX; `xlsx` / `exceljs` for XLSX                     |
| Testing                | Vitest (unit) + Playwright (e2e)                                                   |
| Lint / format          | ESLint + Prettier                                                                  |

## Domain Knowledge Carried From v1

- Personal finance balance rules (see Constraints)
- Auto-categorization heuristics (Phase 7 in v1; see [v1 PHASE_07_AUTO_CATEGORIZATION.md](https://github.com/juliano-pezzini/truetrack/blob/main/docs/phases/PHASE_07_AUTO_CATEGORIZATION.md))
- Statement import flow (OFX + XLSX; see v1 phase docs)
- Account types: `bank`, `credit_card`, `wallet`, `transitional`
- Category types and tag taxonomy

## Open Questions (to resolve in Phase 8.1 Architecture Spike)

- Is `cr-sqlite` mature enough for production multi-device sync? Alternatives: hand-rolled op-log CRDT, Automerge, Yjs
- Best path for Argon2 in browser (vs. PBKDF2 with high iteration count)?
- Google Drive `appDataFolder` quota limits — concern at scale?
- WebAuthn key-wrapping pattern — `prf` extension support across platforms?
- Bundle size budget for SQLite-WASM + cr-sqlite + crypto libs (target < 2 MB gzipped)
