# State

**Last Updated:** 2026-06-07
**Current Work:** Phase 8 — Local-First Foundation COMPLETE. All 10 sub-phases done. 266 tests, 29 files, all passing. PWA installable with offline support. 87 modules, 239 KB gzip. GitHub Actions PR pipeline added (AD-005).

---

## Recent Decisions (Last 60 days)

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
- WebAuthn PRF-based biometric-only unlock (waiting for broader platform support)

---

## Blockers

(none)

---

## Todos

- [x] Run Phase 8.1 Architecture Spike (see `.specs/features/8.1-architecture-spike/spike-report.md`)
- [ ] Set up Vite + React + TypeScript scaffold once spike confirms stack
- [ ] Set up ESLint + Prettier + Vitest + Playwright
- [x] Set up GitHub Actions CI (typecheck, lint, unit tests, e2e) — see AD-005
- [ ] Replace `xlsx` with `exceljs` — `xlsx` has 2 known high CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) with no fix available; currently allowlisted in `audit-ci.jsonc`
  - [ ] Add LICENSE file (likely MIT, matching v1)
- [ ] Write CONTRIBUTING.md once architecture stabilizes
- [ ] Archive truetrack v1 repo on GitHub with README banner pointing here
