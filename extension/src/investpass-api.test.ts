import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshToken, fetchTransactions } from './investpass-api.ts';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

describe('refreshToken', () => {
  it('returns accessToken on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { refreshToken: { accessToken: 'jwt-123', __typename: 'Auth' } },
        }),
    });

    const token = await refreshToken();
    expect(token).toBe('jwt-123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://pass-api.invest-pass.com/graphql');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string).operationName).toBe('RefreshToken');
  });

  it('throws on network / HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(refreshToken()).rejects.toThrow('RefreshToken failed: HTTP 500');
  });

  it('throws when accessToken is missing in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { refreshToken: {} } }),
    });

    await expect(refreshToken()).rejects.toThrow('missing accessToken');
  });
});

describe('fetchTransactions', () => {
  const sampleTx = {
    id: 'a1b2c3',
    name: 'Grocery',
    date: '2025-06-01T00:00:00Z',
    amount: 42.5,
    type: 'DEBIT',
    ignored: false,
    category: { name: 'Food', icon: '🍕', color: '#ff0000' },
    account: { name: 'Nubank', institution: { name: 'Nu Pagamentos' } },
  };

  it('returns typed transaction array on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ data: { findAllTransactions: [sampleTx] } }),
    });

    const txs = await fetchTransactions('tok', '2025-06-01', '2025-06-30');
    expect(txs).toHaveLength(1);
    expect(txs[0]!.name).toBe('Grocery');
    expect(txs[0]!.type).toBe('DEBIT');

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.variables.filters.periodStartDate).toBe('2025-06-01');
    expect(body.variables.filters.includeIgnored).toBe(true);
  });

  it('throws on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(
      fetchTransactions('bad', '2025-06-01', '2025-06-30'),
    ).rejects.toThrow('HTTP 401');
  });

  it('throws on malformed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });

    await expect(
      fetchTransactions('tok', '2025-06-01', '2025-06-30'),
    ).rejects.toThrow('malformed response');
  });
});
