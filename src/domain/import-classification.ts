/**
 * Decide link versus create for each parsed import row.
 * No ids are generated here. The caller persists the plan.
 */

import type { Category, CategoryType } from './category.ts';
import { nameKey, splitTagNames, storedName } from './import-names.ts';
import type { TransactionType } from './transaction.ts';
import { suggestTagColor, type Tag } from './tag.ts';
import type { ParsedTransaction } from '../workers/types.ts';

export type ImportCategoryRef =
  | { readonly kind: 'none' }
  | { readonly kind: 'existing'; readonly id: string; readonly name: string }
  | { readonly kind: 'create'; readonly name: string; readonly type: CategoryType }
  | { readonly kind: 'planned'; readonly name: string; readonly type: CategoryType };

export type ImportTagRef =
  | { readonly kind: 'existing'; readonly id: string; readonly name: string }
  | { readonly kind: 'create'; readonly name: string; readonly color: string }
  | { readonly kind: 'planned'; readonly name: string };

export type ClassifiedImportRow = {
  readonly category: ImportCategoryRef;
  readonly tags: readonly ImportTagRef[];
};

type ClassifiableTransaction = ParsedTransaction & {
  readonly categoryName?: string | null;
  readonly tagNames?: readonly string[];
};

type PlannedCategory = {
  readonly name: string;
  readonly type: CategoryType;
};

type PlannedTag = {
  readonly name: string;
  readonly color: string;
};

type NamedRecord = {
  readonly id: string;
  readonly name: string;
};

function categoryTypeFor(direction: TransactionType): CategoryType {
  switch (direction) {
    case 'credit':
      return 'revenue';
    case 'debit':
      return 'expense';
    default: {
      const _exhaustive: never = direction;
      throw new Error(`unknown transaction type: ${String(_exhaustive)}`);
    }
  }
}

function firstByNameThenId<T extends NamedRecord>(matches: readonly T[]): T {
  const sorted = [...matches].sort((left, right) => {
    if (left.name < right.name) return -1;
    if (right.name < left.name) return 1;
    if (left.id < right.id) return -1;
    if (right.id < left.id) return 1;
    return 0;
  });
  const chosen = sorted[0];
  if (chosen == null) {
    throw new Error('expected at least one name match');
  }
  return chosen;
}

function selectCategory(matches: readonly Category[], fit: CategoryType): Category {
  const fitting = matches.filter((category) => category.type === fit);
  return firstByNameThenId(fitting.length > 0 ? fitting : matches);
}

function resolveCategory(
  rawName: string | null | undefined,
  direction: TransactionType,
  categories: readonly Category[],
  planned: Map<string, PlannedCategory>,
): ImportCategoryRef {
  if (rawName == null) return { kind: 'none' };
  const name = storedName(rawName);
  if (name === '') return { kind: 'none' };
  const key = nameKey(name);

  const matches = categories.filter((category) => nameKey(category.name) === key);
  if (matches.length > 0) {
    const chosen = selectCategory(matches, categoryTypeFor(direction));
    return { kind: 'existing', id: chosen.id, name: chosen.name };
  }

  const already = planned.get(key);
  if (already != null) {
    return { kind: 'planned', name: already.name, type: already.type };
  }

  const type = categoryTypeFor(direction);
  planned.set(key, { name, type });
  return { kind: 'create', name, type };
}

function tagLabels(tagNames: readonly string[] | undefined): readonly string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of tagNames ?? []) {
    for (const name of splitTagNames(part)) {
      const key = nameKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(name);
    }
  }
  return labels;
}

function resolveTags(
  tagNames: readonly string[] | undefined,
  tags: readonly Tag[],
  planned: Map<string, PlannedTag>,
  usedColors: string[],
): readonly ImportTagRef[] {
  return tagLabels(tagNames).map((name) => {
    const key = nameKey(name);
    const matches = tags.filter((tag) => nameKey(tag.name) === key);
    if (matches.length > 0) {
      const chosen = firstByNameThenId(matches);
      return { kind: 'existing', id: chosen.id, name: chosen.name };
    }

    const already = planned.get(key);
    if (already != null) {
      return { kind: 'planned', name: already.name };
    }

    const color = suggestTagColor(usedColors);
    usedColors.push(color);
    planned.set(key, { name, color });
    return { kind: 'create', name, color };
  });
}

export function classifyImportRows(
  transactions: readonly ClassifiableTransaction[],
  categories: readonly Category[],
  tags: readonly Tag[],
): readonly ClassifiedImportRow[] {
  const plannedCategories = new Map<string, PlannedCategory>();
  const plannedTags = new Map<string, PlannedTag>();
  const usedColors = tags.map((tag) => tag.color);

  return transactions.map((transaction) => ({
    category: resolveCategory(
      transaction.categoryName,
      transaction.type,
      categories,
      plannedCategories,
    ),
    tags: resolveTags(transaction.tagNames, tags, plannedTags, usedColors),
  }));
}
