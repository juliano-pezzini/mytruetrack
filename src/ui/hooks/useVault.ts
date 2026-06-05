import { useContext } from 'react';
import { VaultContext } from '../../app/vault-provider.tsx';

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return ctx;
}
