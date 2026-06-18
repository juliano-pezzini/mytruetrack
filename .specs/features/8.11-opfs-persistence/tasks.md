# Phase 8.11 — Tasks: OPFS Persistence + CRDT Delta Sync

Gate (run after each task): `npm run typecheck && npm run lint && npm run test`.
Full gate before PR also runs `npm run build`, `npm run test:e2e`, and `audit-ci`.
Each task = one atomic commit. `[P]` = parallelizable with siblings.

---

## T0 — Spike (DONE)

- ✅ Verified cr-sqlite 0.16 + OPFS + COOP/COEP + `crsql_changes` in Chromium under Vite 8.
- ✅ COOP/COEP headers added to `vite.config.ts`.
- Verdict recorded in `spec.md`.

## T1 — Async `Database` interface + adapters (OPF-01, OPF-02, OPF-04)

- **What:** Make `Database` methods return Promises. Add `wrapCrSqlite` (browser) and
  `wrapSqlJs` (Node) in `init.ts`; browser path uses `initWasm` + OPFS `open('mytruetrack.db')`.
  Point `test-helpers.createTestDatabase` at the shared sql.js wrapper.
- **Where:** `database.ts`, `init.ts`, `test-helpers.ts`.
- **Done when:** `initDatabase()` returns an async DB in both environments; typecheck passes
  (call sites still sync → expected errors fixed in T2–T4, so land T1+T2+T3 typecheck together
  OR temporarily keep callers compiling). Build the browser bundle to confirm WASM resolves.
- **Tests:** `init.test.ts`, `test-helpers.test.ts` awaited.

## T2 — Migration runner async (OPF-01)

- **What:** `runMigrations` → `async`; await statements and `_migrations` writes.
- **Where:** `migrations/runner.ts`, `migrations/index.ts` (call), `init.ts` (await runMigrations).
- **Done when:** runner returns a Promise; `runner.test.ts` awaited and green.

## T3 — Repositories async (OPF-01) `[P per repo]`

- **What:** Every method in all 8 repositories becomes `async`; await internal `this.*` calls.
- **Where:** `storage/repositories/*.ts` + their `*.test.ts`.
- **Done when:** repo unit tests pass with awaits.

## T4 — Consumers async: hooks, import service, sync engine plumbing (OPF-01)

- **What:** Add `await` at all remaining call sites — UI data hooks, `workers/import-service.ts`,
  and the snapshot helpers in `sync-engine.ts`.
- **Where:** `ui/hooks/*`, `workers/import-service.ts(+test)`, `sync/sync-engine.ts(+test)`.
- **Done when:** full `npm run typecheck && npm run test` green (no remaining sync DB calls).

## T5 — CRR registration (OPF-03)

- **What:** After migrations in the **browser path**, loop `SYNC_TABLES` →
  `SELECT crsql_as_crr(table)`. Export `SYNC_TABLES` from a shared module.
- **Where:** `init.ts`, `sync/sync-engine.ts` (export `SYNC_TABLES`).
- **Done when:** browser build runs registration; sql.js path skips it. e2e: tables persist + CRR active.

## T6 — Delta sync engine (OPF-07)

- **What:** Add `getSiteId(db)`; rewrite cloud `pushChanges`/`pullChanges` to per-site
  `changes-<siteid>.bin` using `crsql_changes` (push own; pull+apply all peers via `list()`).
  Keep snapshot export/import for local backup only.
- **Where:** `sync/sync-engine.ts(+test)`, possibly `sync/sync-state.ts` (per-site watermark optional).
- **Done when:** unit tests cover protocol (mocked change rows); manual `SyncSection` + `AutoSyncProvider`
  still compile against the new signatures.

## T7 — Auto-pull on startup consolidation (OPF-06)

- **What:** Ensure a single pull-on-load when a provider is configured (reconcile
  `DatabaseProvider` vs `AutoSyncProvider.pullOnLoad`; avoid double pull).
- **Where:** `app/database-provider.tsx`, `app/auto-sync-provider.tsx`.
- **Done when:** new device with configured provider restores data on first load (e2e).

## T8 — E2E + full gate (OPF-02, OPF-03, OPF-07)

- **What:** Playwright: (a) data persists across reload; (b) two contexts converge via a shared
  provider with no prompts. Verify GIS/Drive still loads under COEP. Run full gate + `audit-ci`.
- **Where:** `e2e/persistence.spec.ts`, `e2e/sync-convergence.spec.ts`.
- **Done when:** all unit + e2e green; build clean; audit clean.

### Status (DONE, except convergence e2e deferred)

- ✅ `e2e/persistence.spec.ts`: `crossOriginIsolated === true`; account + transaction survive a
  full page reload (OPFS durability).
- ✅ GIS/Drive verified to **load + initialize under COEP `require-corp`** (throwaway probe).
- ✅ Full gate green: 330 unit, 50 e2e, typecheck, lint, build, `audit-ci`.
- ⏸️ **Deferred:** real two-context convergence e2e (`e2e/sync-convergence.spec.ts`). Needs a
  shared cloud HTTP/WebDAV test server (mock providers can't be shared across Playwright
  contexts). Convergence is covered by `src/sync/crsql-changes.test.ts` (multi-peer apply,
  own-file skip, encryption round-trip) + the spike-verified real `crsql_changes` merge.
  Follow-up: stand up a WebDAV test server in Playwright `globalSetup` for an end-to-end
  two-device test.

---

## Dependency order

```
T1 ─→ T2 ─→ T3 ─→ T4 ─→ T5 ─→ T6 ─→ T7 ─→ T8
                  (T4 completes the async cutover; T1–T4 may share a typecheck checkpoint)
```

## Traceability

| Task | Requirements |
| ---- | ------------ |
| T1   | OPF-01, OPF-02, OPF-04 |
| T2   | OPF-01 |
| T3   | OPF-01 |
| T4   | OPF-01 |
| T5   | OPF-03 |
| T6   | OPF-07 |
| T7   | OPF-06 |
| T8   | OPF-02, OPF-03, OPF-07 |
