// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { fromCents } from '../../domain/money.ts';
import type { Account } from '../../domain/account.ts';

const accountsState = vi.hoisted(() => ({
  accounts: [] as Account[],
}));

vi.mock('../hooks/useAccounts.ts', () => ({
  useAccounts: () => ({
    accounts: accountsState.accounts,
    loading: false,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../hooks/useAccountBalance.ts', () => ({
  useAccountBalance: () => ({
    balance: fromCents(0),
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../hooks/useDatabase.ts', () => ({
  useDatabase: () => ({}),
}));

vi.mock('../../storage/repositories/transaction-repository.ts', () => ({
  createTransactionRepository: () => ({
    getByAccount: vi.fn().mockResolvedValue([]),
  }),
}));

import { DashboardPage } from './DashboardPage.tsx';

function account(overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return {
    type: 'bank',
    initialBalance: fromCents(0),
    isActive: true,
    description: null,
    bankCode: '',
    ...overrides,
  };
}

function renderDashboard() {
  render(createElement(MemoryRouter, null, createElement(DashboardPage)));
}

describe('Dashboard account transactions link', () => {
  it('links each account card to that account’s transactions', () => {
    accountsState.accounts = [
      account({ id: 'acc-checking', name: 'Checking' }),
      account({ id: 'acc-mp', name: 'Mercado Pago', bankCode: '323' }),
    ];

    renderDashboard();

    const checking = screen.getByRole('link', { name: 'Transactions for Checking' });
    const mercadoPago = screen.getByRole('link', { name: 'Transactions for Mercado Pago' });

    expect(checking.getAttribute('href')).toBe('/transactions?account=acc-checking');
    expect(mercadoPago.getAttribute('href')).toBe('/transactions?account=acc-mp');
    expect(checking.textContent).toBe('Transactions');
    expect(screen.getByText('Checking').closest('a')).toBeNull();
    expect(screen.getByRole('button', { name: 'Import from Mercado Pago' })).toBeTruthy();
  });
});
