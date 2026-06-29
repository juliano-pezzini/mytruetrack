import { useState } from 'react';
import { useInvestPassImport } from '../hooks/useInvestPassImport.ts';
import { useAccounts } from '../hooks/useAccounts.ts';
import type { ImportStatus } from '../hooks/useInvestPassImport.ts';

// TODO(P2): The extension ID is assigned at install time by Chrome. For local dev we use
// a placeholder. In production, introduce a Settings field or auto-discovery handshake
// so the user can connect to their installed extension.
const EXTENSION_ID = 'mytruetrack-investpass-extension';

const STATUS_LABELS: Record<ImportStatus, string> = {
  idle: 'Ready',
  connecting: 'Connecting to extension…',
  fetching: 'Fetching transactions…',
  mapping: 'Account mapping required',
  importing: 'Importing transactions…',
  done: 'Import complete',
  error: 'Error',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const start = toLocalDateString(new Date(year, month, 1));
  const end = toLocalDateString(new Date(year, month + 1, 0));
  return { start, end };
}

export function InvestPassImportPage() {
  const { start, end } = defaultPeriod();
  const [periodStart, setPeriodStart] = useState(start);
  const [periodEnd, setPeriodEnd] = useState(end);
  const { status, summary, unmappedAccounts, error, startImport, mapAccount } =
    useInvestPassImport(EXTENSION_ID);
  const { accounts } = useAccounts();

  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});

  const handleImport = () => {
    void startImport(periodStart, periodEnd);
  };

  const handleMapAccount = (investPassName: string) => {
    const selected = mappingSelections[investPassName];
    if (!selected) return;
    void mapAccount(investPassName, selected);
  };

  const isImporting = status === 'connecting' || status === 'fetching' || status === 'importing';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection status */}
      <div
        data-testid="connection-status"
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
          status === 'error'
            ? 'border-mtt-negative/30 bg-mtt-negative-pale text-mtt-negative'
            : status === 'done'
              ? 'border-mtt-positive/30 bg-mtt-positive-pale text-mtt-positive'
              : 'border-mtt-border bg-mtt-surface text-mtt-fg'
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            status === 'error'
              ? 'bg-mtt-negative'
              : status === 'done'
                ? 'bg-mtt-positive'
                : isImporting
                  ? 'bg-mtt-accent animate-pulse'
                  : 'bg-mtt-muted'
          }`}
        />
        <span data-testid="status-text">{STATUS_LABELS[status]}</span>
      </div>

      {/* Period selector */}
      <div className="rounded-xl border border-mtt-border bg-mtt-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold text-mtt-fg">Import Period</h2>
        <div className="flex gap-4">
          <label className="flex-1 space-y-1">
            <span className="text-xs text-mtt-muted">Start Date</span>
            <input
              type="date"
              data-testid="period-start"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-lg border border-mtt-border bg-mtt-bg px-3 py-2 text-sm text-mtt-fg focus:outline-none focus:ring-2 focus:ring-mtt-accent"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-xs text-mtt-muted">End Date</span>
            <input
              type="date"
              data-testid="period-end"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-lg border border-mtt-border bg-mtt-bg px-3 py-2 text-sm text-mtt-fg focus:outline-none focus:ring-2 focus:ring-mtt-accent"
            />
          </label>
        </div>
        <button
          type="button"
          data-testid="import-button"
          disabled={isImporting}
          onClick={handleImport}
          className="w-full rounded-lg bg-mtt-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mtt-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? 'Importing…' : 'Import from InvestPass'}
        </button>
      </div>

      {/* Account mapping section */}
      {status === 'mapping' && unmappedAccounts.length > 0 && (
        <div className="rounded-xl border border-mtt-accent/30 bg-mtt-surface p-5 space-y-4">
          <h2 className="text-sm font-semibold text-mtt-fg">Map Accounts</h2>
          <p className="text-xs text-mtt-muted">
            The following InvestPass accounts are not yet mapped to mytruetrack accounts.
          </p>
          {unmappedAccounts.map((name) => (
            <div key={name} className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <span className="text-xs font-medium text-mtt-fg">{name}</span>
                <select
                  data-testid={`map-select-${name}`}
                  value={mappingSelections[name] ?? ''}
                  onChange={(e) =>
                    setMappingSelections((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-mtt-border bg-mtt-bg px-3 py-2 text-sm text-mtt-fg"
                >
                  <option value="">Select account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleMapAccount(name)}
                disabled={!mappingSelections[name]}
                className="rounded-lg bg-mtt-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Map
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div
          data-testid="import-error"
          className="rounded-xl border border-mtt-negative/30 bg-mtt-negative-pale p-5 text-sm text-mtt-negative"
        >
          {error}
        </div>
      )}

      {/* Summary */}
      {status === 'done' && summary && (
        <div data-testid="import-summary" className="rounded-xl border border-mtt-border bg-mtt-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-mtt-positive">Import Complete</h2>
          {Object.entries(summary.perAccount).map(([accountId, result]) => {
            const acct = accounts.find((a) => a.id === accountId);
            return (
            <div key={accountId} className="flex items-center justify-between text-sm">
              <span className="font-medium text-mtt-fg">{acct?.name ?? accountId}</span>
              <span className="text-mtt-muted">
                {result.imported} imported, {result.skipped} skipped
                {result.errors.length > 0 && `, ${result.errors.length} errors`}
              </span>
            </div>
            );
          })}
          {summary.unmappedAccounts.length > 0 && (
            <p className="text-xs text-mtt-muted">
              Unmapped: {summary.unmappedAccounts.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
