/**
 * Database abstraction over SQLite.
 *
 * Production: @vlcn.io/crsqlite-wasm (browser, CRDT-enabled)
 * Tests: sql.js (Node.js, pure WASM)
 */

/**
 * A single SQLite cell value. `bigint` is included because cr-sqlite exposes several
 * `crsql_changes` columns (`col_version`, `db_version`, `seq`) as bigint, and the delta
 * sync codec round-trips them without casts.
 */
export type SqlValue = string | number | bigint | null | Uint8Array;

export type Row = Record<string, SqlValue>;

export type Database = {
  /** Execute SQL that returns no rows (DDL, INSERT, UPDATE, DELETE). */
  exec(sql: string, params?: SqlValue[]): Promise<void>;

  /** Execute SQL and return rows as arrays of values. */
  execA(sql: string, params?: SqlValue[]): Promise<SqlValue[][]>;

  /** Execute SQL and return rows as objects keyed by column name. */
  execO(sql: string, params?: SqlValue[]): Promise<Row[]>;

  /** Close the database connection. */
  close(): Promise<void>;
};
