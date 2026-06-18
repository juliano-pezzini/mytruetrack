import initSqlJs from 'sql.js';
import type { Database, SqlValue, Row } from './database.ts';
import { runMigrations } from './migrations/runner.ts';
import { allMigrations } from './migrations/index.ts';
import { SYNC_TABLES } from '../sync/sync-engine.ts';

const isBrowser = typeof window !== 'undefined';

const OPFS_DB_FILE = 'mytruetrack.db';

/**
 * In the browser there is exactly one OPFS-backed database file, so all callers must
 * share a single connection. React StrictMode (dev) and concurrent consumers would
 * otherwise open it twice and race the migrations against the same file. Node/test runs
 * skip this cache so each `initDatabase()` yields an independent in-memory database.
 */
let browserDbPromise: Promise<Database> | null = null;

/**
 * Initialize the database: open a connection, run pending migrations, return the handle.
 *
 * Browser: cr-sqlite (`@vlcn.io/crsqlite-wasm`) with OPFS-backed persistence + CRDT.
 * Node.js (tests): sql.js, in-memory.
 */
export async function initDatabase(): Promise<Database> {
  if (isBrowser) {
    browserDbPromise ??= openAndMigrate();
    return browserDbPromise;
  }
  return openAndMigrate();
}

async function openAndMigrate(): Promise<Database> {
  const db = isBrowser ? await createCrSqliteDatabase() : await createSqlJsDatabase();

  await runMigrations(db, allMigrations);

  if (isBrowser) {
    // Register each syncable table as a conflict-free replicated relation so that
    // `crsql_changes`-based sync converges. Idempotent across reloads. sql.js has no
    // cr-sqlite extension, so this runs only in the browser.
    for (const table of SYNC_TABLES) {
      await db.exec(`SELECT crsql_as_crr('${table}')`);
    }
  }

  return db;
}

/**
 * Browser: cr-sqlite + OPFS. Imported dynamically so Node/test bundling never resolves
 * the WASM artifact (the `?url` suffix only makes sense under Vite).
 */
async function createCrSqliteDatabase(): Promise<Database> {
  const { default: initWasm } = await import('@vlcn.io/crsqlite-wasm');
  const { default: wasmUrl } = await import('@vlcn.io/crsqlite-wasm/crsqlite.wasm?url');
  const sqlite = await initWasm(() => wasmUrl);
  const raw = await sqlite.open(OPFS_DB_FILE);

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
  if (isBrowser && browserDbPromise) {
    // Allow a future initDatabase() to reopen the shared OPFS connection.
    browserDbPromise = null;
  }
  await db.close();
}
