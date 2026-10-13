import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must stub chrome globally BEFORE any imports that use it
const addListenerExternal = vi.fn();
const tabsCreate = vi.fn().mockResolvedValue({ id: 1 });
vi.stubGlobal('chrome', {
  runtime: {
    onConnectExternal: { addListener: addListenerExternal },
  },
  tabs: {
    create: tabsCreate,
  },
});

// Mock investpass-api — vi.mock is hoisted above imports automatically
vi.mock('./investpass-api.ts', () => ({
  refreshToken: vi.fn(),
  fetchTransactions: vi.fn(),
}));

vi.mock('./mercado-pago-api.ts', () => ({
  fetchBinnaclePeriod: vi.fn(),
}));

// These imports happen AFTER the stubs/mocks above thanks to vitest hoisting
const { isOriginAllowed, handleConnection } = await import('./background.ts');
const { refreshToken, fetchTransactions } = await import('./investpass-api.ts');
const { fetchBinnaclePeriod } = await import('./mercado-pago-api.ts');

function makePort(origin?: string): chrome.runtime.Port {
  const listeners: Array<(msg: unknown) => void> = [];
  return {
    sender: origin !== undefined ? { origin } : undefined,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (fn: (msg: unknown) => void) => listeners.push(fn),
    },
    onDisconnect: { addListener: vi.fn() },
    name: '',
    // helper to simulate incoming message
    _send(msg: unknown) {
      for (const fn of listeners) fn(msg);
    },
  } as unknown as chrome.runtime.Port & { _send: (msg: unknown) => void };
}

beforeEach(() => {
  vi.clearAllMocks();
  tabsCreate.mockResolvedValue({ id: 1 });
});

describe('isOriginAllowed', () => {
  it('allows localhost origins', () => {
    expect(isOriginAllowed('http://localhost')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173')).toBe(true);
    expect(isOriginAllowed('https://localhost:3000')).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false);
    expect(isOriginAllowed(undefined)).toBe(false);
    expect(isOriginAllowed('')).toBe(false);
  });
});

describe('handleConnection', () => {
  it('rejects connections from unknown origins', () => {
    const port = makePort('https://evil.com');
    handleConnection(port);
    expect(port.disconnect).toHaveBeenCalledOnce();
  });

  it('responds PONG to PING', async () => {
    const port = makePort('http://localhost:5173');
    handleConnection(port);

    (port as unknown as { _send: (m: unknown) => void })._send({ type: 'PING' });

    // Wait for async handler
    await vi.waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'PONG',
        extensionVersion: '0.1.0',
      });
    });
  });

  it('handles START_IMPORT → refreshToken → fetchTransactions → IMPORT_PAYLOAD', async () => {
    const mockTx = [
      {
        id: 'tx1',
        name: 'Coffee',
        date: '2025-06-15T00:00:00Z',
        amount: 5.5,
        type: 'DEBIT' as const,
        ignored: false,
        category: null,
        account: { name: 'Nubank', institution: { name: 'Nu' } },
      },
    ];

    vi.mocked(refreshToken).mockResolvedValue('jwt-abc');
    vi.mocked(fetchTransactions).mockResolvedValue(mockTx);

    const port = makePort('http://localhost:5173');
    handleConnection(port);

    (port as unknown as { _send: (m: unknown) => void })._send({
      type: 'START_IMPORT',
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
    });

    await vi.waitFor(() => {
      expect(refreshToken).toHaveBeenCalledOnce();
      expect(fetchTransactions).toHaveBeenCalledWith('jwt-abc', '2025-06-01', '2025-06-30');
      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'IMPORT_PAYLOAD',
        transactions: mockTx,
      });
    });
  });

  it('sends ERROR message when refreshToken fails', async () => {
    vi.mocked(refreshToken).mockRejectedValue(new Error('auth expired'));

    const port = makePort('https://localhost:3000');
    handleConnection(port);

    (port as unknown as { _send: (m: unknown) => void })._send({
      type: 'START_IMPORT',
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
    });

    await vi.waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ERROR',
        code: 'IMPORT_FAILED',
        message: 'auth expired',
      });
    });
  });

  it('handles START_MP_IMPORT → MP_IMPORT_PAYLOAD', async () => {
    const pages = [{ total: 0, pages: 0, groups: [] }];
    vi.mocked(fetchBinnaclePeriod).mockResolvedValue({ pages });

    const port = makePort('http://localhost:5173');
    handleConnection(port);

    (port as unknown as { _send: (m: unknown) => void })._send({
      type: 'START_MP_IMPORT',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });

    await vi.waitFor(() => {
      expect(fetchBinnaclePeriod).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
      expect(port.postMessage).toHaveBeenCalledWith({ type: 'MP_IMPORT_PAYLOAD', pages });
    });
    expect(tabsCreate).not.toHaveBeenCalled();
  });

  it('opens Mercado Pago home and sends MP_SESSION_MISSING when session is missing', async () => {
    vi.mocked(fetchBinnaclePeriod).mockResolvedValue({ sessionMissing: true });

    const port = makePort('http://localhost:5173');
    handleConnection(port);

    (port as unknown as { _send: (m: unknown) => void })._send({
      type: 'START_MP_IMPORT',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://www.mercadopago.com.br/' });
      expect(port.postMessage).toHaveBeenCalledWith({ type: 'MP_SESSION_MISSING' });
    });
  });

  it('sends ERROR when a Mercado Pago page fails after auth', async () => {
    vi.mocked(fetchBinnaclePeriod).mockResolvedValue({
      pageFailure: true,
      message: 'Binnacle page 2 failed: HTTP 500',
    });

    const port = makePort('http://localhost:5173');
    handleConnection(port);

    (port as unknown as { _send: (m: unknown) => void })._send({
      type: 'START_MP_IMPORT',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });

    await vi.waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'ERROR',
        code: 'MP_PAGE_FAILED',
        message: 'Binnacle page 2 failed: HTTP 500',
      });
    });
  });
});
