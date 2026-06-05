import initSqlJs from 'sql.js';
import type { Database, SqlValue, Row } from './database.ts';
import { runMigrations } from './migrations/runner.ts';
import { allMigrations } from './migrations/index.ts';

const isBrowser = typeof window !== 'undefined';

/**
 * Initialize the database: open a connection, run pending migrations, return the handle.
 *
 * Uses sql.js in both browser and Node.js (tests). In the browser, the WASM file
 * is served from public/sql-wasm.wasm. Production cr-sqlite initialization will
 * replace this when CRDT sync is wired up.
 */
export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs(
    isBrowser ? { locateFile: (file: string) => `/${file}` } : undefined,
  );
  const raw = new SQL.Database();

  const db: Database = {
    exec(sql: string, params?: SqlValue[]): void {
      raw.run(sql, params as Parameters<typeof raw.run>[1]);
    },

    execA(sql: string, params?: SqlValue[]): SqlValue[][] {
      const stmt = raw.prepare(sql);
      if (params) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: SqlValue[][] = [];
      while (stmt.step()) {
        rows.push(stmt.get() as SqlValue[]);
      }
      stmt.free();
      return rows;
    },

    execO(sql: string, params?: SqlValue[]): Row[] {
      const stmt = raw.prepare(sql);
      if (params) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: Row[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Row);
      }
      stmt.free();
      return rows;
    },

    close(): void {
      raw.close();
    },
  };

  runMigrations(db, allMigrations);
  return db;
}

/**
 * Close the database connection cleanly.
 */
export function closeDatabase(db: Database): void {
  db.close();
}
