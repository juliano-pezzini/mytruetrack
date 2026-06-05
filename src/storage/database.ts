/**
 * Database abstraction over SQLite.
 *
 * Production: @vlcn.io/crsqlite-wasm (browser, CRDT-enabled)
 * Tests: sql.js (Node.js, pure WASM)
 */

export type SqlValue = string | number | null | Uint8Array;

export type Row = Record<string, SqlValue>;

export type Database = {
  /** Execute SQL that returns no rows (DDL, INSERT, UPDATE, DELETE). */
  exec(sql: string, params?: SqlValue[]): void;

  /** Execute SQL and return rows as arrays of values. */
  execA(sql: string, params?: SqlValue[]): SqlValue[][];

  /** Execute SQL and return rows as objects keyed by column name. */
  execO(sql: string, params?: SqlValue[]): Row[];

  /** Close the database connection. */
  close(): void;
};
