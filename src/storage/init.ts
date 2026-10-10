import initSqlJs from 'sql.js';
import type { Database, SqlValue, Row } from './database.ts';
import { runMigrations } from './migrations/runner.ts';
import { allMigrations } from './migrations/index.ts';
import { SYNC_TABLES } from '../sync/sync-tables.ts';

const isBrowser = typeof window !== 'undefined';

const DB_FILE = 'mytruetrack.db';

/**
 * In the browser there is exactly one persisted database file, so all callers must share a
 * single connection. React StrictMode (dev) and concurrent consumers would otherwise open
 * it twice and race the migrations against the same file. Node/test runs skip this cache so
 * each `initDatabase()` yields an independent in-memory database.
 */
let browserDbPromise: Promise<Database> | null = null;

/**
 * Initialize the database: open a connection, run pending migrations, return the handle.
 *
 * Browser: cr-sqlite (`@vlcn.io/crsqlite-wasm`) persisting via its IndexedDB-backed
 * `IDBBatchAtomicVFS` + CRDT (no OPFS, no SharedArrayBuffer, no cross-origin isolation).
 * Node.js (tests): sql.js, in-memory.
 */
export async function initDatabase(): Promise<Database> {
  /* v8 ignore start -- cr-sqlite connection cache; Node tests use sql.js */
  if (isBrowser) {
    // Cache the connection promise, but drop it if it rejects so a transient failure
    // (migration error, storage hiccup) can be retried without a full page reload.
    browserDbPromise ??= openAndMigrate().catch((err) => {
      browserDbPromise = null;
      throw err;
    });
    return browserDbPromise;
  }
  /* v8 ignore stop */
  return openAndMigrate();
}

async function openAndMigrate(): Promise<Database> {
  const db = isBrowser ? await createCrSqliteDatabase() : await createSqlJsDatabase();

  await runMigrations(db, allMigrations);

  /* v8 ignore start -- cr-sqlite CRR registration; sql.js has no crsql extension */
  if (isBrowser) {
    // Register each syncable table as a conflict-free replicated relation so that
    // `crsql_changes`-based sync converges. Idempotent across reloads. sql.js has no
    // cr-sqlite extension, so this runs only in the browser.
    for (const table of SYNC_TABLES) {
      await db.exec(`SELECT crsql_as_crr('${table}')`);
    }
  }
  /* v8 ignore stop */

  return db;
}

/**
 * Browser: cr-sqlite persisting via its IndexedDB-backed `IDBBatchAtomicVFS`. Imported
 * dynamically so Node/test bundling never resolves the WASM artifact (the `?url` suffix
 * only makes sense under Vite).
 */
/* v8 ignore start -- Vite `?url` WASM import; not resolvable under Node */
async function createCrSqliteDatabase(): Promise<Database> {
  const { default: initWasm } = await import('@vlcn.io/crsqlite-wasm');
  const { default: wasmUrl } = await import('@vlcn.io/crsqlite-wasm/crsqlite.wasm?url');
  const sqlite = await initWasm(() => wasmUrl);
  const raw = await sqlite.open(DB_FILE);

  return {
    async exec(sql: string, params?: SqlValue[]): Promise<void> {
      await raw.exec(sql, params as Parameters<typeof raw.exec>[1]);
    },
    async execA(sql: string, params?: SqlValue[]): Promise<SqlValue[][]> {
      return (await raw.execA(sql, params as Parameters<typeof raw.execA>[1])) as SqlValue[][];
    },
    async execO(sql: string, params?: SqlValue[]): Promise<Row[]> {
      return (await raw.execO(sql, params as Parameters<typeof raw.execO>[1])) as Row[];
    },
    async close(): Promise<void> {
      await raw.close();
    },
  };
}
/* v8 ignore stop */

/**
 * Node.js / tests: sql.js, in-memory. Synchronous calls wrapped in an async adapter so the
 * `Database` interface is uniform across environments.
 */
async function createSqlJsDatabase(): Promise<Database> {
  const SQL = await initSqlJs(isBrowser ? { locateFile: (file: string) => `/${file}` } : undefined);
  const raw = new SQL.Database();
  return wrapSqlJs(raw);
}

type SqlJsDatabase = InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>;

/**
 * Wrap a synchronous sql.js `Database` in the async `Database` interface.
 * Shared by production (Node) and test helpers.
 */
export function wrapSqlJs(raw: SqlJsDatabase): Database {
  return {
    async exec(sql: string, params?: SqlValue[]): Promise<void> {
      raw.run(sql, params as Parameters<typeof raw.run>[1]);
    },

    async execA(sql: string, params?: SqlValue[]): Promise<SqlValue[][]> {
      const stmt = raw.prepare(sql);
      if (params) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: SqlValue[][] = [];
      while (stmt.step()) {
        rows.push(stmt.get() as SqlValue[]);
      }
      stmt.free();
      return rows;
    },

    async execO(sql: string, params?: SqlValue[]): Promise<Row[]> {
      const stmt = raw.prepare(sql);
      if (params) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: Row[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Row);
      }
      stmt.free();
      return rows;
    },

    async close(): Promise<void> {
      raw.close();
    },
  };
}

/**
 * Close the database connection cleanly.
 */
export async function closeDatabase(db: Database): Promise<void> {
  /* v8 ignore start -- shared browser connection; Node tests each own a database */
  if (isBrowser && browserDbPromise) {
    // Allow a future initDatabase() to reopen the shared connection.
    browserDbPromise = null;
  }
  /* v8 ignore stop */
  await db.close();
}
