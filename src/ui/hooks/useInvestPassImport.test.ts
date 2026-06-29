// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { DatabaseContext } from '../../app/database-provider.tsx';
import type { Database } from '../../storage/database.ts';
import type { InvestPassTransaction } from '../../workers/investpass-types.ts';
import type { BridgeMessage, InvestPassPort } from '../../sync/investpass-bridge.ts';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('../../sync/investpass-bridge.ts', () => ({
  connectToExtension: vi.fn(),
}));

vi.mock('../../storage/investpass-account-map.ts', () => ({
  getAccountMap: vi.fn(),
  saveMapping: vi.fn(),
}));

vi.mock('../../workers/investpass-import.ts', () => ({
  processInvestPassImport: vi.fn(),
}));

import { connectToExtension } from '../../sync/investpass-bridge.ts';
import { getAccountMap, saveMapping } from '../../storage/investpass-account-map.ts';
import { processInvestPassImport } from '../../workers/investpass-import.ts';
import { useInvestPassImport } from './useInvestPassImport.ts';

const mockConnect = vi.mocked(connectToExtension);
const mockGetAccountMap = vi.mocked(getAccountMap);
const mockSaveMapping = vi.mocked(saveMapping);
const mockProcess = vi.mocked(processInvestPassImport);

// ── Helpers ────────────────────────────────────────────────────────────

const fakeDb = {} as Database;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(DatabaseContext.Provider, { value: fakeDb }, children);
}

const EXTENSION_ID = 'test-ext-id';

function makeTxn(overrides: Partial<InvestPassTransaction> = {}): InvestPassTransaction {
  return {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Grocery Store',
    date: '2025-06-01T12:00:00Z',
    amount: 50.0,
    type: 'DEBIT',
    ignored: false,
    category: null,
    account: { name: 'Main Account', institution: { name: 'Bank' } },
    ...overrides,
  };
}

function createMockPort(): { port: InvestPassPort; respond: (msg: BridgeMessage) => void } {
  let handler: ((msg: BridgeMessage) => void) | null = null;
  return {
    port: {
      send: vi.fn(),
      onMessage: vi.fn((cb: (msg: BridgeMessage) => void) => { handler = cb; }),
      disconnect: vi.fn(),
    },
    respond(msg: BridgeMessage) {
      handler?.(msg);
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('useInvestPassImport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('happy flow: connects, fetches, imports, returns summary', async () => {
    const txn = makeTxn();
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    mockGetAccountMap.mockResolvedValue([
      { investPassAccountName: 'Main Account', mytruetrackAccountId: 'acc-1', lastImportedDate: null },
    ]);
    const expectedResult = { perAccount: { 'acc-1': { imported: 1, skipped: 0, errors: [] } }, unmappedAccounts: [] };
    mockProcess.mockResolvedValue(expectedResult);

    // Schedule the extension response for when port.send is called
    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'IMPORT_PAYLOAD', transactions: [txn] });
    });

    const { result } = renderHook(() => useInvestPassImport(EXTENSION_ID), { wrapper });

    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.startImport('2025-06-01', '2025-06-30');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.summary).toEqual(expectedResult);
    expect(result.current.error).toBeNull();
    expect(mockProcess).toHaveBeenCalledWith(fakeDb, [txn], expect.any(Array));
  });

  it('unmapped accounts halt import until mapAccount resolves them', async () => {
    const txn = makeTxn();
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    // No existing mappings → account is unmapped
    mockGetAccountMap.mockResolvedValue([]);
    mockSaveMapping.mockResolvedValue(undefined);

    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'IMPORT_PAYLOAD', transactions: [txn] });
    });

    const { result } = renderHook(() => useInvestPassImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport('2025-06-01', '2025-06-30');
    });

    // Should be waiting for mapping
    expect(result.current.status).toBe('mapping');
    expect(result.current.unmappedAccounts).toEqual(['Main Account']);

    // Now provide the mapping
    const expectedResult = { perAccount: { 'acc-1': { imported: 1, skipped: 0, errors: [] } }, unmappedAccounts: [] };
    mockProcess.mockResolvedValue(expectedResult);
    // After saving, getAccountMap returns the new mapping
    mockGetAccountMap.mockResolvedValue([
      { investPassAccountName: 'Main Account', mytruetrackAccountId: 'acc-1', lastImportedDate: null },
    ]);

    await act(async () => {
      await result.current.mapAccount('Main Account', 'acc-1');
    });

    // Wait for async import to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.status).toBe('done');
    expect(result.current.summary).toEqual(expectedResult);
    expect(mockSaveMapping).toHaveBeenCalledWith({
      investPassAccountName: 'Main Account',
      mytruetrackAccountId: 'acc-1',
      lastImportedDate: null,
    });
  });

  it('rejects concurrent imports', async () => {
    const txn = makeTxn();
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    mockGetAccountMap.mockResolvedValue([
      { investPassAccountName: 'Main Account', mytruetrackAccountId: 'acc-1', lastImportedDate: null },
    ]);
    mockProcess.mockImplementation(() => new Promise(() => { /* never resolves */ }));

    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'IMPORT_PAYLOAD', transactions: [txn] });
    });

    const { result } = renderHook(() => useInvestPassImport(EXTENSION_ID), { wrapper });

    // Start first import (will hang on processInvestPassImport)
    await act(async () => {
      void result.current.startImport('2025-06-01', '2025-06-30');
    });

    // Second import should be rejected
    await expect(
      act(async () => {
        await result.current.startImport('2025-07-01', '2025-07-31');
      }),
    ).rejects.toThrow('Import already in progress');
  });

  it('sets error state when extension returns ERROR', async () => {
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);

    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Token expired' });
    });

    const { result } = renderHook(() => useInvestPassImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport('2025-06-01', '2025-06-30');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Token expired');
  });

  it('sets error state when extension is not available', async () => {
    mockConnect.mockReturnValue(null);

    const { result } = renderHook(() => useInvestPassImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport('2025-06-01', '2025-06-30');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('InvestPass extension not available');
  });

  it('times out if extension never responds', async () => {
    vi.useFakeTimers();

    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    // port.send does nothing — extension never responds

    const { result } = renderHook(() => useInvestPassImport(EXTENSION_ID), { wrapper });

    let importPromise: Promise<void> | undefined;
    await act(async () => {
      importPromise = result.current.startImport('2025-06-01', '2025-06-30');
    });

    // Advance past the 30s timeout
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    await act(async () => {
      await importPromise;
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Extension did not respond within 30 seconds');
    expect(mock.port.disconnect).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
