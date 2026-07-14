// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the teardown collaborators so the render test observes the provider wiring,
// not the real key-store / sync IndexedDB.
vi.mock('../crypto/key-store.ts', () => ({
  hasKeyData: vi.fn().mockResolvedValue(false),
  clearKeyData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../sync/sync-config.ts', () => ({
  clearSyncConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../sync/sync-state.ts', () => ({
  clearSyncState: vi.fn().mockResolvedValue(undefined),
}));

import { VaultProvider } from './vault-provider.tsx';
import { useVault } from '../ui/hooks/useVault.ts';
import { clearKeyData } from '../crypto/key-store.ts';
import { clearSyncConfig } from '../sync/sync-config.ts';
import { clearSyncState } from '../sync/sync-state.ts';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(VaultProvider, null, children);

describe('VaultProvider.wipeEverything (rendered)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('is exposed via context and, when invoked, tears down identity and returns to needs-setup', async () => {
    // Start from a ready (local-only) vault so we can observe the transition.
    localStorage.setItem('vault-skipped', 'true');

    const { result } = renderHook(() => useVault(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(typeof result.current.wipeEverything).toBe('function');

    await act(async () => {
      await result.current.wipeEverything();
    });

    expect(clearKeyData).toHaveBeenCalledOnce();
    expect(clearSyncConfig).toHaveBeenCalledOnce();
    expect(clearSyncState).toHaveBeenCalledOnce();
    expect(localStorage.getItem('vault-skipped')).toBeNull();
    expect(result.current.status).toBe('needs-setup');
    expect(result.current.dek).toBeNull();
  });
});
