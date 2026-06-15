import { useAutoSync } from '../hooks/useAutoSync.ts';

/**
 * Subtle sync-status indicator for the layout header (ASYNC-07).
 *
 * Renders nothing while idle — in local-only mode (no provider) the status is
 * always idle, so showing a "synced" badge there would be misleading. Only the
 * active "syncing" and "pending" states are surfaced.
 */
export function SyncStatusIndicator() {
  const { status } = useAutoSync();

  if (status === 'syncing') {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-gray-500"
        role="status"
        aria-live="polite"
      >
        <span
          className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
          aria-hidden="true"
        />
        Syncing…
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-amber-600"
        role="status"
        aria-live="polite"
        title="Changes will sync when the connection returns."
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        Sync pending
      </span>
    );
  }

  return null;
}
