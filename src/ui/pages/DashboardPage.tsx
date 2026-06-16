import { useMemo, useState } from 'react';
import { useAccounts } from '../hooks/useAccounts.ts';
import { useAccountBalance } from '../hooks/useAccountBalance.ts';
import { useDatabase } from '../hooks/useDatabase.ts';
import { MoneyDisplay } from '../components/MoneyDisplay.tsx';
import { ImportModal } from '../components/ImportModal.tsx';
import { createTransactionRepository } from '../../storage/repositories/transaction-repository.ts';
import { fromCents, add, toCents, subtract } from '../../domain/money.ts';
import type { Account, AccountType } from '../../domain/account.ts';
import type { Transaction } from '../../domain/transaction.ts';

const TYPE_BADGES: Record<AccountType, { label: string; className: string }> = {
  bank: { label: 'Bank', className: 'bg-mtt-accent-pale text-mtt-accent' },
  credit_card: { label: 'Credit Card', className: 'bg-mtt-negative-pale text-mtt-negative' },
  wallet: { label: 'Wallet', className: 'bg-mtt-positive-pale text-mtt-positive' },
  transitional: { label: 'Transitional', className: 'bg-gray-100 text-gray-500' },
};

function AccountCard({
  account,
  onImport,
}: {
  account: Account;
  onImport: (account: Account) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { balance } = useAccountBalance(account.id, today);

  return (
    <div className="bg-mtt-surface rounded-xl border border-mtt-border p-5 flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-mtt-muted mb-1">
          {TYPE_BADGES[account.type].label}
        </p>
        <div
          className={`text-2xl font-extrabold tabular-nums tracking-tight ${
            account.type === 'credit_card' ? 'text-mtt-negative' : 'text-mtt-fg'
          }`}
        >
          <MoneyDisplay amount={balance} className="" />
        </div>
        <p className="text-sm font-medium text-mtt-fg mt-0.5">{account.name}</p>
      </div>
      <div className="flex justify-end pt-1 border-t border-mtt-border">
        <button
          type="button"
          onClick={() => onImport(account)}
          className="text-xs text-mtt-accent hover:text-mtt-accent/80 font-medium flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Import
        </button>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const db = useDatabase();
  const { accounts } = useAccounts();
  const [importTarget, setImportTarget] = useState<Account | null>(null);

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
    return all.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).slice(0, 10);
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

  const incomeVal = toCents(monthlySummary.income) / 100;
  const expensesVal = toCents(monthlySummary.expenses) / 100;
  const ratioTotal = incomeVal + expensesVal;
  const incomeRatio = ratioTotal > 0 ? (incomeVal / ratioTotal) * 100 : 50;

  return (
    <div className="space-y-6">
      {/* Net Worth hero */}
      <div
        className="rounded-xl p-7 relative overflow-hidden"
        style={{ background: 'oklch(16% 0.018 245)' }}
      >
        {/* ambient glow */}
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, oklch(58% 0.17 240 / 0.15), transparent 70%)',
          }}
        />
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Net Worth
        </p>
        <div className="flex items-baseline gap-4 flex-wrap">
          <MoneyDisplay
            amount={netWorth}
            className="text-4xl font-extrabold tabular-nums tracking-tight text-white"
          />
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' }}
          >
            {monthLabel}
          </span>
        </div>

        {/* Income / expense ratio bar */}
        {ratioTotal > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Income
            </span>
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${incomeRatio}%`,
                  background: 'oklch(54% 0.14 155)',
                }}
              />
            </div>
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Expenses
            </span>
          </div>
        )}
      </div>

      {/* Account Cards */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-mtt-muted mb-3">
            Accounts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} onImport={setImportTarget} />
            ))}
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      <div className="bg-mtt-surface rounded-xl border border-mtt-border p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-mtt-muted mb-5">
          {monthLabel}
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-mtt-muted mb-1.5">Income</p>
            <span className="text-xl font-extrabold tabular-nums text-mtt-positive">
              +{incomeVal.toFixed(2)}
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-mtt-muted mb-1.5">Expenses</p>
            <span className="text-xl font-extrabold tabular-nums text-mtt-negative">
              −{expensesVal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTxns.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-mtt-muted mb-3">
            Recent Transactions
          </h2>
          <div className="bg-mtt-surface rounded-xl border border-mtt-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mtt-border bg-mtt-bg">
                  <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">Description</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">Account</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mtt-border">
                {recentTxns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-mtt-bg transition-colors">
                    <td className="px-4 py-3 text-mtt-muted text-xs font-mono">{txn.transactionDate}</td>
                    <td className="px-4 py-3 text-mtt-fg font-medium">{txn.description}</td>
                    <td className="px-4 py-3 text-mtt-muted text-sm">
                      {accountMap.get(txn.accountId) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono tabular-nums font-semibold ${txn.type === 'credit' ? 'text-mtt-positive' : 'text-mtt-negative'}`}
                      >
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
        <p className="text-mtt-muted text-sm py-8 text-center">Create an account to get started.</p>
      )}

      {importTarget && (
        <ImportModal
          accountId={importTarget.id}
          accountName={importTarget.name}
          onClose={() => setImportTarget(null)}
        />
      )}
    </div>
  );
}
