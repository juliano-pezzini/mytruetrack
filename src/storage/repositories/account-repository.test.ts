import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createAccountRepository } from './account-repository.ts';
import { fromCents, toCents } from '../../domain/money.ts';
import type { Database } from '../database.ts';
import type { AccountRepository } from './account-repository.ts';

describe('AccountRepository', () => {
  let db: Database;
  let repo: AccountRepository;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createAccountRepository(db);
  });

  afterEach(() => closeDatabase(db));

  it('creates and reads back an account', () => {
    const account = repo.create({
      id: 'acc-1',
      name: 'Checking',
      type: 'bank',
      initialBalance: fromCents(100000),
    });

    expect(account.id).toBe('acc-1');
    expect(account.name).toBe('Checking');
    expect(account.type).toBe('bank');
    expect(toCents(account.initialBalance)).toBe(100000);
    expect(account.isActive).toBe(true);

    const fetched = repo.getById('acc-1');
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Checking');
    expect(toCents(fetched!.initialBalance)).toBe(100000);
  });

  it('returns null for non-existent id', () => {
    expect(repo.getById('no-such-id')).toBeNull();
  });

  it('getAll returns only active accounts by default', () => {
    repo.create({ id: 'a1', name: 'Active', type: 'bank', initialBalance: fromCents(0) });
    repo.create({
      id: 'a2',
      name: 'Inactive',
      type: 'bank',
      initialBalance: fromCents(0),
      isActive: false,
    });

    const active = repo.getAll();
    expect(active).toHaveLength(1);
    expect(active[0]!.name).toBe('Active');

    const all = repo.getAll({ includeInactive: true });
    expect(all).toHaveLength(2);
  });

  it('updates only the provided fields', () => {
    repo.create({ id: 'u1', name: 'Old Name', type: 'bank', initialBalance: fromCents(5000) });

    const updated = repo.update('u1', { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.type).toBe('bank'); // unchanged
    expect(toCents(updated.initialBalance)).toBe(5000); // unchanged
  });

  it('throws when updating non-existent account', () => {
    expect(() => repo.update('nope', { name: 'X' })).toThrow('Account not found');
  });

  it('soft deletes by setting is_active to 0', () => {
    repo.create({ id: 'del-1', name: 'To Delete', type: 'wallet', initialBalance: fromCents(0) });
    repo.softDelete('del-1');

    expect(repo.getAll()).toHaveLength(0);
    expect(repo.getAll({ includeInactive: true })).toHaveLength(1);
    expect(repo.getById('del-1')!.isActive).toBe(false);
  });

  it('handles credit card with negative initial balance', () => {
    const cc = repo.create({
      id: 'cc-1',
      name: 'Visa',
      type: 'credit_card',
      initialBalance: fromCents(-50000),
      description: 'Main credit card',
    });

    expect(toCents(cc.initialBalance)).toBe(-50000);
    expect(cc.description).toBe('Main credit card');

    const fetched = repo.getById('cc-1');
    expect(toCents(fetched!.initialBalance)).toBe(-50000);
    expect(fetched!.description).toBe('Main credit card');
  });

  it('updates multiple fields at once', () => {
    repo.create({
      id: 'multi',
      name: 'Old',
      type: 'bank',
      initialBalance: fromCents(0),
      description: 'old desc',
    });

    const updated = repo.update('multi', { name: 'New', type: 'wallet', description: 'new desc' });
    expect(updated.name).toBe('New');
    expect(updated.type).toBe('wallet');
    expect(updated.description).toBe('new desc');
  });

  it('updates description to null', () => {
    repo.create({
      id: 'null-desc',
      name: 'Test',
      type: 'bank',
      initialBalance: fromCents(0),
      description: 'has desc',
    });

    const updated = repo.update('null-desc', { description: null });
    expect(updated.description).toBeNull();
  });
});
