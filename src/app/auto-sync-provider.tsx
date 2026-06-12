/**
 * AutoSyncProvider — wires the framework-agnostic auto-sync controller to the live
 * database, vault DEK, persisted cloud config, and browser connectivity events.
 *
 * Mounted inside DatabaseProvider (needs the DB) and below VaultProvider (needs the DEK).
 * Exposes `{ status, notifyChange }`; data hooks call `notifyChange()` after writes and
 * the header indicator reads `status`.
 */

import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDatabase } from '../ui/hooks/useDatabase.ts';
import { useVault } from '../ui/hooks/useVault.ts';
import {
  createAutoSyncController,
  type AutoSyncController,
  type AutoSyncStatus,
} from '../sync/auto-sync-engine.ts';
import { resolveActiveProvider } from '../sync/active-provider.ts';
import { loadSyncConfig, saveSyncConfig } from '../sync/sync-config.ts';
import { pushChanges, pullChanges } from '../sync/sync-engine.ts';
import type { CloudProvider } from '../sync/cloud-provider.ts';

export type AutoSyncContextValue = {
  readonly status: AutoSyncStatus;
  /** Signal that local data changed; schedules a debounced background push. */
  readonly notifyChange: () => void;
};

export const AutoSyncContext = createContext<AutoSyncContextValue>({
  status: 'idle',
  notifyChange: () => {},
});

export function AutoSyncProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const { dek } = useVault();
  const [status, setStatus] = useState<AutoSyncStatus>('idle');
  const controllerRef = useRef<AutoSyncController | null>(null);

  useEffect(() => {
    let disposed = false;

    async function getProvider(): Promise<CloudProvider | null> {
      const config = await loadSyncConfig();
      const resolved = await resolveActiveProvider(config);
      if (resolved.kind !== 'ok') return null;
      // Persist silently-refreshed Google tokens so the next call reuses them.
      if (resolved.config !== config) {
        await saveSyncConfig(resolved.config);
      }
      return resolved.provider;
    }

    const controller = createAutoSyncController({
      getProvider,
      push: (provider) => pushChanges(db, provider, dek),
      pull: (provider) => pullChanges(db, provider, dek),
      onStatusChange: (next) => {
        if (!disposed) setStatus(next);
      },
    });
    controllerRef.current = controller;

    void controller.pullOnLoad();

    const onOnline = () => controller.retryPending();
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      window.removeEventListener('online', onOnline);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [db, dek]);

  const notifyChange = useCallback(() => {
    controllerRef.current?.notifyChange();
  }, []);

  return <AutoSyncContext value={{ status, notifyChange }}>{children}</AutoSyncContext>;
}
