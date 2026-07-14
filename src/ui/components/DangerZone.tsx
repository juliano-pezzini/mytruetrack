import { useState } from 'react';
import { useDatabase } from '../hooks/useDatabase.ts';
import { useVault } from '../hooks/useVault.ts';
import { useAutoSync } from '../hooks/useAutoSync.ts';
import { clearAllData } from '../../storage/clear-all-data.ts';

/** Word the user must type verbatim to enable a destructive action. */
const CONFIRM_WORD = 'DELETE';

type DangerAction = 'clear' | 'reset';

const ACTION_COPY: Record<
  DangerAction,
  { title: string; body: string; confirmLabel: string }
> = {
  clear: {
    title: 'Clear all data',
    body: 'This permanently deletes every account, transaction, category, tag, and rule. Your passphrase and encryption stay in place and you remain signed in. If cloud sync is enabled, the deletion propagates to your other devices.',
    confirmLabel: 'Clear all data',
  },
  reset: {
    title: 'Full reset',
    body: 'This permanently deletes all data AND removes your passphrase, encryption keys, and cloud sync configuration from this device, then restarts onboarding. This cannot be undone.',
    confirmLabel: 'Reset everything',
  },
};

export function DangerZone() {
  const db = useDatabase();
  const { wipeEverything } = useVault();
  const { notifyChange } = useAutoSync();

  const [action, setAction] = useState<DangerAction | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canConfirm = confirmText === CONFIRM_WORD && !busy;

  function openConfirm(next: DangerAction) {
    setAction(next);
    setConfirmText('');
    setError(null);
    setSuccess(null);
  }

  function closeConfirm() {
    if (busy) return;
    setAction(null);
    setConfirmText('');
    setError(null);
  }

  async function handleConfirm() {
    if (!canConfirm || action === null) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'clear') {
        await clearAllData(db);
        notifyChange();
        setAction(null);
        setConfirmText('');
        setSuccess('All data has been deleted.');
      } else {
        await clearAllData(db);
        // Transitions the vault to needs-setup; the app swaps to the setup wizard.
        await wipeEverything();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The operation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-300 bg-red-50/50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-red-800">Clear all data</p>
          <p className="text-xs text-red-700/80 max-w-md">
            Delete every account, transaction, category, tag, and rule. Keeps your passphrase and
            keeps you signed in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openConfirm('clear')}
          className="shrink-0 rounded-lg border border-red-400 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          Clear all data…
        </button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap border-t border-red-200 pt-4">
        <div>
          <p className="text-sm font-semibold text-red-800">Full reset</p>
          <p className="text-xs text-red-700/80 max-w-md">
            Delete all data and remove your passphrase, keys, and sync settings from this device,
            then restart onboarding.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openConfirm('reset')}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors"
        >
          Full reset…
        </button>
      </div>

      {success && <p className="text-xs text-green-700">{success}</p>}

      {action !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeConfirm} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="danger-confirm-title"
            className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
          >
            <h3 id="danger-confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
              {ACTION_COPY[action].title}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{ACTION_COPY[action].body}</p>
            <label htmlFor="danger-confirm-input" className="block text-xs text-gray-600 mb-1">
              Type <span className="font-mono font-semibold text-red-700">{CONFIRM_WORD}</span> to
              confirm.
            </label>
            <input
              id="danger-confirm-input"
              type="text"
              autoFocus
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Working…' : ACTION_COPY[action].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
