import { describe, it, expect, afterEach } from 'vitest';
import { createTestDatabase } from './test-helpers.ts';
import type { Database } from './database.ts';

describe('createTestDatabase', () => {
  let db: Database;

  afterEach(() => {
    db.close();
  });

  it('creates a working in-memory database', async () => {
    db = await createTestDatabase();
    db.exec('CREATE TABLE test (id TEXT PRIMARY KEY, value INTEGER)');
    db.exec('INSERT INTO test (id, value) VALUES (?, ?)', ['a', 42]);
    const rows = db.execO('SELECT * FROM test WHERE id = ?', ['a']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('a');
    expect(rows[0]!.value).toBe(42);
  });

  it('returns rows as arrays via execA', async () => {
    db = await createTestDatabase();
    db.exec('CREATE TABLE nums (n INTEGER)');
    db.exec('INSERT INTO nums VALUES (?)', [1]);
    db.exec('INSERT INTO nums VALUES (?)', [2]);
    const rows = db.execA('SELECT n FROM nums ORDER BY n');
    expect(rows).toEqual([[1], [2]]);
  });

  it('returns empty arrays when no rows match', async () => {
    db = await createTestDatabase();
    db.exec('CREATE TABLE empty_test (id TEXT)');
    expect(db.execO('SELECT * FROM empty_test')).toEqual([]);
    expect(db.execA('SELECT * FROM empty_test')).toEqual([]);
  });
});
