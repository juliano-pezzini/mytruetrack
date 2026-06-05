import { useMemo } from 'react';
import { useAccounts } from '../hooks/useAccounts.ts';
import { useAccountBalance } from '../hooks/useAccountBalance.ts';
import { useDatabase } from '../hooks/useDatabase.ts';
import { MoneyDisplay } from '../components/MoneyDisplay.tsx';
import { createTransactionRepository } from '../../storage/repositories/transaction-repository.ts';
import { fromCents, add, toCents, subtract } from '../../domain/money.ts';
import type { Account, AccountType } from '../../domain/account.ts';
import type { Transaction } from '../../domain/transaction.ts';

const TYPE_BADGES: Record<AccountType, { label: string; className: string }> = {
  bank: { label: 'Bank', className: 'bg-blue-100 text-blue-700' },
  credit_card: { label: 'Credit Card', className: 'bg-purple-100 text-purple-700' },
  wallet: { label: 'Wallet', className: 'bg-green-100 text-green-700' },
  transitional: { label: 'Transitional', className: 'bg-gray-100 text-gray-600' },
};

function AccountCard({ account }: { account: Account }) {
  const today = new Date().toISOString().slice(0, 10);
  const { balance } = useAccountBalance(account.id, today);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900 text-sm">{account.name}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[account.type].className}`}>
          {TYPE_BADGES[account.type].label}
        </span>
      </div>
      <MoneyDisplay amount={balance} className="text-xl" />
    </div>
  );
}

export function DashboardPage() {
  const db = useDatabase();
  const { accounts } = useAccounts();

  // Net worth: sum of all account balances (computed inline since we need all)
  const netWorth = useMemo(() => {
    let total = fromCents(0);
    // This is a simplified calculation — in production we'd use the balance hook per account
    // For now, iterate accounts and query each
    for (const account of accounts) {
      const repo = createTransactionRepository(db);
      const txns = repo.getByAccount(account.id);
      let balance = account.initialBalance;
      for (const txn of txns) {
        if (txn.type === 'credit') {
          balance = add(balance, txn.amount);
        } else {
          balance = subtract(balance, txn.amount);
        }
      }
      total = add(total, balance);
    }
    return total;
  }, [accounts, db]);

  // Recent transactions (last 10 across all accounts)
  const recentTxns = useMemo(() => {
    const repo = createTransactionRepository(db);
    const all: Transaction[] = [];
    for (const account of accounts) {
      all.push(...repo.getByAccount(account.id));
    }
    return all
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 10);
  }, [accounts, db]);

  // Monthly summary: current month income vs expenses
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const repo = createTransactionRepository(db);
    let income = fromCents(0);
    let expenses = fromCents(0);

    for (const account of accounts) {
      const txns = repo.getByAccount(account.id, { from, to });
      for (const txn of txns) {
        if (txn.type === 'credit') {
          income = add(income, txn.amount);
        } else {
          expenses = add(expenses, txn.amount);
        }
      }
    }
    return { income, expenses };
  }, [accounts, db]);

  // Account name lookup for recent transactions
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.id, a.name);
    return map;
  }, [accounts]);

  const monthLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {/* Net Worth */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-1">Net Worth</p>
        <MoneyDisplay amount={netWorth} className="text-3xl" />
      </div>

      {/* Account Cards */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Accounts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">{monthLabel}</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Income</p>
            <span className="text-lg font-mono tabular-nums text-green-600">
              +{(toCents(monthlySummary.income) / 100).toFixed(2)}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Expenses</p>
            <span className="text-lg font-mono tabular-nums text-red-600">
              −{(toCents(monthlySummary.expenses) / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTxns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Transactions</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Account</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTxns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{txn.transactionDate}</td>
                    <td className="px-4 py-2 text-gray-900">{txn.description}</td>
                    <td className="px-4 py-2 text-gray-500">{accountMap.get(txn.accountId) ?? '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-mono tabular-nums ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'credit' ? '+' : '−'}
                        {(toCents(txn.amount) / 100).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <p className="text-gray-500 text-sm py-8 text-center">
          Create an account to get started.
        </p>
      )}
    </div>
  );
}
