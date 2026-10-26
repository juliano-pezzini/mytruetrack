// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { DatabaseContext } from '../../app/database-provider.tsx';
import type { Database } from '../../storage/database.ts';
import type { BridgeMessage, InvestPassPort } from '../../sync/investpass-bridge.ts';

vi.mock('../../sync/investpass-bridge.ts', () => ({
  connectToExtension: vi.fn(),
}));

vi.mock('../../workers/mercado-pago-import.ts', () => ({
  processMercadoPagoImport: vi.fn(),
}));

vi.mock('./useAutoSync.ts', () => ({
  useAutoSync: () => ({ status: 'idle', notifyChange: mockNotifyChange }),
}));

const mockNotifyChange = vi.fn();

import { connectToExtension } from '../../sync/investpass-bridge.ts';
import { processMercadoPagoImport } from '../../workers/mercado-pago-import.ts';
import { useMercadoPagoImport } from './useMercadoPagoImport.ts';
import { EXTENSION_UNAVAILABLE_MESSAGE } from '../extension-unavailable.ts';

const mockConnect = vi.mocked(connectToExtension);
const mockProcess = vi.mocked(processMercadoPagoImport);

const fakeDb = {} as Database;
const EXTENSION_ID = 'test-ext-id';
const ACCOUNT_ID = 'acc-mp-1';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(DatabaseContext.Provider, { value: fakeDb }, children);
}

function createMockPort(): { port: InvestPassPort; respond: (msg: BridgeMessage) => void } {
  let handler: ((msg: BridgeMessage) => void) | null = null;
  return {
    port: {
      send: vi.fn(),
      onMessage: vi.fn((cb: (msg: BridgeMessage) => void) => {
        handler = cb;
      }),
      disconnect: vi.fn(),
    },
    respond(msg: BridgeMessage) {
      handler?.(msg);
    },
  };
}

describe('useMercadoPagoImport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the companion extension as unavailable and writes nothing', async () => {
    mockConnect.mockReturnValue(null);

    const { result } = renderHook(() => useMercadoPagoImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport(ACCOUNT_ID, '2026-01-01', '2026-01-31');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(EXTENSION_UNAVAILABLE_MESSAGE);
    expect(mockProcess).not.toHaveBeenCalled();
    expect(mockNotifyChange).not.toHaveBeenCalled();
  });

  it('refuses a reversed period before contacting the extension', async () => {
    const { result } = renderHook(() => useMercadoPagoImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport(ACCOUNT_ID, '2026-02-10', '2026-02-01');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/start date must be on or before end date/i);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('success path: START_MP_IMPORT then processMercadoPagoImport and notifyChange', async () => {
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    const pages = [{ total: 0, pages: 0, groups: [] }];
    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'MP_IMPORT_PAYLOAD', pages });
    });
    mockProcess.mockResolvedValue({
      logId: 'log-1',
      imported: 2,
      skipped: 0,
      errorCount: 1,
    });

    const { result } = renderHook(() => useMercadoPagoImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport(ACCOUNT_ID, '2026-01-01', '2026-01-31');
    });

    expect(mock.port.send).toHaveBeenCalledWith({
      type: 'START_MP_IMPORT',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });
    expect(mockProcess).toHaveBeenCalledWith(
      fakeDb,
      ACCOUNT_ID,
      { start: '2026-01-01', end: '2026-01-31' },
      pages,
      expect.objectContaining({ todaySaoPaulo: expect.any(String) }),
    );
    expect(mockNotifyChange).toHaveBeenCalled();
    expect(result.current.status).toBe('done');
    expect(result.current.summary).toEqual({
      logId: 'log-1',
      imported: 2,
      skipped: 0,
      errorCount: 1,
    });
  });

  it('page ERROR writes nothing', async () => {
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'ERROR', code: 'MP_PAGE_FAILED', message: 'Page 2 failed' });
    });

    const { result } = renderHook(() => useMercadoPagoImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      await result.current.startImport(ACCOUNT_ID, '2026-01-01', '2026-01-31');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Page 2 failed');
    expect(mockProcess).not.toHaveBeenCalled();
    expect(mockNotifyChange).not.toHaveBeenCalled();
  });

  it('session wait: cancel writes nothing and returns to idle', async () => {
    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    // Session missing — never sends payload
    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'MP_SESSION_MISSING' });
    });

    const { result } = renderHook(() => useMercadoPagoImport(EXTENSION_ID), { wrapper });

    let importPromise: Promise<void> | undefined;
    await act(async () => {
      importPromise = result.current.startImport(ACCOUNT_ID, '2026-01-01', '2026-01-31');
    });

    expect(result.current.status).toBe('waiting_for_session');
    expect(mockProcess).not.toHaveBeenCalled();

    await act(async () => {
      result.current.cancel();
      await importPromise;
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(mockProcess).not.toHaveBeenCalled();
    expect(mockNotifyChange).not.toHaveBeenCalled();
    expect(mock.port.disconnect).toHaveBeenCalled();
  });

  it('does not apply a 30s timeout while waiting for session', async () => {
    vi.useFakeTimers();

    const mock = createMockPort();
    mockConnect.mockReturnValue(mock.port);
    mock.port.send = vi.fn(() => {
      mock.respond({ type: 'MP_SESSION_MISSING' });
    });

    const { result } = renderHook(() => useMercadoPagoImport(EXTENSION_ID), { wrapper });

    await act(async () => {
      void result.current.startImport(ACCOUNT_ID, '2026-01-01', '2026-01-31');
    });

    expect(result.current.status).toBe('waiting_for_session');

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.status).toBe('waiting_for_session');
    expect(result.current.error).toBeNull();
    expect(mockProcess).not.toHaveBeenCalled();

    // Complete via payload after the wait
    mockProcess.mockResolvedValue({
      logId: 'log-late',
      imported: 0,
      skipped: 0,
      errorCount: 0,
    });

    await act(async () => {
      mock.respond({ type: 'MP_IMPORT_PAYLOAD', pages: [] });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('done');
    expect(mockProcess).toHaveBeenCalled();
  });
});
