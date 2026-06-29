import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must stub chrome globally BEFORE any imports that use it
const addListenerExternal = vi.fn();
vi.stubGlobal('chrome', {
  runtime: {
    onConnectExternal: { addListener: addListenerExternal },
  },
});

// Mock investpass-api — vi.mock is hoisted above imports automatically
vi.mock('./investpass-api.ts', () => ({
  refreshToken: vi.fn(),
  fetchTransactions: vi.fn(),
}));

// These imports happen AFTER the stubs/mocks above thanks to vitest hoisting
const { isOriginAllowed, handleConnection } = await import('./background.ts');
const { refreshToken, fetchTransactions } = await import('./investpass-api.ts');

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
        type: 'DEBIT',
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
});
