import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBinnaclePeriod } from './mercado-pago-api.ts';

const mockFetch = vi.fn();

function listPage(page: number, pages: number, groups: unknown[] = []) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ total: groups.length, pages, groups }),
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

describe('fetchBinnaclePeriod', () => {
  it('walks every page from 1 through pages with client/begin_date/end_date', async () => {
    mockFetch
      .mockResolvedValueOnce(listPage(1, 2, [{ title: 'day1', items: [] }]))
      .mockResolvedValueOnce(listPage(2, 2, [{ title: 'day2', items: [] }]));

    const result = await fetchBinnaclePeriod('2026-01-01', '2026-01-31');

    expect(result).toEqual({
      pages: [
        { total: 1, pages: 2, groups: [{ title: 'day1', items: [] }] },
        { total: 1, pages: 2, groups: [{ title: 'day2', items: [] }] },
      ],
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [url1, init1] = mockFetch.mock.calls[0] as [string, RequestInit];
    const [url2] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(url1).toContain('/activities/api/list/binnacle');
    expect(url1).toContain('client=binnacle');
    expect(url1).toContain('page=1');
    expect(url1).toContain('begin_date=2026-01-01');
    expect(url1).toContain('end_date=2026-01-31');
    expect(url2).toContain('page=2');
    expect(init1.credentials).toBe('include');
  });

  it('returns sessionMissing when the first response is not an authenticated list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ login: true }),
    });

    const result = await fetchBinnaclePeriod('2026-01-01', '2026-01-31');
    expect(result).toEqual({ sessionMissing: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns sessionMissing on first HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'unauthorized' }),
    });

    const result = await fetchBinnaclePeriod('2026-01-01', '2026-01-31');
    expect(result).toEqual({ sessionMissing: true });
  });

  it('returns pageFailure when a later page fails mid-walk', async () => {
    mockFetch.mockResolvedValueOnce(listPage(1, 3, [])).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'boom' }),
    });

    const result = await fetchBinnaclePeriod('2026-01-01', '2026-01-31');
    expect(result).toMatchObject({ pageFailure: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns pages with a single empty list when pages is 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ total: 0, pages: 0, groups: [] }),
    });

    const result = await fetchBinnaclePeriod('2026-03-01', '2026-03-05');
    expect(result).toEqual({ pages: [{ total: 0, pages: 0, groups: [] }] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns pageFailure when a later page body is not a list', async () => {
    mockFetch.mockResolvedValueOnce(listPage(1, 2, [])).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ html: true }),
    });

    const result = await fetchBinnaclePeriod('2026-01-01', '2026-01-31');
    expect(result).toMatchObject({ pageFailure: true });
  });
});
