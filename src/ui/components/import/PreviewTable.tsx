import { toCents } from '../../../domain/money.ts';
import type { MappingResult } from '../../../workers/types.ts';

type PreviewTableProps = {
  result: MappingResult;
};

/** Shows parsed transactions plus a per-row warning list from applying a mapping. */
export function PreviewTable({ result }: PreviewTableProps) {
  const { transactions, warnings } = result;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm" data-testid="preview-summary">
        <span className="text-green-700 font-medium">{transactions.length} valid</span>
        {warnings.length > 0 && (
          <span className="text-amber-600 font-medium">{warnings.length} skipped</span>
        )}
      </div>

      {transactions.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-1">Date</th>
              <th className="pb-1">Description</th>
              <th className="pb-1 text-right">Amount</th>
              <th className="pb-1">Type</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 5).map((txn, i) => (
              <tr key={i} className="border-t border-gray-200">
                <td className="py-1 text-gray-600">{txn.date}</td>
                <td className="py-1 text-gray-900">{txn.description}</td>
                <td className="py-1 text-right font-mono">
                  {(toCents(txn.amount) / 100).toFixed(2)}
                </td>
                <td className="py-1">
                  <span className={txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}>
                    {txn.type}
                  </span>
                </td>
              </tr>
            ))}
            {transactions.length > 5 && (
              <tr>
                <td colSpan={4} className="py-1 text-gray-400 text-center">
                  …and {transactions.length - 5} more
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {warnings.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-amber-700">
            {warnings.length} row{warnings.length !== 1 ? 's' : ''} skipped
          </summary>
          <ul className="mt-1 list-disc list-inside text-amber-700 max-h-24 overflow-auto">
            {warnings.slice(0, 20).map((w, i) => (
              <li key={i}>
                Row {w.row + 1}: {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
