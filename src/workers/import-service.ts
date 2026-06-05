/**
 * Import service — validates, deduplicates, and persists parsed transactions.
 */

import type { Database } from '../storage/database.ts';
import { createTransactionRepository } from '../storage/repositories/transaction-repository.ts';
import type { CreateTransactionParams } from '../domain/transaction.ts';
import type { ParsedTransaction, ImportResult, ImportError } from './types.ts';

/**
 * Import parsed transactions into the database for a given account.
 *
 * - Generates UUIDs for transaction IDs
 * - Validates each transaction via the domain factory (createTransaction)
 * - Deduplicates by externalId (skips if already in DB for the same account)
 * - Collects validation errors without aborting
 */
export function importTransactions(
  db: Database,
  accountId: string,
  transactions: readonly ParsedTransaction[],
): ImportResult {
  const repo = createTransactionRepository(db);
  let imported = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  // Pre-load existing external IDs for this account to check duplicates
  const existingExternalIds = new Set<string>();
  const existingRows = db.execO(
    `SELECT external_id FROM transactions WHERE account_id = ? AND external_id IS NOT NULL AND external_id != ''`,
    [accountId],
  );
  for (const row of existingRows) {
    existingExternalIds.add(row.external_id as string);
  }

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i]!;

    // Dedup check
    if (txn.externalId && existingExternalIds.has(txn.externalId)) {
      skipped++;
      continue;
    }

    try {
      const params: CreateTransactionParams = {
        id: generateId(),
        accountId,
        amount: txn.amount,
        description: txn.description,
        transactionDate: txn.date,
        type: txn.type,
        externalId: txn.externalId,
      };

      repo.create(params);
      imported++;

      // Track for intra-batch dedup
      if (txn.externalId) {
        existingExternalIds.add(txn.externalId);
      }
    } catch (err) {
      errors.push({
        index: i,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { imported, skipped, errors };
}

/** Generate a UUID v4. */
function generateId(): string {
  return crypto.randomUUID();
}
