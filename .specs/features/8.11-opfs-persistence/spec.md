# Phase 8.11 — OPFS Persistence via cr-sqlite

## Problem Statement

The SQLite database is currently **in-memory only** (`new SQL.Database()` in `init.ts`). User data
is lost on every page reload, Ctrl+R, or browser restart. Google Drive sync cannot compensate
because there is no automatic push/pull and the database is empty after reload anyway.

The app already depends on `@vlcn.io/crsqlite-wasm` (installed but unused). This phase activates
it for browser use with OPFS-backed persistence, making data durable across reloads. sql.js remains
the test-time backend.

## Goals

- [ ] Data survives page reload, browser restart, and OS reboot (OPFS-backed SQLite)
- [ ] Database interface becomes fully async (required by cr-sqlite's API)
- [ ] All repositories, sync engine, migration runner, and import service compile + work with async DB
- [ ] Tests continue to use sql.js (Node.js, in-memory) — no OPFS in test environment
- [ ] Auto-pull from cloud on app startup when a sync provider is configured (restores data on new device)
- [ ] CRDT columns registered so future multi-device sync converges (cr-sqlite `crsql_as_crr`)

## Out of Scope

| Feature                              | Reason                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Auto-push on every write             | Deferred — manual "Push Now" for now; performance implications need study |
| Scheduled / periodic sync            | Post-launch                                                               |
| Migration from sql.js in-memory data | No production users; fresh OPFS database is fine                          |
| Compression of OPFS database         | Optimization, not correctness                                             |

---

## Requirements

### OPF-01: Async Database interface

Make all `Database` methods return Promises:

```typescript
export type Database = {
  exec(sql: string, params?: SqlValue[]): Promise<void>;
  execA(sql: string, params?: SqlValue[]): Promise<SqlValue[][]>;
  execO(sql: string, params?: SqlValue[]): Promise<Row[]>;
  close(): Promise<void>;
};
```

**Impact:** Every call site (~90 across 18 files) must be `await`-ed.

| File group                       | Estimated call sites |
| -------------------------------- | -------------------- |
| Repositories (8 files)           | ~40                  |
| Migration runner + migrations    | ~10                  |
| Sync engine + tests              | ~13                  |
| Import service + tests           | ~6                   |
| Init + test helpers + init tests | ~20                  |
| UI hooks (indirect via repos)    | 0 (already async)    |

### OPF-02: Browser init — cr-sqlite + OPFS

Replace `initDatabase()` browser path:

```typescript
import initWasm from '@vlcn.io/crsqlite-wasm';

const isBrowser = typeof window !== 'undefined';

export async function initDatabase(): Promise<Database> {
  if (isBrowser) {
    const sqlite = await initWasm((file) => `/${file}`);
    const raw = await sqlite.open('mytruetrack.db'); // OPFS-persisted
    return wrapCrSqlite(raw);
  }
  // Node.js / test path: sql.js in-memory (unchanged)
  return createSqlJsDatabase();
}
```

The `wrapCrSqlite(raw)` adapter maps cr-sqlite's `DB` (async) to our `Database` interface.

### OPF-03: CRDT registration

After running migrations, register each syncable table as a CRDT:

```typescript
for (const table of SYNC_TABLES) {
  await db.exec(`SELECT crsql_as_crr('${table}')`);
}
```

This enables conflict-free merge via `crsql_changes` in future sync engine upgrades.

### OPF-04: Test-time sql.js wrapper (async adapter)

Wrap sql.js's synchronous `Database` in a thin async adapter:

```typescript
function wrapSqlJs(raw: SqlJsDatabase): Database {
  return {
    async exec(sql, params) {
      raw.run(sql, params);
    },
    async execA(sql, params) {
      /* ... stmt loop ... */
    },
    async execO(sql, params) {
      /* ... stmt loop ... */
    },
    async close() {
      raw.close();
    },
  };
}
```

All existing test helpers and test files call `await db.exec(...)` etc. — no functional change,
just adding `await` everywhere.

### OPF-05: WASM files in public/

Copy `crsqlite.wasm` from `node_modules/@vlcn.io/crsqlite-wasm/dist/` to `public/` (or configure
Vite to serve it). Needed for the browser `locateFile` callback.

### OPF-06: Auto-pull on startup

In `DatabaseProvider`, after `initDatabase()`, if a sync provider is configured and connected:

```typescript
const config = await loadSyncConfig();
if (config.provider) {
  const provider = await getActiveProvider(config);
  if (provider) await pullChanges(db, provider, dek);
}
```

This restores data on a new device or after clearing browser storage.

---

## Migration Strategy

### Repository changes (mechanical)

Every repository function changes from:

```typescript
export function getAllAccounts(db: Database): Account[] {
  const rows = db.execO('SELECT * FROM accounts ...');
  return rows.map(mapRow);
}
```

to:

```typescript
export async function getAllAccounts(db: Database): Promise<Account[]> {
  const rows = await db.execO('SELECT * FROM accounts ...');
  return rows.map(mapRow);
}
```

Callers (hooks, services) are already async — they just need `await` added.

### Migration runner

`runMigrations` becomes async. Each migration's `up(db)` becomes `async up(db)`.

### Sync engine

`exportDatabaseSnapshot` and `importDatabaseSnapshot` become async (they call `db.execO` / `db.exec`).

---

## Testing

- All existing 283+ unit tests must continue to pass (sql.js async adapter)
- Add integration test: `initDatabase()` in browser mode opens OPFS-backed DB, data persists
  across close/reopen (Playwright only — needs real browser with OPFS)
- Gate: `tsc --noEmit && vite build && vitest run && eslint && audit-ci`

---

## Affected Files

| File                                           | Change type                                        |
| ---------------------------------------------- | -------------------------------------------------- |
| `src/storage/database.ts`                      | Interface → async                                  |
| `src/storage/init.ts`                          | Browser: cr-sqlite; Node: sql.js async wrapper     |
| `src/storage/test-helpers.ts`                  | sql.js async wrapper                               |
| `src/storage/migrations/runner.ts`             | async                                              |
| `src/storage/migrations/001-initial-schema.ts` | async                                              |
| `src/storage/migrations/types.ts`              | Migration type → async                             |
| `src/storage/repositories/*.ts` (8 files)      | async functions                                    |
| `src/storage/repositories/*.test.ts` (6 files) | add awaits                                         |
| `src/storage/init.test.ts`                     | add awaits                                         |
| `src/storage/test-helpers.test.ts`             | add awaits                                         |
| `src/sync/sync-engine.ts`                      | async export/import                                |
| `src/sync/sync-engine.test.ts`                 | add awaits                                         |
| `src/workers/import-service.ts`                | add awaits                                         |
| `src/workers/import-service.test.ts`           | add awaits                                         |
| `src/app/database-provider.tsx`                | auto-pull on startup                               |
| `public/`                                      | add `crsqlite.wasm`                                |
| `vite.config.ts`                               | possibly configure WASM serving / headers for OPFS |

## Risks

- **OPFS requires `Cross-Origin-Isolation` headers** (`Cross-Origin-Opener-Policy: same-origin` +
  `Cross-Origin-Embedder-Policy: require-corp`). Vite dev server and production hosting must set
  these. This breaks some third-party resources (e.g., Google Fonts loaded from CDN need
  `crossorigin` attribute). Test in Playwright with the headers enabled.
- **cr-sqlite 0.16 is aging.** Verify compatibility with current Vite/WASM pipeline. If issues
  arise, fall back to Option A (sql.js + IndexedDB persistence) as interim.
- **Large mechanical diff** (~18 files, ~90 call sites). Use a codemod or find-and-replace for
  the bulk `await` insertion, then review manually.

## Requirement Traceability

| ID     | Requirement                     | Priority |
| ------ | ------------------------------- | -------- |
| OPF-01 | Async Database interface        | P1       |
| OPF-02 | Browser init — cr-sqlite + OPFS | P1       |
| OPF-03 | CRDT registration               | P2       |
| OPF-04 | Test-time sql.js async adapter  | P1       |
| OPF-05 | WASM served to the browser      | P1       |
| OPF-06 | Auto-pull on startup            | P2       |
| OPF-07 | `crsql_changes` delta sync      | P2       |

---

## Spike Verdict (2026-06-17)

A throwaway Playwright spike (`spike-opfs.html` + `src/spike-opfs.ts` + a temporary e2e
spec, since removed) verified the riskiest assumptions in real Chromium under the current
Vite 8 toolchain. **All green:**

- `crossOriginIsolated === true` with COOP `same-origin` + COEP `require-corp` set via
  `vite.config.ts` (`server.headers` + `preview.headers`). Production hosting must send the
  same two headers.
- `@vlcn.io/crsqlite-wasm` 0.16 `initWasm()` loads under Vite 8. The WASM is resolved with
  `import wasmUrl from '@vlcn.io/crsqlite-wasm/crsqlite.wasm?url'` — **no manual copy to
  `public/` needed** (supersedes the original OPF-05 wording).
- `sqlite.open('file.db')` opens an **OPFS-backed** DB **on the main thread** — no Web Worker
  required. Data survived `close()` → reopen **and** a full page reload.
- `crsql_as_crr()` and the `crsql_changes` virtual table both work.

Decision: proceed with Scope **B** (persistence + CRR registration + delta-sync rewrite).
No sql.js+IndexedDB fallback required.

## OPF-07: `crsql_changes` delta sync (Scope B)

Replace the full-snapshot JSON sync with conflict-free CRDT delta exchange. To avoid the
last-writer-wins file-overwrite race of a single shared blob, each device writes its **own**
change file keyed by its cr-sqlite site id:

- **Push:** `SELECT * FROM crsql_changes` for this site → encrypt → upload as
  `changes-<siteid>.bin` (overwriting only this device's own file).
- **Pull:** `list()` the sync folder, download every `changes-*.bin` **except this device's
  own**, decrypt, and apply each row via `INSERT INTO crsql_changes ...`. cr-sqlite merges
  conflict-free.

This converges across N devices with no merge prompts and no cross-device overwrite. Snapshot
import/export is retained only for the local encrypted backup/export path (not cloud sync).
