/**
 * Fetch Mercado Pago binnacle pages for a period using the browser session cookie.
 */

const BINNACLE_URL = 'https://www.mercadopago.com.br/activities/api/list/binnacle';

export type BinnacleFetchResult =
  | { readonly pages: unknown[] }
  | { readonly sessionMissing: true }
  | { readonly pageFailure: true; readonly message: string };

type BinnacleListEnvelope = {
  readonly total: number;
  readonly pages: number;
  readonly groups: unknown[];
};

function isAuthenticatedList(body: unknown): body is BinnacleListEnvelope {
  if (body === null || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return (
    typeof record.total === 'number' &&
    typeof record.pages === 'number' &&
    Array.isArray(record.groups)
  );
}

async function fetchBinnaclePage(
  beginDate: string,
  endDate: string,
  page: number,
  signal?: AbortSignal,
): Promise<Response> {
  const url = new URL(BINNACLE_URL);
  url.searchParams.set('client', 'binnacle');
  url.searchParams.set('page', String(page));
  // Portal query. begin_date/end_date are the page URL only; the API ignores them and returns the last year.
  url.searchParams.set('period', 'other');
  url.searchParams.set('date_from', beginDate);
  url.searchParams.set('date_to', endDate);

  return fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
    signal,
  });
}

/**
 * Walk GET /activities/api/list/binnacle for every page in [1..pages].
 * First non-list response ⇒ sessionMissing. Later failures ⇒ pageFailure.
 */
export async function fetchBinnaclePeriod(
  beginDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<BinnacleFetchResult> {
  let firstBody: unknown;
  let firstRes: Response;

  try {
    firstRes = await fetchBinnaclePage(beginDate, endDate, 1, signal);
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    return {
      pageFailure: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    firstBody = await firstRes.json();
  } catch {
    if (!firstRes.ok) {
      return { sessionMissing: true };
    }
    return {
      pageFailure: true,
      message: `Binnacle page 1 returned non-JSON (HTTP ${firstRes.status})`,
    };
  }

  if (!firstRes.ok || !isAuthenticatedList(firstBody)) {
    return { sessionMissing: true };
  }

  const pageCount = firstBody.pages;
  const pages: unknown[] = [firstBody];

  if (pageCount <= 0) {
    return { pages };
  }

  for (let page = 2; page <= pageCount; page++) {
    let res: Response;
    try {
      res = await fetchBinnaclePage(beginDate, endDate, page, signal);
    } catch (err: unknown) {
      if (signal?.aborted) throw err;
      return {
        pageFailure: true,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    if (!res.ok) {
      return {
        pageFailure: true,
        message: `Binnacle page ${page} failed: HTTP ${res.status}`,
      };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        pageFailure: true,
        message: `Binnacle page ${page} returned non-JSON`,
      };
    }

    if (!isAuthenticatedList(body)) {
      return {
        pageFailure: true,
        message: `Binnacle page ${page} returned a non-list body`,
      };
    }

    pages.push(body);
  }

  return { pages };
}
