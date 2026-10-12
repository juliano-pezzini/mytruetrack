import { useState, useMemo } from 'react';
import { useAccounts } from '../hooks/useAccounts.ts';
import { useTransactions } from '../hooks/useTransactions.ts';
import { useCategories } from '../hooks/useCategories.ts';
import { TransactionForm } from '../components/TransactionForm.tsx';
import { MoneyDisplay } from '../components/MoneyDisplay.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { Transaction, CreateTransactionParams } from '../../domain/transaction.ts';
import { toCents, add, subtract } from '../../domain/money.ts';
import type { Money } from '../../domain/money.ts';
import { useAccountBalance } from '../hooks/useAccountBalance.ts';

function getCurrentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

/** null = All accounts filter */
export function TransactionsPage() {
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [period, setPeriod] = useState(getCurrentMonth);
  const range = useMemo(() => monthRange(period.year, period.month), [period.year, period.month]);

  const allAccountsMode = selectedAccountId === null;

  const { transactions, create, update, remove } = useTransactions(
    accounts.length === 0 ? '' : selectedAccountId,
    range,
  );
  const { balance: startBalance } = useAccountBalance(
    allAccountsMode ? null : selectedAccountId,
    // Day before the month starts
    (() => {
      const d = new Date(period.year, period.month - 1, 0);
      return d.toISOString().slice(0, 10);
    })(),
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.id, a.name);
    return map;
  }, [accounts]);

  const activeAccountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);

  // Category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const visibleTxns = useMemo(() => {
    const scoped = allAccountsMode
      ? transactions.filter((t) => activeAccountIds.has(t.accountId))
      : transactions;
    return [...scoped].sort(
      (a, b) => a.transactionDate.localeCompare(b.transactionDate) || a.id.localeCompare(b.id),
    );
  }, [transactions, allAccountsMode, activeAccountIds]);

  const runningBalances = useMemo(() => {
    if (allAccountsMode) return [] as Money[];
    const balances: Money[] = [];
    let running = startBalance;
    for (const txn of visibleTxns) {
      if (txn.type === 'credit') {
        running = add(running, txn.amount);
      } else {
        running = subtract(running, txn.amount);
      }
      balances.push(running);
    }
    return balances;
  }, [visibleTxns, startBalance, allAccountsMode]);

  function selectAccountFilter(next: string | null) {
    const prevAll = selectedAccountId === null;
    const nextAll = next === null;
    if (prevAll !== nextAll || selectedAccountId !== next) {
      setShowForm(false);
      setEditingId(null);
    }
    setSelectedAccountId(next);
  }

  function handleCreate(params: CreateTransactionParams) {
    create(params);
    setShowForm(false);
  }

  function handleDelete() {
    if (deleteTarget) {
      remove(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  function prevMonth() {
    setPeriod((p) => {
      if (p.month === 1) return { year: p.year - 1, month: 12 };
      return { year: p.year, month: p.month - 1 };
    });
  }

  function nextMonth() {
    setPeriod((p) => {
      if (p.month === 12) return { year: p.year + 1, month: 1 };
      return { year: p.year, month: p.month + 1 };
    });
  }

  const monthLabel = new Date(period.year, period.month - 1).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            aria-label="Account filter"
            value={selectedAccountId ?? ''}
            onChange={(e) => selectAccountFilter(e.target.value || null)}
            className="border border-mtt-border rounded-lg px-3 py-2 text-sm bg-mtt-surface text-mtt-fg focus:outline-none focus:ring-2 focus:ring-mtt-accent"
          >
            {accounts.length === 0 ? (
              <option value="">No accounts</option>
            ) : (
              <>
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </>
            )}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 text-mtt-muted hover:bg-mtt-border/50 rounded-md transition-colors"
              aria-label="Previous month"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-sm font-medium text-mtt-fg min-w-[140px] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 text-mtt-muted hover:bg-mtt-border/50 rounded-md transition-colors"
              aria-label="Next month"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-mtt-accent rounded-lg hover:opacity-90 transition-opacity"
          >
            + New Transaction
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && accounts.length > 0 && (
        <div className="bg-mtt-surface rounded-xl border border-mtt-border p-5">
          <h3 className="text-sm font-semibold text-mtt-fg mb-3">New Transaction</h3>
          {allAccountsMode ? (
            <TransactionForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              categories={categories}
              accounts={accounts}
            />
          ) : (
            <TransactionForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              categories={categories}
              accountId={selectedAccountId!}
            />
          )}
        </div>
      )}

      {/* Transactions list */}
      {accounts.length === 0 ? (
        <p className="text-mtt-muted text-sm py-8 text-center">
          Create an account first to add transactions.
        </p>
      ) : visibleTxns.length === 0 ? (
        <p className="text-mtt-muted text-sm py-8 text-center">No transactions for {monthLabel}.</p>
      ) : (
        <div className="bg-mtt-surface rounded-xl border border-mtt-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mtt-border bg-mtt-bg">
                <th className="text-left px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">
                  Date
                </th>
                {allAccountsMode && (
                  <th className="text-left px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">
                    Account
                  </th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">
                  Description
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">
                  Category
                </th>
                <th className="text-right px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">
                  Amount
                </th>
                {!allAccountsMode && (
                  <th className="text-right px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted">
                    Balance
                  </th>
                )}
                <th className="text-right px-4 py-3 font-semibold text-[10px] uppercase tracking-widest text-mtt-muted w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mtt-border">
              {visibleTxns.map((txn, i) => (
                <tr key={txn.id} className="hover:bg-mtt-bg transition-colors">
                  {editingId === txn.id ? (
                    <td colSpan={6} className="px-4 py-3">
                      <TransactionForm
                        initial={{
                          amount: (toCents(txn.amount) / 100).toFixed(2),
                          description: txn.description,
                          transactionDate: txn.transactionDate,
                          type: txn.type,
                          categoryId: txn.categoryId ?? '',
                        }}
                        submitLabel="Save"
                        categories={categories}
                        accountId={txn.accountId}
                        onSubmit={(params) => {
                          update(txn.id, {
                            description: params.description,
                            transactionDate: params.transactionDate,
                            type: params.type,
                            categoryId: params.categoryId,
                          });
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-mtt-muted text-xs font-mono">
                        {txn.transactionDate}
                      </td>
                      {allAccountsMode && (
                        <td className="px-4 py-3 text-mtt-fg text-xs">
                          {accountNameById.get(txn.accountId) ?? '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-mtt-fg font-medium">{txn.description}</td>
                      <td className="px-4 py-3">
                        {txn.categoryId && categoryMap.has(txn.categoryId) ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-mtt-muted bg-mtt-bg px-2 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-mtt-accent flex-shrink-0" />
                            {categoryMap.get(txn.categoryId)}
                          </span>
                        ) : (
                          <span className="text-mtt-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono tabular-nums font-semibold ${txn.type === 'credit' ? 'text-mtt-positive' : 'text-mtt-negative'}`}
                        >
                          {txn.type === 'credit' ? '+' : '−'}
                          {(toCents(txn.amount) / 100).toFixed(2)}
                        </span>
                      </td>
                      {!allAccountsMode && (
                        <td className="px-4 py-3 text-right">
                          <MoneyDisplay
                            amount={runningBalances[i]!}
                            className="text-xs text-mtt-muted"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(txn.id)}
                          className="text-mtt-accent hover:opacity-70 text-xs font-medium mr-3 transition-opacity"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(txn)}
                          className="text-mtt-negative hover:opacity-70 text-xs font-medium transition-opacity"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Transaction"
        message={`Delete "${deleteTarget?.description}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
