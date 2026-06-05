import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { hasKeyData, clearKeyData } from '../crypto/key-store.ts';

const VAULT_SKIPPED_KEY = 'vault-skipped';

export type VaultStatus = 'loading' | 'needs-setup' | 'needs-unlock' | 'ready';

export type VaultContextValue = {
  /** Data encryption key. Present = data is encrypted. Null = no encryption. */
  readonly dek: CryptoKey | null;
  readonly status: VaultStatus;
  readonly unlock: (dek: CryptoKey) => void;
  readonly skipToLocalOnly: () => void;
  readonly reset: () => Promise<void>;
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

  const value: VaultContextValue = { dek, status, unlock, skipToLocalOnly, reset };

  return <VaultContext value={value}>{children}</VaultContext>;
}
