import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { hasKeyData, clearKeyData } from '../crypto/key-store.ts';
import { clearSyncConfig } from '../sync/sync-config.ts';
import { clearSyncState } from '../sync/sync-state.ts';

const VAULT_SKIPPED_KEY = 'vault-skipped';

export type VaultStatus = 'loading' | 'needs-setup' | 'needs-unlock' | 'ready';

export type VaultContextValue = {
  /** Data encryption key. Present = data is encrypted. Null = no encryption. */
  readonly dek: CryptoKey | null;
  readonly status: VaultStatus;
  readonly unlock: (dek: CryptoKey) => void;
  readonly skipToLocalOnly: () => void;
  readonly reset: () => Promise<void>;
  /**
   * Tear down all local identity: crypto keys, sync config, and sync state, then return to
   * the setup wizard. Data-table rows are wiped separately (by the caller, which holds the
   * DB handle) before this runs. Used by the Settings "Full reset" action.
   */
  readonly wipeEverything: () => Promise<void>;
};

export const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [dek, setDek] = useState<CryptoKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const skipped = localStorage.getItem(VAULT_SKIPPED_KEY) === 'true';
      if (skipped) {
        if (!cancelled) {
          setStatus('ready');
        }
        return;
      }

      const hasVault = await hasKeyData();
      if (cancelled) return;

      if (hasVault) {
        setStatus('needs-unlock');
      } else {
        setStatus('needs-setup');
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback((key: CryptoKey) => {
    setDek(key);
    setStatus('ready');
  }, []);

  const skipToLocalOnly = useCallback(() => {
    localStorage.setItem(VAULT_SKIPPED_KEY, 'true');
    setDek(null);
    setStatus('ready');
  }, []);

  const reset = useCallback(async () => {
    await clearKeyData();
    localStorage.removeItem(VAULT_SKIPPED_KEY);
    setDek(null);
    setStatus('needs-setup');
  }, []);

  const wipeEverything = useCallback(async () => {
    await clearKeyData();
    await clearSyncConfig();
    await clearSyncState();
    localStorage.removeItem(VAULT_SKIPPED_KEY);
    setDek(null);
    setStatus('needs-setup');
  }, []);

  const value: VaultContextValue = {
    dek,
    status,
    unlock,
    skipToLocalOnly,
    reset,
    wipeEverything,
  };

  return <VaultContext value={value}>{children}</VaultContext>;
}
