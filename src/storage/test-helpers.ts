import initSqlJs from 'sql.js';
import type { Database } from './database.ts';
import { wrapSqlJs } from './init.ts';

/**
 * Create an in-memory Database backed by sql.js for testing.
 */
export async function createTestDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return wrapSqlJs(raw);
}
