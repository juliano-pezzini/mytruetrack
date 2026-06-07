import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts.ts';
import { useAccountBalance } from '../hooks/useAccountBalance.ts';
import { AccountForm } from '../components/AccountForm.tsx';
import { MoneyDisplay } from '../components/MoneyDisplay.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { Account, AccountType, CreateAccountParams } from '../../domain/account.ts';
import { toCents } from '../../domain/money.ts';

const TYPE_FILTERS: { value: AccountType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'wallet', label: 'Wallet' },
];

const TYPE_BADGES: Record<AccountType, { label: string; className: string }> = {
  bank: { label: 'Bank', className: 'bg-blue-100 text-blue-700' },
  credit_card: { label: 'Credit Card', className: 'bg-purple-100 text-purple-700' },
  wallet: { label: 'Wallet', className: 'bg-green-100 text-green-700' },
  transitional: { label: 'Transitional', className: 'bg-gray-100 text-gray-600' },
};

function AccountBalanceCell({ accountId }: { accountId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const { balance, loading } = useAccountBalance(accountId, today);
  if (loading) return <span className="text-gray-400">…</span>;
  return <MoneyDisplay amount={balance} />;
}

export function AccountsPage() {
  const { accounts, create, update, remove } = useAccounts();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');

  const filtered = typeFilter === 'all' ? accounts : accounts.filter((a) => a.type === typeFilter);

  function handleCreate(params: CreateAccountParams) {
    create(params);
    setShowForm(false);
  }

  function handleUpdate(
    account: Account,
    changes: Partial<Pick<Account, 'name' | 'type' | 'description'>>,
  ) {
    update(account.id, changes);
    setEditingId(null);
  }

  function handleDelete() {
    if (deleteTarget) {
      remove(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                typeFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          + New Account
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Account</h3>
          <AccountForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Account list */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          No accounts yet. Create one to get started.
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  {editingId === account.id ? (
                    <td colSpan={4} className="px-4 py-3">
                      <AccountForm
                        initial={{
                          name: account.name,
                          type: account.type,
                          initialBalance: (toCents(account.initialBalance) / 100).toFixed(2),
                          description: account.description ?? '',
                        }}
                        submitLabel="Save"
                        onSubmit={(params) =>
                          handleUpdate(account, {
                            name: params.name,
                            type: params.type,
                            description: params.description ?? null,
                          })
                        }
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[account.type].className}`}
                        >
                          {TYPE_BADGES[account.type].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AccountBalanceCell accountId={account.id} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(account.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(account)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
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
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
