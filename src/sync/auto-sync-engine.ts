/**
 * Auto-sync controller — framework-agnostic orchestration of automatic push/pull.
 *
 * Responsibilities:
 *  - Pull remote data once on app load (ASYNC-01/02).
 *  - Debounce + coalesce pushes triggered by data writes (ASYNC-03/04).
 *  - Track a pending flag when a push fails, for online-retry (ASYNC-05/06).
 *
 * It knows nothing about React, IndexedDB, or the DB itself — all I/O is injected.
 * The React layer (auto-sync-provider) supplies `getProvider`, `push`, and `pull`.
 */

import type { CloudProvider } from './cloud-provider.ts';

export type AutoSyncStatus = 'idle' | 'syncing' | 'pending';

export type AutoSyncDeps = {
  /** Resolve the active provider, or null when sync should be skipped. */
  readonly getProvider: () => Promise<CloudProvider | null>;
  /** Push local state to the given provider. */
  readonly push: (provider: CloudProvider) => Promise<void>;
  /** Pull remote state from the given provider. */
  readonly pull: (provider: CloudProvider) => Promise<void>;
  /** Notified whenever the derived status changes. */
  readonly onStatusChange?: (status: AutoSyncStatus) => void;
  /** Debounce window for coalescing writes into one push. Default 5000 ms. */
  readonly debounceMs?: number;
  /** Error sink (defaults to console.error). Auto-sync never throws to callers. */
  readonly onError?: (context: string, error: unknown) => void;
};

export type AutoSyncController = {
  /** Pull remote data once (call after the DB is initialized). */
  pullOnLoad: () => Promise<void>;
  /** Signal that local data changed; schedules a debounced push. */
  notifyChange: () => void;
  /** Retry a pending (previously failed) push, e.g. when connectivity returns. */
  retryPending: () => void;
  /** Current derived status. */
  getStatus: () => AutoSyncStatus;
  /** Cancel any pending timer. Call on unmount. */
  dispose: () => void;
};

const DEFAULT_DEBOUNCE_MS = 5000;

export function createAutoSyncController(deps: AutoSyncDeps): AutoSyncController {
  const debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const reportError = deps.onError ?? ((ctx, err) => console.error(`[auto-sync] ${ctx}`, err));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let rerunAfter = false; // a write arrived while a push was in flight
  let pending = false; // last push failed; awaiting retry

  function deriveStatus(): AutoSyncStatus {
    if (inFlight) return 'syncing';
    if (pending) return 'pending';
    return 'idle';
  }

  let lastStatus: AutoSyncStatus = 'idle';
  function emitStatus(): void {
    const next = deriveStatus();
    if (next !== lastStatus) {
      lastStatus = next;
      deps.onStatusChange?.(next);
    }
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function doPush(): Promise<void> {
    inFlight = true;
    emitStatus();
    try {
      const provider = await deps.getProvider();
      if (!provider) {
        // Nothing configured (provider removed/tokens cleared) — not a failure.
        // Clear any stale pending flag so status can settle back to idle.
        pending = false;
        return;
      }
      await deps.push(provider);
      pending = false;
    } catch (err) {
      pending = true;
      reportError('push failed', err);
    } finally {
      inFlight = false;
      emitStatus();
      if (rerunAfter) {
        rerunAfter = false;
        void doPush();
      }
    }
  }

  function flush(): void {
    clearTimer();
    if (inFlight) {
      // A write landed mid-push; schedule another push once the current one finishes.
      rerunAfter = true;
      return;
    }
    void doPush();
  }

  return {
    async pullOnLoad(): Promise<void> {
      try {
        const provider = await deps.getProvider();
        if (!provider) return;
        inFlight = true;
        emitStatus();
        try {
          await deps.pull(provider);
        } finally {
          inFlight = false;
          emitStatus();
        }
      } catch (err) {
        // Pull failures must never block the UI — local data remains usable.
        reportError('pull-on-load failed', err);
      }
    },

    notifyChange(): void {
      clearTimer();
      timer = setTimeout(flush, debounceMs);
    },

    retryPending(): void {
      if (pending && !inFlight) {
        void doPush();
      }
    },

    getStatus(): AutoSyncStatus {
      return deriveStatus();
    },

    dispose(): void {
      clearTimer();
    },
  };
}
