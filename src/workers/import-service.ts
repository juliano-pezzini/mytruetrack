/**
 * Import service — validates, deduplicates, and persists parsed transactions.
 */

import {
  classifyImportRows,
  type ImportCategoryRef,
  type ImportTagRef,
} from '../domain/import-classification.ts';
import { nameKey, splitTagNames, storedName } from '../domain/import-names.ts';
import type { CreateTransactionParams } from '../domain/transaction.ts';
import type { Database } from '../storage/database.ts';
import { createCategoryRepository } from '../storage/repositories/category-repository.ts';
import type { CategoryRepository } from '../storage/repositories/category-repository.ts';
import { createTagRepository } from '../storage/repositories/tag-repository.ts';
import type { TagRepository } from '../storage/repositories/tag-repository.ts';
import { createTransactionRepository } from '../storage/repositories/transaction-repository.ts';
import type { ParsedTransaction, ImportResult, ImportError } from './types.ts';

type PendingRow = {
  readonly index: number;
  readonly txn: ParsedTransaction;
};

/**
 * Import parsed transactions into the database for a given account.
 *
 * - Generates UUIDs for transaction IDs
 * - Validates each transaction via the domain factory (createTransaction)
 * - Deduplicates by externalId (skips if already in DB for the same account)
 * - Creates missing categories and tags from the classified names
 * - Collects validation errors without aborting
 * - Optional importRunId is applied only to newly inserted rows
 */
export async function importTransactions(
  db: Database,
  accountId: string,
  transactions: readonly ParsedTransaction[],
  importRunId?: string,
): Promise<ImportResult> {
  const repo = createTransactionRepository(db);
  const categoryRepo = createCategoryRepository(db);
  const tagRepo = createTagRepository(db);
  let imported = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  // Pre-load existing external IDs for this account to check duplicates
  const existingExternalIds = new Set<string>();
  const existingRows = await db.execO(
    `SELECT external_id FROM transactions WHERE account_id = ? AND external_id IS NOT NULL AND external_id != ''`,
    [accountId],
  );
  for (const row of existingRows) {
    existingExternalIds.add(row.external_id as string);
  }

  const pending: PendingRow[] = [];
  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i]!;
    if (txn.externalId && existingExternalIds.has(txn.externalId)) {
      skipped++;
      continue;
    }
    if (txn.externalId) {
      existingExternalIds.add(txn.externalId);
    }
    pending.push({ index: i, txn });
  }

  const classified = rowCarriesNames(pending)
    ? classifyImportRows(
        pending.map((row) => row.txn),
        await categoryRepo.getAll(),
        await tagRepo.getAll(),
      )
    : null;
  const createdCategoryIds = new Map<string, string>();
  const createdTagIds = new Map<string, string>();

  for (let i = 0; i < pending.length; i++) {
    const { index, txn } = pending[i]!;
    const plan = classified?.[i];

    try {
      const categoryId =
        plan == null ? null : await categoryIdFor(plan.category, categoryRepo, createdCategoryIds);
      const tagIds = plan == null ? [] : await tagIdsFor(plan.tags, tagRepo, createdTagIds);

      const params: CreateTransactionParams = {
        id: generateId(),
        accountId,
        amount: txn.amount,
        description: txn.description,
        transactionDate: txn.date,
        type: txn.type,
        externalId: txn.externalId,
        importRunId: importRunId ?? null,
        categoryId,
      };

      const created = await repo.create(params);
      if (tagIds.length > 0) {
        await repo.addTags(created.id, tagIds);
      }
      imported++;
    } catch (err) {
      errors.push({
        index,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { imported, skipped, errors };
}

function rowCarriesNames(rows: readonly PendingRow[]): boolean {
  return rows.some((row) => {
    const categoryName = row.txn.categoryName;
    if (categoryName != null && storedName(categoryName) !== '') return true;
    return (row.txn.tagNames ?? []).some((name) => splitTagNames(name).length > 0);
  });
}

async function categoryIdFor(
  ref: ImportCategoryRef,
  categoryRepo: CategoryRepository,
  created: Map<string, string>,
): Promise<string | null> {
  switch (ref.kind) {
    case 'none':
      return null;
    case 'existing':
      return ref.id;
    case 'create': {
      const id = generateId();
      await categoryRepo.create({
        id,
        name: ref.name,
        type: ref.type,
        parentId: null,
        description: null,
      });
      created.set(nameKey(ref.name), id);
      return id;
    }
    case 'planned': {
      const id = created.get(nameKey(ref.name));
      if (id == null) {
        throw new Error(`planned category was not created: ${ref.name}`);
      }
      return id;
    }
    default: {
      const _exhaustive: never = ref;
      throw new Error(`unknown category ref: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

async function tagIdsFor(
  refs: readonly ImportTagRef[],
  tagRepo: TagRepository,
  created: Map<string, string>,
): Promise<readonly string[]> {
  const ids: string[] = [];
  for (const ref of refs) {
    ids.push(await tagIdFor(ref, tagRepo, created));
  }
  return ids;
}

async function tagIdFor(
  ref: ImportTagRef,
  tagRepo: TagRepository,
  created: Map<string, string>,
): Promise<string> {
  switch (ref.kind) {
    case 'existing':
      return ref.id;
    case 'create': {
      const id = generateId();
      await tagRepo.create({
        id,
        name: ref.name,
        color: ref.color,
      });
      created.set(nameKey(ref.name), id);
      return id;
    }
    case 'planned': {
      const id = created.get(nameKey(ref.name));
      if (id == null) {
        throw new Error(`planned tag was not created: ${ref.name}`);
      }
      return id;
    }
    default: {
      const _exhaustive: never = ref;
      throw new Error(`unknown tag ref: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Generate a UUID v4. */
function generateId(): string {
  return crypto.randomUUID();
}
