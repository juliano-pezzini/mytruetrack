import { useCallback, useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase.ts';
import { useAutoSync } from '../hooks/useAutoSync.ts';
import {
  todaySaoPauloDate,
  useMercadoPagoImport,
} from '../hooks/useMercadoPagoImport.ts';
import {
  suggestAccountImportPeriod,
} from '../../domain/account-import-period.ts';
import {
  createAccountImportLogRepository,
  type AccountImportLog,
} from '../../storage/repositories/account-import-log-repository.ts';
import { MERCADO_PAGO_IMPORT_SOURCE } from '../../workers/mercado-pago-import.ts';
import { deleteAccountImportRun } from '../../workers/delete-account-import-run.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

// TODO(P2): Same install-time placeholder as InvestPassImportPage — production discovery later.
const EXTENSION_ID = 'mytruetrack-investpass-extension';

type MercadoPagoImportModalProps = {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onImported?: () => void;
};

export function MercadoPagoImportModal({
  accountId,
  accountName,
  onClose,
  onImported,
}: MercadoPagoImportModalProps) {
  const db = useDatabase();
  const { notifyChange } = useAutoSync();
  const { status, summary, error, startImport, cancel } = useMercadoPagoImport(EXTENSION_ID);

  const [logs, setLogs] = useState<AccountImportLog[]>([]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodReady, setPeriodReady] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountImportLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshLogs = useCallback(async () => {
    const repo = createAccountImportLogRepository(db);
    const rows = await repo.listByAccount(accountId, MERCADO_PAGO_IMPORT_SOURCE);
    setLogs(rows);
    return rows;
  }, [db, accountId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await refreshLogs();
      if (cancelled) return;
      const suggested = suggestAccountImportPeriod(rows, todaySaoPauloDate());
      setPeriodStart(suggested.start);
      setPeriodEnd(suggested.end);
      setPeriodReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLogs]);

  useEffect(() => {
    if (status === 'done') {
      void refreshLogs().then(() => onImported?.());
    }
  }, [status, refreshLogs, onImported]);

  const waiting = status === 'waiting_for_session';
  const busy =
    status === 'connecting' ||
    status === 'fetching' ||
    status === 'waiting_for_session' ||
    status === 'importing';

  function handleStart() {
    void startImport(accountId, periodStart, periodEnd);
  }

  function handleClose() {
    if (waiting) cancel();
    onClose();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAccountImportRun(db, deleteTarget.id);
      notifyChange();
      setDeleteTarget(null);
      await refreshLogs();
      onImported?.();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-mtt-surface rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-mtt-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-mtt-fg">
            Import from Mercado Pago — <span className="text-mtt-accent">{accountName}</span>
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-mtt-muted hover:text-mtt-fg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {waiting ? (
          <div
            data-testid="mp-session-wait"
            className="rounded-xl border border-mtt-accent/30 bg-mtt-bg p-5 space-y-4 mb-4"
          >
            <p className="text-sm font-medium text-mtt-fg">Sign in to Mercado Pago</p>
            <p className="text-xs text-mtt-muted">
              Complete sign-in in the opened tab. This window waits until you are signed in or you
              cancel.
            </p>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 text-sm font-medium text-mtt-fg bg-mtt-border rounded-lg hover:opacity-90"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-mtt-border bg-mtt-bg p-5 space-y-4 mb-4">
            <h4 className="text-sm font-semibold text-mtt-fg">Import Period</h4>
            <div className="flex gap-4">
              <label className="flex-1 space-y-1">
                <span className="text-xs text-mtt-muted">Start Date</span>
                <input
                  type="date"
                  data-testid="mp-period-start"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={!periodReady || busy}
                  className="w-full rounded-lg border border-mtt-border bg-mtt-surface px-3 py-2 text-sm text-mtt-fg focus:outline-none focus:ring-2 focus:ring-mtt-accent"
                />
              </label>
              <label className="flex-1 space-y-1">
                <span className="text-xs text-mtt-muted">End Date</span>
                <input
                  type="date"
                  data-testid="mp-period-end"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  disabled={!periodReady || busy}
                  className="w-full rounded-lg border border-mtt-border bg-mtt-surface px-3 py-2 text-sm text-mtt-fg focus:outline-none focus:ring-2 focus:ring-mtt-accent"
                />
              </label>
            </div>
            <button
              type="button"
              data-testid="mp-import-button"
              disabled={!periodReady || busy}
              onClick={handleStart}
              className="w-full rounded-lg bg-mtt-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mtt-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Importing…' : 'Sign in to Mercado Pago'}
            </button>
          </div>
        )}

        {status === 'error' && error && (
          <div
            data-testid="mp-import-error"
            className="rounded-xl border border-mtt-negative/30 bg-mtt-negative-pale p-4 text-sm text-mtt-negative mb-4"
          >
            {error}
          </div>
        )}

        {status === 'done' && summary && (
          <div
            data-testid="mp-import-summary"
            className="rounded-xl border border-mtt-positive/30 bg-mtt-positive-pale p-4 text-sm text-mtt-positive mb-4"
          >
            Import complete: {summary.imported} imported, {summary.skipped} skipped,{' '}
            {summary.errorCount} errors
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-mtt-fg">Import runs</h4>
          {logs.length === 0 ? (
            <p className="text-sm text-mtt-muted">No Mercado Pago imports yet.</p>
          ) : (
            <ul data-testid="mp-import-runs" className="space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-mtt-border bg-mtt-bg px-3 py-2 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-mtt-fg">
                      {log.periodStart} → {log.periodEnd}
                    </p>
                    <p className="text-xs text-mtt-muted">
                      {new Date(log.importedAt).toLocaleString()} · {log.importedCount} imported,{' '}
                      {log.skippedCount} skipped, {log.errorCount} errors
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(log)}
                    className="text-xs font-medium text-mtt-negative hover:opacity-80"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete import run"
        message="Delete this import run and the transactions it inserted? This cannot be undone."
        confirmLabel="Delete"
        confirmDisabled={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
