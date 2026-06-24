# Phase 8.11 — Design: OPFS Persistence + CRDT Delta Sync

> Scope **B**: persistence + `crsql_as_crr` registration + `crsql_changes` delta-sync rewrite.
> All key assumptions verified by the 2026-06-17 spike (see spec.md → Spike Verdict).

## 1. Database abstraction → async

`Database` becomes fully async. cr-sqlite's `DB` already exposes `exec`/`execO`/`execA`/`close`
with matching names and Promise return types, so the production adapter is nearly a pass-through.

```typescript
export type Database = {
  exec(sql: string, params?: SqlValue[]): Promise<void>;
  execA(sql: string, params?: SqlValue[]): Promise<SqlValue[][]>;
  execO(sql: string, params?: SqlValue[]): Promise<Row[]>;
  close(): Promise<void>;
};
```

Two adapters behind one factory in `init.ts`:

- **Browser (`wrapCrSqlite`)** — `initWasm(() => wasmUrl)` → `sqlite.open('mytruetrack.db')`.
  WASM resolved via `import wasmUrl from '@vlcn.io/crsqlite-wasm/crsqlite.wasm?url'`.
  Thin shim that normalizes return types to our `Row` / `SqlValue` shapes.
- **Node/test (`wrapSqlJs`)** — wraps synchronous sql.js calls in `async` methods. Moves the
  existing `createTestDatabase` body into `init.ts` so both share one wrapper.

`test-helpers.createTestDatabase` re-exports the same sql.js wrapper.

## 2. Migration runner → async

`runMigrations` becomes `async`; the `_migrations` bookkeeping uses `await`. `Migration.up`
stays as SQL strings (no DB handle), so `types.ts` and `001-initial-schema.ts` are unchanged
except the runner awaiting each statement.

## 3. Repositories → async

All 8 factory repositories (`createXRepository(db)`) keep their shape; every method becomes
`async` and returns `Promise<…>`. Internal `this.getById(...)` calls become `await this.getById(...)`.
Consumers are React hooks (already effect/async) — they gain `await`.

## 4. CRR registration (OPF-03)

After migrations, in the **browser path only**, register each syncable table:

```typescript
for (const table of SYNC_TABLES) {
  await db.exec(`SELECT crsql_as_crr('${table}')`);
}
```

`SYNC_TABLES` is the existing list in `sync-engine.ts` (9 tables). Skipped under sql.js (tests),
which has no cr-sqlite extension. `crsql_as_crr` is idempotent across reloads.

## 5. Delta sync (OPF-07)

Per-site change files keyed by `crsql_site_id()`, exchanged through the existing `CloudProvider`.

```
                 cloud sync folder
   changes-<siteA>.bin   changes-<siteB>.bin   changes-<siteC>.bin
        ▲  push own              ▲                      ▲
        └── device A pulls B + C (every *.bin except its own), applies, merges
```

- **`getSiteId(db)`** → `SELECT quote(crsql_site_id())` (hex), used for the filename.
- **`pushChanges`** → `SELECT * FROM crsql_changes` → JSON → encrypt (DEK or plaintext) →
  `upload('changes-<siteid>.bin', payload)`.
- **`pullChanges`** → `list()` → for each `changes-*.bin` that isn't this device's own:
  download → decrypt → `db.tx`: `INSERT INTO crsql_changes VALUES (...)` per row.
- Column order for `crsql_changes` insert is captured from the export so apply matches.
- **Encryption unchanged**: each blob encrypted with the vault DEK; plaintext when DEK is null
  (existing local-only path), with the same head-sniff guard.

The JSON snapshot `exportDatabaseSnapshot` / `importDatabaseSnapshot` functions are **retained**
for local encrypted backup/export only — removed from the cloud push/pull path.

### Test strategy for delta sync

sql.js has no `crsql_changes`. Unit tests therefore cover the delta protocol with the existing
two-DB convergence harness by mocking the change-row extraction, while the **real** cr-sqlite
merge is verified in a Playwright e2e (two contexts → shared mock/in-memory provider → converge).

## 6. Auto-pull on startup (OPF-06)

`DatabaseProvider`, after `initDatabase()`, if a provider is configured, calls `pullChanges`
once before rendering children (best-effort; failures are logged, never block boot). This already
overlaps with the existing `AutoSyncProvider.pullOnLoad` — consolidate so pull happens once.

## 7. Headers & hosting (OPF-05)

cr-sqlite 0.16 persists via its IndexedDB-backed `IDBBatchAtomicVFS` — no OPFS, no
`SharedArrayBuffer`, so **cross-origin isolation is not required**. `vite.config.ts` sends COOP
`same-origin-allow-popups` (and omits COEP) on dev and preview so the Google sign-in popup can
return its token; production deployment docs should match. No WASM copy step — `?url` import
handles dev+build.

## 8. Risks / mitigations

| Risk                                                                                            | Mitigation                                                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-enabling COEP `require-corp` would break the GIS sign-in popup and other cross-origin assets | Keep COOP `same-origin-allow-popups` / no COEP unless a VFS that needs isolation is adopted; then audit external loads and the GIS popup flow. |
| `crsql_changes` insert column-order drift between versions                                      | Capture column names on export; insert by explicit column list.                                                                                |
| Large mechanical async diff (~126 call sites)                                                   | Land in ordered tasks (interface → runner → repos → consumers → tests), gate after each.                                                       |
| Unbounded growth of per-site change file                                                        | Acceptable for launch (full changes re-uploaded); compaction deferred.                                                                         |
