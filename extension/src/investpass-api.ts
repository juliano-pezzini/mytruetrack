const GRAPHQL_URL = 'https://pass-api.invest-pass.com/graphql';

export type InvestPassTransaction = {
  id: string;
  name: string;
  date: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  ignored: boolean;
  category: { name: string; icon: string; color: string } | null;
  account: { name: string; institution: { name: string } };
};

export async function refreshToken(): Promise<string> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      operationName: 'RefreshToken',
      variables: {},
      query: `mutation RefreshToken {\n  refreshToken {\n    accessToken\n    __typename\n  }\n}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`RefreshToken failed: HTTP ${res.status}`);
  }

  const json: unknown = await res.json();
  const token = (json as { data?: { refreshToken?: { accessToken?: string } } })
    ?.data?.refreshToken?.accessToken;

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('RefreshToken: missing accessToken in response');
  }

  return token;
}

export async function fetchTransactions(
  token: string,
  periodStart: string,
  periodEnd: string,
): Promise<InvestPassTransaction[]> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: 'FindAllTransactions',
      variables: {
        filters: {
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          includeIgnored: true,
        },
      },
      query: `query FindAllTransactions($filters: FindAllTransactionsFilter) {\n  findAllTransactions(filters: $filters) {\n    id\n    name\n    date\n    amount\n    type\n    ignored\n    category {\n      name\n      icon\n      color\n      __typename\n    }\n    account {\n      name\n      institution {\n        name\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`FindAllTransactions failed: HTTP ${res.status}`);
  }

  const json: unknown = await res.json();
  const transactions = (json as { data?: { findAllTransactions?: unknown } })
    ?.data?.findAllTransactions;

  if (!Array.isArray(transactions)) {
    throw new Error('FindAllTransactions: malformed response');
  }

  return transactions as InvestPassTransaction[];
}
