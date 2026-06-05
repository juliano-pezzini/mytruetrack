import { describe, it, expect } from 'vitest';
import { createAccount, assertAccountType } from './account.ts';
import type { AccountType } from './account.ts';
import { fromCents, fromDecimal } from './money.ts';

describe('Account', () => {
  it('creates a bank account with defaults', () => {
    const acct = createAccount({
      id: 'acct-1',
      name: 'Checking',
      type: 'bank',
      initialBalance: fromCents(100000),
    });
    expect(acct.id).toBe('acct-1');
    expect(acct.name).toBe('Checking');
    expect(acct.type).toBe('bank');
    expect(acct.initialBalance).toBe(100000);
    expect(acct.isActive).toBe(true);
    expect(acct.description).toBeNull();
  });

  it('creates a credit card account with negative initial balance', () => {
    const acct = createAccount({
      id: 'acct-2',
      name: 'Visa',
      type: 'credit_card',
      initialBalance: fromDecimal('-500.00'),
      description: 'Main credit card',
    });
    expect(acct.type).toBe('credit_card');
    expect(acct.initialBalance).toBe(-50000);
    expect(acct.description).toBe('Main credit card');
  });

  it('creates wallet and transitional accounts', () => {
    const wallet = createAccount({
      id: 'w-1',
      name: 'Cash',
      type: 'wallet',
      initialBalance: fromCents(5000),
    });
    const transit = createAccount({
      id: 't-1',
      name: 'Transfer',
      type: 'transitional',
      initialBalance: fromCents(0),
    });
    expect(wallet.type).toBe('wallet');
    expect(transit.type).toBe('transitional');
  });

  it('trims whitespace from name', () => {
    const acct = createAccount({
      id: 'a',
      name: '  Savings  ',
      type: 'bank',
      initialBalance: fromCents(0),
    });
    expect(acct.name).toBe('Savings');
  });

  it('rejects empty name', () => {
    expect(() =>
      createAccount({ id: 'a', name: '', type: 'bank', initialBalance: fromCents(0) }),
    ).toThrow('name is required');
  });

  it('allows inactive accounts', () => {
    const acct = createAccount({
      id: 'a',
      name: 'Old',
      type: 'bank',
      initialBalance: fromCents(0),
      isActive: false,
    });
    expect(acct.isActive).toBe(false);
  });

  it('exhaustive switch covers all account types', () => {
    const types: AccountType[] = ['bank', 'credit_card', 'wallet', 'transitional'];
    for (const t of types) {
      expect(() => assertAccountType(t)).not.toThrow();
    }
  });
});
