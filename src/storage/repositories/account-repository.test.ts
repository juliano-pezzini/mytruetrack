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

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates and reads back an account', async () => {
    const account = await repo.create({
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

    const fetched = await repo.getById('acc-1');
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Checking');
    expect(toCents(fetched!.initialBalance)).toBe(100000);
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.getById('no-such-id')).toBeNull();
  });

  it('getAll returns only active accounts by default', async () => {
    await repo.create({ id: 'a1', name: 'Active', type: 'bank', initialBalance: fromCents(0) });
    await repo.create({
      id: 'a2',
      name: 'Inactive',
      type: 'bank',
      initialBalance: fromCents(0),
      isActive: false,
    });

    const active = await repo.getAll();
    expect(active).toHaveLength(1);
    expect(active[0]!.name).toBe('Active');

    const all = await repo.getAll({ includeInactive: true });
    expect(all).toHaveLength(2);
  });

  it('updates only the provided fields', async () => {
    await repo.create({
      id: 'u1',
      name: 'Old Name',
      type: 'bank',
      initialBalance: fromCents(5000),
    });

    const updated = await repo.update('u1', { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.type).toBe('bank'); // unchanged
    expect(toCents(updated.initialBalance)).toBe(5000); // unchanged
  });

  it('throws when updating non-existent account', async () => {
    await expect(repo.update('nope', { name: 'X' })).rejects.toThrow('Account not found');
  });

  it('soft deletes by setting is_active to 0', async () => {
    await repo.create({
      id: 'del-1',
      name: 'To Delete',
      type: 'wallet',
      initialBalance: fromCents(0),
    });
    await repo.softDelete('del-1');

    expect(await repo.getAll()).toHaveLength(0);
    expect(await repo.getAll({ includeInactive: true })).toHaveLength(1);
    expect((await repo.getById('del-1'))!.isActive).toBe(false);
  });

  it('handles credit card with negative initial balance', async () => {
    const cc = await repo.create({
      id: 'cc-1',
      name: 'Visa',
      type: 'credit_card',
      initialBalance: fromCents(-50000),
      description: 'Main credit card',
    });

    expect(toCents(cc.initialBalance)).toBe(-50000);
    expect(cc.description).toBe('Main credit card');

    const fetched = await repo.getById('cc-1');
    expect(toCents(fetched!.initialBalance)).toBe(-50000);
    expect(fetched!.description).toBe('Main credit card');
  });

  it('updates multiple fields at once', async () => {
    await repo.create({
      id: 'multi',
      name: 'Old',
      type: 'bank',
      initialBalance: fromCents(0),
      description: 'old desc',
    });

    const updated = await repo.update('multi', {
      name: 'New',
      type: 'wallet',
      description: 'new desc',
    });
    expect(updated.name).toBe('New');
    expect(updated.type).toBe('wallet');
    expect(updated.description).toBe('new desc');
  });

  it('updates description to null', async () => {
    await repo.create({
      id: 'null-desc',
      name: 'Test',
      type: 'bank',
      initialBalance: fromCents(0),
      description: 'has desc',
    });

    const updated = await repo.update('null-desc', { description: null });
    expect(updated.description).toBeNull();
  });

  it('persists bank_code on create and read', async () => {
    const account = await repo.create({
      id: 'mp-1',
      name: 'Mercado Pago',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });
    expect(account.bankCode).toBe('323');

    const fetched = await repo.getById('mp-1');
    expect(fetched!.bankCode).toBe('323');
  });

  it('defaults bank_code to empty string', async () => {
    const account = await repo.create({
      id: 'other-1',
      name: 'Other Bank',
      type: 'bank',
      initialBalance: fromCents(0),
    });
    expect(account.bankCode).toBe('');
    expect((await repo.getById('other-1'))!.bankCode).toBe('');
  });

  it('rejects a second active Mercado Pago account on create', async () => {
    await repo.create({
      id: 'mp-a',
      name: 'MP One',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });

    await expect(
      repo.create({
        id: 'mp-b',
        name: 'MP Two',
        type: 'wallet',
        initialBalance: fromCents(0),
        bankCode: '323',
      }),
    ).rejects.toThrow('An active Mercado Pago account already exists.');
  });

  it('rejects updating a second active account to bank_code 323', async () => {
    await repo.create({
      id: 'mp-first',
      name: 'MP First',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });
    await repo.create({
      id: 'other',
      name: 'Other',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '',
    });

    await expect(repo.update('other', { bankCode: '323' })).rejects.toThrow(
      'An active Mercado Pago account already exists.',
    );
  });

  it('does not count an inactive 323 toward the one-active limit', async () => {
    await repo.create({
      id: 'mp-old',
      name: 'Old MP',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
      isActive: false,
    });

    const second = await repo.create({
      id: 'mp-new',
      name: 'New MP',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });
    expect(second.bankCode).toBe('323');
  });

  it('allows a second 323 after soft-deleting the first', async () => {
    await repo.create({
      id: 'mp-live',
      name: 'Live MP',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });
    await repo.softDelete('mp-live');

    const replacement = await repo.create({
      id: 'mp-next',
      name: 'Next MP',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });
    expect(replacement.bankCode).toBe('323');
  });

  it('updates bankCode to empty (Outros bancos)', async () => {
    await repo.create({
      id: 'mp-toggle',
      name: 'Toggle',
      type: 'bank',
      initialBalance: fromCents(0),
      bankCode: '323',
    });

    const updated = await repo.update('mp-toggle', { bankCode: '' });
    expect(updated.bankCode).toBe('');
  });
});
