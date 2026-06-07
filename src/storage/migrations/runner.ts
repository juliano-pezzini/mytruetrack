import type { Database } from '../database.ts';
import type { Migration } from './types.ts';

/**
 * Run pending migrations in version order.
 * Tracks applied versions in a `_migrations` table.
 * Throws on failure with version + message.
 */
export function runMigrations(db: Database, migrations: readonly Migration[]): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db.execA('SELECT version FROM _migrations').map((row) => row[0] as number),
  );

  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sorted) {
    if (applied.has(migration.version)) continue;

    const statements = typeof migration.up === 'string' ? [migration.up] : migration.up;

    try {
      for (const sql of statements) {
        db.exec(sql);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${message}`, {
        cause: err,
      });
    }

    db.exec('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)', [
      migration.version,
      migration.name,
      new Date().toISOString(),
    ]);
  }
}
