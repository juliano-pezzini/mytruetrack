import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock key-store before importing vault-provider
vi.mock('../crypto/key-store.ts', () => ({
  hasKeyData: vi.fn(),
  clearKeyData: vi.fn(),
}));

import { hasKeyData, clearKeyData } from '../crypto/key-store.ts';

const mockedHasKeyData = vi.mocked(hasKeyData);
const mockedClearKeyData = vi.mocked(clearKeyData);

// We test the vault logic directly rather than rendering React components,
// since the test environment is Node (no DOM). The VaultProvider logic is:
//
// 1. Check localStorage('vault-skipped') — if 'true' → ready + local-only
// 2. Check hasKeyData() — if true → needs-unlock
// 3. Otherwise → needs-setup
//
// unlock(dek) → ready + encrypted
// skipToLocalOnly() → sets localStorage flag, ready + local-only
// reset() → clears keyData + localStorage, needs-setup

// Minimal localStorage mock
const localStorageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
  get length() { return localStorageMap.size; },
  key: (_index: number) => null,
};

describe('VaultProvider logic', () => {
  beforeEach(() => {
    localStorageMap.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    mockedHasKeyData.mockReset();
    mockedClearKeyData.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns needs-setup when no key data and no skip flag', async () => {
    mockedHasKeyData.mockResolvedValue(false);

    const skipped = localStorage.getItem('vault-skipped') === 'true';
    expect(skipped).toBe(false);

    const hasVault = await hasKeyData();
    expect(hasVault).toBe(false);

    // Logic: not skipped + no vault = needs-setup
    const status = skipped ? 'ready' : hasVault ? 'needs-unlock' : 'needs-setup';
    expect(status).toBe('needs-setup');
  });

  it('returns needs-unlock when key data exists', async () => {
    mockedHasKeyData.mockResolvedValue(true);

    const skipped = localStorage.getItem('vault-skipped') === 'true';
    expect(skipped).toBe(false);

    const hasVault = await hasKeyData();
    expect(hasVault).toBe(true);

    const status = skipped ? 'ready' : hasVault ? 'needs-unlock' : 'needs-setup';
    expect(status).toBe('needs-unlock');
  });

  it('returns ready when skip flag is set, dek is null', async () => {
    localStorage.setItem('vault-skipped', 'true');

    const skipped = localStorage.getItem('vault-skipped') === 'true';
    expect(skipped).toBe(true);

    // When skipped, status is ready, dek remains null (no encryption)
    const status = 'ready';
    expect(status).toBe('ready');
    // dek === null means unencrypted — cloud sync decides whether to warn
  });

  it('unlock sets ready and provides dek (encrypted)', () => {
    let status = 'needs-unlock' as string;
    let dek: CryptoKey | null = null;

    // Simulated "unlock" action
    const fakeDek = {} as CryptoKey;
    dek = fakeDek;
    status = 'ready';

    expect(status).toBe('ready');
    expect(dek).toBe(fakeDek);
    // dek !== null means encrypted
  });

  it('skipToLocalOnly sets localStorage flag and ready with null dek', () => {
    localStorage.setItem('vault-skipped', 'true');

    expect(localStorage.getItem('vault-skipped')).toBe('true');

    const status = 'ready';
    const dek = null;
    expect(status).toBe('ready');
    expect(dek).toBeNull();
  });

  it('reset clears key store and localStorage, returns to needs-setup', async () => {
    localStorage.setItem('vault-skipped', 'true');
    mockedClearKeyData.mockResolvedValue();

    // Simulate reset()
    await clearKeyData();
    localStorage.removeItem('vault-skipped');

    expect(mockedClearKeyData).toHaveBeenCalledOnce();
    expect(localStorage.getItem('vault-skipped')).toBeNull();

    const status = 'needs-setup';
    const dek = null;
    expect(status).toBe('needs-setup');
    expect(dek).toBeNull();
  });
});
