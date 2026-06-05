import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from '../test-helpers.ts';
import { runMigrations } from './runner.ts';
import type { Database } from '../database.ts';
import type { Migration } from './types.ts';

describe('runMigrations', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('creates _migrations table and applies all migrations', () => {
    const migrations: Migration[] = [
      { version: 1, name: 'create-foo', up: 'CREATE TABLE foo (id TEXT PRIMARY KEY)' },
      { version: 2, name: 'create-bar', up: 'CREATE TABLE bar (id TEXT PRIMARY KEY)' },
    ];

    runMigrations(db, migrations);

    const applied = db.execO('SELECT version, name FROM _migrations ORDER BY version');
    expect(applied).toHaveLength(2);
    expect(applied[0]!.version).toBe(1);
    expect(applied[1]!.version).toBe(2);

    // Tables should exist
    expect(db.execA("SELECT name FROM sqlite_master WHERE type='table' AND name='foo'")).toHaveLength(1);
    expect(db.execA("SELECT name FROM sqlite_master WHERE type='table' AND name='bar'")).toHaveLength(1);
  });

  it('skips already-applied migrations', () => {
    const m1: Migration = { version: 1, name: 'create-foo', up: 'CREATE TABLE foo (id TEXT)' };
    const m2: Migration = { version: 2, name: 'create-bar', up: 'CREATE TABLE bar (id TEXT)' };

    runMigrations(db, [m1]);
    runMigrations(db, [m1, m2]);

    const applied = db.execO('SELECT version FROM _migrations ORDER BY version');
    expect(applied).toHaveLength(2);
    // foo should still exist (not re-created)
    expect(db.execA("SELECT name FROM sqlite_master WHERE type='table' AND name='foo'")).toHaveLength(1);
  });

  it('throws on bad SQL with version info', () => {
    const bad: Migration = { version: 3, name: 'bad-sql', up: 'NOT VALID SQL' };

    expect(() => runMigrations(db, [bad])).toThrow(/Migration 3 \(bad-sql\) failed/);
  });

  it('applies migrations in version order regardless of array order', () => {
    const migrations: Migration[] = [
      {
        version: 3,
        name: 'third',
        up: "CREATE TABLE t3 (id TEXT PRIMARY KEY DEFAULT '')",
      },
      {
        version: 1,
        name: 'first',
        up: "CREATE TABLE t1 (id TEXT PRIMARY KEY DEFAULT '')",
      },
      {
        version: 2,
        name: 'second',
        up: "CREATE TABLE t2 (id TEXT PRIMARY KEY DEFAULT '')",
      },
    ];

    runMigrations(db, migrations);

    const applied = db.execO('SELECT version FROM _migrations ORDER BY version');
    expect(applied.map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it('supports multi-statement migrations', () => {
    const migration: Migration = {
      version: 1,
      name: 'multi',
      up: [
        'CREATE TABLE a (id TEXT PRIMARY KEY)',
        'CREATE TABLE b (id TEXT PRIMARY KEY)',
      ],
    };

    runMigrations(db, [migration]);

    expect(db.execA("SELECT name FROM sqlite_master WHERE type='table' AND name='a'")).toHaveLength(1);
    expect(db.execA("SELECT name FROM sqlite_master WHERE type='table' AND name='b'")).toHaveLength(1);
  });
});
