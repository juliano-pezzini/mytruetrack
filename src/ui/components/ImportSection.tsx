import { useState, useCallback } from 'react';
import { useDatabase } from '../hooks/useDatabase.ts';
import { useAccounts } from '../hooks/useAccounts.ts';
import { parseOfx } from '../../workers/ofx-parser.ts';
import { parseXlsx } from '../../workers/xlsx-parser.ts';
import { importTransactions } from '../../workers/import-service.ts';
import type { ParsedTransaction } from '../../workers/types.ts';
import type { ImportResult } from '../../workers/types.ts';
import { toCents } from '../../domain/money.ts';

type ImportSectionProps = {
  initialAccountId?: string;
  onImportComplete?: () => void;
};

export function ImportSection({ initialAccountId, onImportComplete }: ImportSectionProps = {}) {
  const db = useDatabase();
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [parsed, setParsed] = useState<ParsedTransaction[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsed(null);
    setResult(null);
    setParseError(null);
    setFileName(file.name);

    try {
      if (file.name.endsWith('.ofx')) {
        const text = await file.text();
        const statement = await parseOfx(text);
        setParsed([...statement.transactions]);
      } else if (file.name.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer();
        const txns = parseXlsx(new Uint8Array(buffer));
        setParsed(txns);
      } else {
        setParseError('Unsupported file type. Use .ofx or .xlsx');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  function handleImport() {
    if (!parsed || !accountId) return;
    setImporting(true);
    try {
      const importResult = importTransactions(db, accountId, parsed);
      setResult(importResult);
      setParsed(null);
      onImportComplete?.();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!initialAccountId && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Target Account</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Statement File</label>
        <input
          type="file"
          accept=".ofx,.xlsx"
          onChange={handleFileChange}
          className="block text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {parseError && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{parseError}</div>
      )}

      {/* Preview */}
      {parsed && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-700">
            <strong>{fileName}</strong> — {parsed.length} transaction
            {parsed.length !== 1 ? 's' : ''} found
          </p>
          {parsed.length > 0 && (
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
                {parsed.slice(0, 5).map((txn, i) => (
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
                {parsed.length > 5 && (
                  <tr>
                    <td colSpan={4} className="py-1 text-gray-400 text-center">
                      …and {parsed.length - 5} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <button
            type="button"
            onClick={handleImport}
            disabled={!accountId || importing}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing…' : `Import ${parsed.length} Transactions`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-green-800">Import Complete</p>
          <p className="text-green-700 mt-1">
            {result.imported} imported, {result.skipped} skipped
            {result.errors.length > 0 && `, ${result.errors.length} errors`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-red-600 text-xs list-disc list-inside">
              {result.errors.map((err, i) => (
                <li key={i}>
                  Row {err.index + 1}: {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
