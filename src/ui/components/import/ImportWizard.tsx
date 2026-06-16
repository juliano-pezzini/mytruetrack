import { useMemo, useState } from 'react';
import { applyMapping } from '../../../workers/apply-mapping.ts';
import { guessMapping } from '../../../workers/column-detection.ts';
import { importTransactions } from '../../../workers/import-service.ts';
import type { Database } from '../../../storage/database.ts';
import type { ColumnMapping, ImportGrid, ImportResult } from '../../../workers/types.ts';
import { ColumnMapper } from './ColumnMapper.tsx';
import { PreviewTable } from './PreviewTable.tsx';
import { SavedMappingSelector } from './SavedMappingSelector.tsx';

type ImportWizardProps = {
  db: Database;
  accountId: string;
  grid: ImportGrid;
  fileName: string;
  onComplete: () => void;
};

/** True when every column required by the chosen strategy is mapped. */
function isMappingComplete(mapping: ColumnMapping): boolean {
  if (mapping.dateColumn == null || mapping.descriptionColumn == null) return false;
  switch (mapping.amountStrategy) {
    case 'single':
      return mapping.amountColumn != null;
    case 'separate':
      return mapping.debitColumn != null && mapping.creditColumn != null;
    case 'type_column':
      return mapping.amountColumn != null && mapping.typeColumn != null;
    default:
      return false;
  }
}

/**
 * Column-mapping wizard for XLSX/CSV imports: auto-detects a mapping, lets the user
 * adjust it with a live preview, optionally save it, then imports the transactions.
 */
export function ImportWizard({ db, accountId, grid, fileName, onComplete }: ImportWizardProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => guessMapping(grid));
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = isMappingComplete(mapping);
  const preview = useMemo(
    () => (complete ? applyMapping(grid, mapping) : { transactions: [], warnings: [] }),
    [grid, mapping, complete],
  );

  function handleImport() {
    if (!complete || !accountId || preview.transactions.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      setResult(importTransactions(db, accountId, preview.transactions));
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
        <p className="font-medium text-green-800">Import Complete</p>
        <p className="text-green-700 mt-1">
          {result.imported} imported, {result.skipped} skipped
          {result.errors.length > 0 && `, ${result.errors.length} errors`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        <strong>{fileName}</strong> — {grid.rows.length} row{grid.rows.length !== 1 ? 's' : ''} found
      </p>

      <ColumnMapper headers={grid.headers} mapping={mapping} onChange={setMapping} />

      {complete ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <PreviewTable result={preview} />
        </div>
      ) : (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          Map all required columns to preview the transactions.
        </p>
      )}

      <SavedMappingSelector
        accountId={accountId}
        currentConfig={mapping}
        onLoad={(config) => setMapping(config)}
      />

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

      <button
        type="button"
        onClick={handleImport}
        disabled={!complete || importing || preview.transactions.length === 0}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {importing ? 'Importing…' : `Import ${preview.transactions.length} Transactions`}
      </button>
    </div>
  );
}
