# State

**Last Updated:** 2026-07-12
**Current Work:** Local persistence + CRDT delta sync COMPLETE (AD-008) — cr-sqlite via an
IndexedDB-backed VFS, per-site `crsql_changes` delta sync. 330 unit tests, 50 e2e tests, all
passing. Auto-sync (AD-007) and Phase 8 — Local-First Foundation complete prior.

---

## Recent Decisions (Last 60 days)

### AD-009: WebAuthn biometric unlock — PRF preferred, non-extractable wrapped-key fallback (2026-07-12)

**Decision:** Biometric is now a real unlock path, not just an identity check. Two modes,
selected automatically at enrollment (`enrollBiometricUnlock`), both stored as a
discriminated-union `biometric-vault` record in the keystore IndexedDB:

- **`prf` (preferred):** the authenticator is registered with the WebAuthn `prf` extension;
  a `prfSalt` yields 32 secret bytes, HKDF-stretched into a non-extractable AES-KW KEK
  (`deriveKekFromPrf`) that wraps the DEK. Nothing extra is persisted — the KEK only exists
  during a biometric prompt. Requires authenticator PRF/hmac-secret support.
- **`wrapped-key` (fallback):** for authenticators without PRF (e.g. Windows Hello on Win11
  23H2, which reports `prf.enabled === false`). The DEK is wrapped under a random
  **non-extractable** AES-KW `CryptoKey` (`generateWrappingKey`) persisted as a `CryptoKey`
  in IndexedDB; a biometric assertion gates the unlock. The key can never be exported by page
  script, though it is not cryptographically bound to the assertion.

On unlock, `unlockWithBiometric` branches on `mode` and returns a non-extractable DEK, so a tab
discard/reload is unlocked by fingerprint/face with no passphrase. Because `wrapKey` requires an
extractable key, Settings enrollment prompts for the passphrase to derive a *transient*
extractable DEK (`unwrapDekExtractable`) that is wrapped and discarded — the app's working DEK
stays non-extractable. The setup wizard uses the freshly generated (still-extractable) DEK
directly.

**Reason:** "First unlock this session" really meant first unlock since page load — biometric
never worked because it derived no key, and tab discards forced repeated passphrase entry. PRF
is the ideal path but Windows Hello frequently lacks hmac-secret even on Win11 23H2, so a
fallback was needed for biometric to work at all on those machines.

**Trade-off:** No plaintext key or passphrase is ever cached (rejected sessionStorage caching
as an XSS-exposed downgrade). The `wrapped-key` fallback is weaker than PRF — an XSS payload
could invoke the unwrap without the biometric prompt since the assertion is not bound to the
key — but far stronger than storing a plaintext key; strict CSP is the backstop.

**Impact:** `deriveKekFromPrf` / `generateWrappingKey` / `unwrapDekExtractable`
(key-derivation), union `BiometricVault` keystore record, `enrollBiometricUnlock` /
`unlockWithBiometric` (webauthn); SetupWizard, UnlockPage (biometric-first UI), and
SecuritySection (passphrase-gated enrollment) rewired. Verified working with Windows Hello via
the fallback path.

### AD-008: Local persistence + cr-sqlite CRDT delta sync (Phase 8.11) (2026-06-17)

**Decision:** The browser database is now `@vlcn.io/crsqlite-wasm` (cr-sqlite) opened on the
main thread (`mytruetrack.db`) — no Web Worker, no manual WASM copy
(`import wasmUrl from '@vlcn.io/crsqlite-wasm/crsqlite.wasm?url'`). cr-sqlite 0.16 persists
through its **IndexedDB-backed `IDBBatchAtomicVFS`** — it does **not** use OPFS or
`SharedArrayBuffer`, so cross-origin isolation is **not** required. Every syncable table is
registered as a conflict-free replicated relation via `crsql_as_crr`, and cloud sync now ships
**deltas**: each device exports its `crsql_changes` log to a per-site file `changes-<siteid>.bin`
and, on pull, merges every peer file except its own via `INSERT INTO crsql_changes`
(`src/sync/crsql-changes.ts`). A binary/bigint-safe JSON codec handles the blob/bigint columns.
The `Database` interface is now fully async (Promise-returning `exec/execA/execO/close`); Node
tests keep using sql.js (in-memory) through a shared async adapter. The snapshot
export/import path is retained for local backup only.

**Reason:** Data previously lived only in memory / a single re-uploaded snapshot blob, which
had a last-writer-wins overwrite race across devices. cr-sqlite CRDTs give conflict-free
multi-device convergence with no merge prompts, and the IndexedDB VFS gives durable local
persistence.

**Trade-off:** Because no cross-origin isolation is needed, the app uses COOP
`same-origin-allow-popups` (and omits COEP) so the Google Identity Services sign-in popup can
post its token back — COOP `same-origin` + COEP `require-corp` severed the popup's
`window.opener` link and broke Drive sign-in. cr-sqlite is browser-only, so delta sync runs
only in the browser; its protocol is unit-tested with a fake DB + mock provider and the real
merge is spike-verified — a full WebDAV-backed two-device convergence e2e is deferred (needs a
shared cloud test server).

**Impact:** New `src/sync/crsql-changes.ts`; async cutover across storage/repos/hooks/pages;
migration 001 PKs made `NOT NULL` (cr-sqlite rejects nullable PKs); single shared browser DB
connection in `init.ts` (React StrictMode was double-opening the DB and racing migrations).
330 unit tests (+37) and 50 e2e tests (+9) pass; build clean; `audit-ci` clean.

### AD-007: Auto-sync — pull-on-load + debounced push + online retry (2026-06-12)

**Decision:** Sync is now automatic. A framework-agnostic `createAutoSyncController`
(`src/sync/auto-sync-engine.ts`) orchestrates: pull-on-load, a 5s debounced push that
coalesces rapid writes, an in-flight rerun when a write lands mid-push, and a `pending`
flag retried on the browser `online` event. The `AutoSyncProvider`
(`src/app/auto-sync-provider.tsx`, mounted inside `DatabaseProvider`) injects the live DB,
vault DEK, cloud config, and browser events; data hooks call `useAutoSync().notifyChange()`
after writes. Provider construction + Google token refresh were extracted into a shared
`resolveActiveProvider` (`src/sync/active-provider.ts`) reused by both auto-sync and the
manual `SyncSection`. A subtle header `SyncStatusIndicator` surfaces syncing/pending only.

**Reason:** Manual push/pull was error-prone (data loss if user forgets to push, stale data
if they forget to pull). See `.specs/features/auto-sync/spec.md`.

**Trade-off:** Auto-sync failures are logged silently (never block the UI); the indicator
shows nothing when idle to avoid a misleading "synced" badge in local-only mode. No periodic
background timers and no push on `beforeunload` (unreliable) — debounce + online-retry cover it.

**Impact:** Manual push/pull retained as fallback. 5 new files + 4 hooks wired; 293 unit
tests (+27) and 41 e2e tests pass. ASYNC-01..07 all Done.

### AD-006: Google Drive OAuth — GIS token model (Phase 8.10) (2026-06-09)

**Decision:** Wire the existing Drive `CloudProvider` into the Settings sync UI using the
Google Identity Services (GIS) **token model**. GIS loads dynamically on first use, opens
its own consent popup, and returns an access token directly — no auth code, no PKCE, no
client secret, no callback page. Tokens (`accessToken`, `expiresAt`) persist in IndexedDB
via `SyncConfig.google`; on expiry the app silently re-requests via GIS (`prompt:''`) and
falls back to an interactive reconnect if the Google session is gone.
Client ID comes from `VITE_GOOGLE_CLIENT_ID`. No secret in source (truly, now).

**Reason:** The previous PKCE approach required embedding `VITE_GOOGLE_CLIENT_SECRET` in
the JS bundle because Google's "Web application" OAuth clients demand it for code exchange.
GIS eliminates this entirely — only `client_id` + authorized JavaScript origins are needed.

**Trade-off:** Access tokens last ~1 hour with no refresh token; re-authentication requires
an active Google session or user interaction. For a manual push/pull app this is acceptable.
GIS requires loading an external script (`accounts.google.com/gsi/client`) — loaded
dynamically to preserve offline-first boot.

**Impact:** Replaced `google-oauth.ts` (PKCE helpers), `oauth2-callback.html`, and
`VITE_GOOGLE_CLIENT_SECRET`. New `google-gis.ts` (dynamic loader + typed wrapper).
`GoogleTokens` no longer has `refreshToken`; `loadSyncConfig` strips it from old records.

### AD-005: GitHub Actions PR pipeline — quality, tests, build, SAST (2026-06-07)

**Decision:** Add two workflows triggered on every PR targeting `main`:

- **`pr-checks.yml`** — 3 parallel jobs: (1) Prettier format check + ESLint + tsc typecheck; (2) Vitest with 80% coverage thresholds; (3) production Vite build + `npm audit --audit-level=high`.
- **`codeql.yml`** — GitHub CodeQL SAST (`javascript-typescript`, `security-and-quality` query suite). Also runs on pushes to `main` and weekly.

**Reason:** Enforce code quality and prevent regressions automatically. CodeQL catches prototype pollution, ReDoS, injection, and eval-like constructs — critical for a crypto/WebAuthn app. `npm audit` at `high` threshold avoids noisy false positives while blocking real supply-chain risk.

**Trade-off:** CodeQL build step adds ~1–2 min to CI. Accepted for SAST coverage.

**Impact:** All PRs require green checks before merge. Branch protection should be enabled in GitHub Settings → Branches (manual step). Dependabot recommended as follow-up to keep `npm audit` clean over time.

---

### AD-001: Local-first client-only architecture (2026-05-26)

**Decision:** Build mytruetrack as a browser-only PWA. All data lives in SQLite-WASM locally, encrypted with a user passphrase, synced as opaque blobs through user-owned cloud storage (Google Drive, OneDrive, WebDAV). No backend.

**Reason:** Privacy (data never touches our servers), zero hosting costs, offline-first UX, eliminates user-account / password-reset / abuse-monitoring surface area.

**Trade-off:** Loses server-only features — scheduled email notifications, real-time bank feeds, shared/household accounts. Lost master passphrase = unrecoverable data (mitigated via printable recovery sheet during onboarding).

**Impact:** TypeScript/React stack; SQLite-WASM + cr-sqlite (CRDT) + Web Crypto + WebAuthn. Abandons v1's Laravel/PHP/PostgreSQL stack entirely. Domain logic (balance rules, auto-categorization, statement import) ports forward.

### AD-002: Fresh repository, archive v1 (2026-05-26)

**Decision:** Build v2 in this new repo (`mytruetrack`) rather than as a branch or `/v2` folder in [truetrack](https://github.com/juliano-pezzini/truetrack).

**Reason:** Zero technical overlap (PHP vs TypeScript, PostgreSQL vs SQLite-WASM, server vs static). Fresh history, clean tooling, no parallel-stack confusion.

**Trade-off:** Lose linear git history with v1. Mitigated by cross-linking READMEs.

**Impact:** v1 repo becomes reference. Selected artifacts (phase docs, balance logic spec, copilot instructions) ported here adapted to new stack.

### AD-003: Pluggable cloud provider interface; launch with Google Drive + WebDAV (2026-05-26)

**Decision:** Cloud sync is behind an abstract `CloudProvider` interface. v1 ships Google Drive (`appDataFolder`) and WebDAV (one impl covers Nextcloud, ownCloud, and generic WebDAV). OneDrive / Dropbox deferred.

**Reason:** Google Drive maximizes mainstream reach; WebDAV maximizes self-hosted / privacy-conscious reach with minimal code. Interface prevents lock-in.

**Trade-off:** Slightly more abstraction upfront; OAuth-per-provider complexity to plan for later additions.

**Impact:** All sync code talks to the interface; provider implementations are isolated and individually testable.

### AD-004: Stack confirmed — all architecture spike bets validated (2026-06-04)

**Decision:** Proceed with the planned stack. All five technical bets from Phase 8.1 are validated:

- **cr-sqlite** (`@vlcn.io/crsqlite-wasm` v0.16.0): CRDT sync works — 3/3 convergence scenarios pass. Schema constraint: non-PK columns need `DEFAULT` values.
- **Crypto**: PBKDF2 (600k iterations) → AES-KW → AES-GCM pipeline works. 5 MB encrypt/decrypt in 15 ms. WebAuthn PRF not yet supported — fallback to passphrase + session-scoped biometric re-auth.
- **Google Drive `appDataFolder`**: Full CRUD works with `drive.appdata` scope only. 1 MB upload ~2s, download ~1.5s. Production uses auth code + PKCE (not implicit).
- **ofx-js** (v1.1.1): Parses OFX 1.x (SGML) and 2.x (XML) correctly. 15 KB, zero dependencies.
- **Bundle size**: 657 KB gzipped total (33% of 2 MB budget). Ample room for React + UI.

**Reason:** Empirical evidence from throwaway prototypes. See `.specs/features/8.1-architecture-spike/spike-report.md`.

**Trade-off:** cr-sqlite project maintenance should be monitored. Argon2 deferred (PBKDF2 sufficient for launch).

**Impact:** No stack changes needed. Proceed to Phase 8.2 (Domain Port).

---

## Deferred Ideas

- Argon2-WASM for passphrase hashing (PBKDF2 is sufficient; upgrade when bundle budget allows)

---

## Blockers

(none)

---

## Todos

- [x] Run Phase 8.1 Architecture Spike (see `.specs/features/8.1-architecture-spike/spike-report.md`)
- [ ] Set up Vite + React + TypeScript scaffold once spike confirms stack
- [x] Set up ESLint + Prettier + Vitest + Playwright (Playwright E2E: 46 tests, all passing)
- [x] Set up GitHub Actions CI (typecheck, lint, unit tests, e2e) — see AD-005
- [ ] Replace `xlsx` with `exceljs` — `xlsx` has 2 known high CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) with no fix available; currently allowlisted in `audit-ci.jsonc`
  - [ ] Add LICENSE file (likely MIT, matching v1)
- [ ] Write CONTRIBUTING.md once architecture stabilizes
- [ ] Archive truetrack v1 repo on GitHub with README banner pointing here
