import { useState } from 'react';
import { useDatabase } from '../hooks/useDatabase.ts';
import { useVault } from '../hooks/useVault.ts';
import { useAutoSync } from '../hooks/useAutoSync.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { clearAllData } from '../../storage/clear-all-data.ts';

/** Word the user must type verbatim to enable a destructive action. */
const CONFIRM_WORD = 'DELETE';

type DangerAction = 'clear' | 'reset';

const ACTION_COPY: Record<DangerAction, { title: string; body: string; confirmLabel: string }> = {
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
        <ConfirmDialog
          open
          title={ACTION_COPY[action].title}
          message={ACTION_COPY[action].body}
          confirmLabel={busy ? 'Working…' : ACTION_COPY[action].confirmLabel}
          confirmDisabled={!canConfirm}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        >
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
