// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { fromCents } from '../../domain/money.ts';
import type { Account } from '../../domain/account.ts';

const accountsState = vi.hoisted(() => ({
  accounts: [] as Account[],
  loading: false,
}));

vi.mock('../hooks/useAccounts.ts', () => ({
  useAccounts: () => ({
    accounts: accountsState.accounts,
    loading: accountsState.loading,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../hooks/useTransactions.ts', () => ({
  useTransactions: () => ({
    transactions: [],
    loading: false,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../hooks/useCategories.ts', () => ({
  useCategories: () => ({ categories: [], loading: false }),
}));

vi.mock('../hooks/useAccountBalance.ts', () => ({
  useAccountBalance: () => ({
    balance: fromCents(0),
    loading: false,
    refresh: vi.fn(),
  }),
}));

import { TransactionsPage } from './TransactionsPage.tsx';

function account(id: string, name: string): Account {
  return {
    id,
    name,
    type: 'bank',
    initialBalance: fromCents(0),
    isActive: true,
    description: null,
    bankCode: '',
  };
}

function renderTransactions(initialEntry: string) {
  const router = createMemoryRouter(
    [{ path: '/transactions', element: createElement(TransactionsPage) }],
    { initialEntries: [initialEntry] },
  );
  render(createElement(RouterProvider, { router }));
  return router;
}

describe('Transactions account query', () => {
  beforeEach(() => {
    accountsState.accounts = [
      account('acc-checking', 'Checking'),
      account('acc-card', 'Card'),
    ];
    accountsState.loading = false;
  });

  it('selects the account from the query', () => {
    renderTransactions('/transactions?account=acc-checking');

    const filter = screen.getByLabelText('Account filter') as HTMLSelectElement;
    expect(filter.value).toBe('acc-checking');
  });

  it('keeps an account query while accounts are still loading', async () => {
    accountsState.loading = true;
    accountsState.accounts = [];
    const router = renderTransactions('/transactions?account=acc-checking');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?account=acc-checking');
    });
  });

  it('drops an unknown account query and shows all accounts', async () => {
    const router = renderTransactions('/transactions?account=missing');

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    const filter = screen.getByLabelText('Account filter') as HTMLSelectElement;
    expect(filter.value).toBe('');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('writes the dropdown choice into the query without a new history entry', () => {
    const router = renderTransactions('/transactions');
    const filter = screen.getByLabelText('Account filter');

    fireEvent.change(filter, { target: { value: 'acc-card' } });

    expect(router.state.location.search).toBe('?account=acc-card');
    expect(router.state.historyAction).toBe('REPLACE');

    fireEvent.change(filter, { target: { value: '' } });

    expect(router.state.location.search).toBe('');
    expect(router.state.historyAction).toBe('REPLACE');
  });
});
