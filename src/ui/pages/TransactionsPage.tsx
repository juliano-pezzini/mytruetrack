import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts.ts';
import { useTransactions } from '../hooks/useTransactions.ts';
import { useCategories } from '../hooks/useCategories.ts';
import { TransactionForm } from '../components/TransactionForm.tsx';
import { MoneyDisplay } from '../components/MoneyDisplay.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { PeriodRangePicker } from '../components/PeriodRangePicker.tsx';
import type { Transaction, CreateTransactionParams } from '../../domain/transaction.ts';
import { toCents, add, subtract } from '../../domain/money.ts';
import type { Money } from '../../domain/money.ts';
import { useAccountBalance } from '../hooks/useAccountBalance.ts';
import {
  currentCalendarMonth,
  dayBeforeSpan,
  formatSpanLabel,
  inclusiveDateRange,
  type MonthSpan,
} from '../../domain/period-span.ts';

function initialSpan(): MonthSpan {
  const month = currentCalendarMonth(new Date());
  return { start: month, end: month };
}

/** null = All accounts filter */
export function TransactionsPage() {
  const { accounts, loading: accountsLoading } = useAccounts();
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountParam = searchParams.get('account');
  const accountParamIsKnown =
    accountParam !== null && accounts.some((account) => account.id === accountParam);
  const selectedAccountId = accountParamIsKnown ? accountParam : null;
  const [today] = useState(() => currentCalendarMonth(new Date()));
  const [span, setSpan] = useState(initialSpan);

  useEffect(() => {
    if (accountsLoading || accountParam === null || accountParamIsKnown) return;
    const next = new URLSearchParams(searchParams);
    next.delete('account');
    setSearchParams(next, { replace: true });
  }, [accountsLoading, accountParam, accountParamIsKnown, searchParams, setSearchParams]);
  const range = useMemo(() => inclusiveDateRange(span), [span]);
  const balanceDate = useMemo(() => dayBeforeSpan(span), [span]);

  const allAccountsMode = selectedAccountId === null;

  const { transactions, create, update, remove } = useTransactions(
    accounts.length === 0 ? '' : selectedAccountId,
    range,
  );
  const { balance: startBalance } = useAccountBalance(
    allAccountsMode ? null : selectedAccountId,
    balanceDate,
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
    // All accounts: newest first (TXNF-02). Single account: oldest first for running balance.
    return [...scoped].sort((a, b) => {
      const byDate = allAccountsMode
        ? b.transactionDate.localeCompare(a.transactionDate)
        : a.transactionDate.localeCompare(b.transactionDate);
      if (byDate !== 0) return byDate;
      return allAccountsMode ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    });
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
    const params = new URLSearchParams(searchParams);
    if (next === null) params.delete('account');
    else params.set('account', next);
    setSearchParams(params, { replace: true });
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

  const monthLabel = formatSpanLabel(span);

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

          <PeriodRangePicker span={span} today={today} onChange={setSpan} />
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
