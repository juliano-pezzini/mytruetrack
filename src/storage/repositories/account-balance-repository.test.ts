import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createAccountBalanceRepository } from './account-balance-repository.ts';
import { toCents } from '../../domain/money.ts';
import type { Database } from '../database.ts';
import type { AccountBalanceRepository } from './account-balance-repository.ts';

describe('AccountBalanceRepository', () => {
  let db: Database;
  let repo: AccountBalanceRepository;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createAccountBalanceRepository(db);
  });

  afterEach(() => closeDatabase(db));

  it('inserts and retrieves a snapshot', () => {
    repo.upsert('a1', 2026, 5, 150000);
    const all = repo.getByAccount('a1');
    expect(all).toHaveLength(1);
    expect(toCents(all[0]!.closingBalance)).toBe(150000);
    expect(all[0]!.year).toBe(2026);
    expect(all[0]!.month).toBe(5);
  });

  it('upsert updates existing snapshot (no duplicate)', () => {
    repo.upsert('a1', 2026, 5, 100000);
    repo.upsert('a1', 2026, 5, 200000);

    const all = repo.getByAccount('a1');
    expect(all).toHaveLength(1);
    expect(toCents(all[0]!.closingBalance)).toBe(200000);
  });

  it('getByAccount returns ordered by year/month DESC', () => {
    repo.upsert('a1', 2026, 3, 10000);
    repo.upsert('a1', 2026, 1, 20000);
    repo.upsert('a1', 2025, 12, 30000);

    const all = repo.getByAccount('a1');
    expect(all.map((s) => `${s.year}-${s.month}`)).toEqual(['2026-3', '2026-1', '2025-12']);
  });

  it('getLatest returns most recent snapshot at or before date', () => {
    repo.upsert('a1', 2026, 1, 10000);
    repo.upsert('a1', 2026, 3, 30000);
    repo.upsert('a1', 2026, 5, 50000);

    const latest = repo.getLatest('a1', '2026-04-15');
    expect(latest).not.toBeNull();
    expect(latest!.month).toBe(3);
    expect(toCents(latest!.closingBalance)).toBe(30000);
  });

  it('getLatest returns null when no snapshots exist before date', () => {
    repo.upsert('a1', 2026, 6, 10000);
    const latest = repo.getLatest('a1', '2026-05-01');
    expect(latest).toBeNull();
  });

  it('getLatest includes snapshot for the exact month', () => {
    repo.upsert('a1', 2026, 5, 50000);
    const latest = repo.getLatest('a1', '2026-05-15');
    expect(latest).not.toBeNull();
    expect(latest!.month).toBe(5);
  });

  it('handles negative balances (credit cards)', () => {
    repo.upsert('cc1', 2026, 5, -75000);
    const all = repo.getByAccount('cc1');
    expect(toCents(all[0]!.closingBalance)).toBe(-75000);
  });
});
