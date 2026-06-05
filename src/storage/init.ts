import type { Database } from './database.ts';
import { runMigrations } from './migrations/runner.ts';
import { allMigrations } from './migrations/index.ts';
import { createTestDatabase } from './test-helpers.ts';

export type InitDatabaseOptions = {
  /** When true, use in-memory sql.js (for tests). Default: true. */
  inMemory?: boolean;
};

/**
 * Initialize the database: open a connection, run pending migrations, return the handle.
 *
 * For now, only supports in-memory sql.js (test/dev). Production cr-sqlite initialization
 * will be added in Phase 8.5 when the sync layer needs it.
 */
export async function initDatabase(_options?: InitDatabaseOptions): Promise<Database> {
  const db = await createTestDatabase();
  runMigrations(db, allMigrations);
  return db;
}

/**
 * Close the database connection cleanly.
 */
export function closeDatabase(db: Database): void {
  db.close();
}
