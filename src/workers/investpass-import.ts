/**
 * InvestPass import processor — converts InvestPass transactions, routes by account,
 * and delegates to the generic import service for dedup + persistence.
 */

import type { Database } from '../storage/database.ts';
import type { AccountMapEntry } from '../storage/investpass-account-map.ts';
import type { InvestPassTransaction, InvestPassImportResult } from './investpass-types.ts';
import type { ParsedTransaction } from './types.ts';
import type { Money } from '../domain/money.ts';
import { importTransactions } from './import-service.ts';

/**
 * Convert InvestPass transactions to ParsedTransactions, route by account map,
 * and import each slice. Transactions for unmapped accounts are skipped.
 */
export async function processInvestPassImport(
  db: Database,
  transactions: readonly InvestPassTransaction[],
  accountMap: readonly AccountMapEntry[],
): Promise<InvestPassImportResult> {
  // Build lookup: investPassAccountName → mytruetrackAccountId
  const mapByName = new Map<string, string>();
  for (const entry of accountMap) {
    mapByName.set(entry.investPassAccountName, entry.mytruetrackAccountId);
  }

  // Group converted transactions by mytruetrack account ID
  const grouped = new Map<string, ParsedTransaction[]>();
  const unmappedSet = new Set<string>();

  for (const txn of transactions) {
    const accountId = mapByName.get(txn.account.name);
    if (!accountId) {
      unmappedSet.add(txn.account.name);
      continue;
    }

    const parsed: ParsedTransaction = {
      date: convertDateToSaoPaulo(txn.date),
      description: txn.name,
      amount: Math.round(txn.amount * 100) as Money,
      type: txn.type === 'DEBIT' ? 'debit' : 'credit',
      externalId: txn.id,
    };

    const list = grouped.get(accountId);
    if (list) {
      list.push(parsed);
    } else {
      grouped.set(accountId, [parsed]);
    }
  }

  // Import each group
  const perAccount: Record<string, Awaited<ReturnType<typeof importTransactions>>> = {};
  for (const [accountId, parsedTxns] of grouped) {
    perAccount[accountId] = await importTransactions(db, accountId, parsedTxns);
  }

  return {
    perAccount,
    unmappedAccounts: [...unmappedSet],
  };
}

/**
 * Convert an ISO-8601 UTC datetime to YYYY-MM-DD in America/Sao_Paulo timezone.
 */
function convertDateToSaoPaulo(isoDate: string): string {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA locale formats as YYYY-MM-DD
  return formatter.format(date);
}
