import initSqlJs from 'sql.js';
import type { Database } from './database.ts';

/**
 * Create an in-memory Database backed by sql.js for testing.
 */
export async function createTestDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();

  return {
    exec(sql: string, params?: (string | number | null | Uint8Array)[]): void {
      raw.run(sql, params as Parameters<typeof raw.run>[1]);
    },

    execA(
      sql: string,
      params?: (string | number | null | Uint8Array)[],
    ): (string | number | null | Uint8Array)[][] {
      const stmt = raw.prepare(sql);
      if (params) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: (string | number | null | Uint8Array)[][] = [];
      while (stmt.step()) {
        rows.push(stmt.get() as (string | number | null | Uint8Array)[]);
      }
      stmt.free();
      return rows;
    },

    execO(
      sql: string,
      params?: (string | number | null | Uint8Array)[],
    ): Record<string, string | number | null | Uint8Array>[] {
      const stmt = raw.prepare(sql);
      if (params) stmt.bind(params as Parameters<typeof stmt.bind>[0]);
      const rows: Record<string, string | number | null | Uint8Array>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, string | number | null | Uint8Array>);
      }
      stmt.free();
      return rows;
    },

    close(): void {
      raw.close();
    },
  };
}
