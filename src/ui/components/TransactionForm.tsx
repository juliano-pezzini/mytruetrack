import { useState } from 'react';
import type { TransactionType, CreateTransactionParams } from '../../domain/transaction.ts';
import type { Category } from '../../domain/category.ts';
import type { Account } from '../../domain/account.ts';
import { fromDecimal } from '../../domain/money.ts';

type TransactionFormProps = {
  onSubmit: (params: CreateTransactionParams) => void;
  onCancel: () => void;
  categories: Category[];
  /** Fixed account for single-account create or edit. Omit when using the picker. */
  accountId?: string;
  /** Active accounts for the create-time picker (All-accounts mode). */
  accounts?: readonly Account[];
  initial?: {
    amount: string;
    description: string;
    transactionDate: string;
    type: TransactionType;
    categoryId: string;
  };
  submitLabel?: string;
};

export function TransactionForm({
  onSubmit,
  onCancel,
  categories,
  accountId,
  accounts,
  initial,
  submitLabel = 'Create',
}: TransactionFormProps) {
  const showAccountPicker = accountId === undefined && accounts !== undefined;
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(
    initial?.transactionDate ?? new Date().toISOString().slice(0, 10),
  );
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'debit');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resolvedAccountId = accountId ?? selectedAccountId;
    if (!resolvedAccountId) {
      setError('Account is required');
      return;
    }
    try {
      onSubmit({
        id: crypto.randomUUID(),
        accountId: resolvedAccountId,
        amount: fromDecimal(amount),
        description,
        transactionDate: date,
        type,
        categoryId: categoryId || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      {showAccountPicker && (
        <div>
          <label htmlFor="txn-account" className="block text-sm font-medium text-gray-700 mb-1">
            Account
          </label>
          <select
            id="txn-account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="txn-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            id="txn-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label htmlFor="txn-type" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="txn-type"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="debit">Debit (expense)</option>
            <option value="credit">Credit (income)</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="txn-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          id="txn-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="txn-date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id="txn-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label htmlFor="txn-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="txn-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
