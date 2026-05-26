# State

**Last Updated:** 2026-05-26
**Current Work:** Bootstrapping repo; Phase 8.1 Architecture Spike spec drafted

---

## Recent Decisions (Last 60 days)

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

---

## Deferred Ideas

(none yet — see ROADMAP "Future Considerations" for the curated list)

---

## Blockers

(none — Phase 8.1 spike will surface technical blockers if any)

---

## Todos

- [ ] Run Phase 8.1 Architecture Spike (see `.specs/features/8.1-architecture-spike/spec.md`)
- [ ] Set up Vite + React + TypeScript scaffold once spike confirms stack
- [ ] Set up ESLint + Prettier + Vitest + Playwright
- [ ] Set up GitHub Actions CI (typecheck, lint, unit tests, e2e)
- [ ] Add LICENSE file (likely MIT, matching v1)
- [ ] Write CONTRIBUTING.md once architecture stabilizes
- [ ] Archive truetrack v1 repo on GitHub with README banner pointing here
