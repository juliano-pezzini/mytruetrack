import { describe, expect, it } from 'vitest';
import type { Category, CategoryType } from './category.ts';
import { classifyImportRows } from './import-classification.ts';
import { fromCents } from './money.ts';
import type { Tag } from './tag.ts';
import type { ParsedTransaction } from '../workers/types.ts';
import type { TransactionType } from './transaction.ts';

function category(id: string, name: string, type: CategoryType): Category {
  return { id, parentId: null, name, type, description: null };
}

function tag(id: string, name: string, color: string): Tag {
  return { id, name, color };
}

function row(
  type: TransactionType,
  categoryName: string | null,
  tagNames: readonly string[] = [],
): ParsedTransaction & {
  readonly categoryName: string | null;
  readonly tagNames: readonly string[];
} {
  return {
    date: '2026-01-15',
    description: 'Imported',
    amount: fromCents(100),
    type,
    externalId: null,
    categoryName,
    tagNames,
  };
}

describe('classifyImportRows', () => {
  it('treats an empty category as none and an empty tags cell as no tag refs', () => {
    const [blank] = classifyImportRows([row('debit', null, [])], [], []);
    expect(blank?.category).toEqual({ kind: 'none' });
    expect(blank?.tags).toEqual([]);

    const [whitespace] = classifyImportRows([row('credit', '   ', ['   ', ' , ; '])], [], []);
    expect(whitespace?.category).toEqual({ kind: 'none' });
    expect(whitespace?.tags).toEqual([]);

    const omitted: ParsedTransaction = {
      date: '2026-01-15',
      description: 'No labels',
      amount: fromCents(100),
      type: 'debit',
      externalId: null,
    };
    const [missing] = classifyImportRows([omitted], [], []);
    expect(missing?.category).toEqual({ kind: 'none' });
    expect(missing?.tags).toEqual([]);
  });

  it('creates Super Market as expense for a debit and revenue for a credit', () => {
    const [debit] = classifyImportRows([row('debit', '  Super   Market ')], [], []);
    expect(debit?.category).toEqual({
      kind: 'create',
      name: 'Super Market',
      type: 'expense',
    });

    const [credit] = classifyImportRows([row('credit', '  Super   Market ')], [], []);
    expect(credit?.category).toEqual({
      kind: 'create',
      name: 'Super Market',
      type: 'revenue',
    });
  });

  it('marks a later row with the same key as planned and keeps the first type', () => {
    const rows = classifyImportRows(
      [row('debit', '  Super   Market '), row('credit', 'super market')],
      [],
      [],
    );
    expect(rows[0]?.category).toEqual({
      kind: 'create',
      name: 'Super Market',
      type: 'expense',
    });
    expect(rows[1]?.category).toEqual({
      kind: 'planned',
      name: 'Super Market',
      type: 'expense',
    });
  });

  it('links the only existing category even when its type differs from the row', () => {
    const [result] = classifyImportRows(
      [row('credit', '  Super   Market ')],
      [category('c1', 'Super Market', 'expense')],
      [],
    );
    expect(result?.category).toEqual({
      kind: 'existing',
      id: 'c1',
      name: 'Super Market',
    });
  });

  it('links a credit to revenue and a debit to expense when both types exist', () => {
    const catalog = [category('exp', 'Market', 'expense'), category('rev', 'Market', 'revenue')];
    const rows = classifyImportRows([row('credit', 'market'), row('debit', 'MARKET')], catalog, []);
    expect(rows[0]?.category).toEqual({ kind: 'existing', id: 'rev', name: 'Market' });
    expect(rows[1]?.category).toEqual({ kind: 'existing', id: 'exp', name: 'Market' });
  });

  it('resolves several fitting matches by stored name, then id, using <', () => {
    const byName = classifyImportRows(
      [row('debit', 'market')],
      [category('z', 'market', 'expense'), category('m', 'Market', 'expense')],
      [],
    );
    expect(byName[0]?.category).toEqual({ kind: 'existing', id: 'm', name: 'Market' });

    const byId = classifyImportRows(
      [row('debit', 'Market')],
      [category('id-2', 'Market', 'expense'), category('id-10', 'Market', 'expense')],
      [],
    );
    expect(byId[0]?.category).toEqual({ kind: 'existing', id: 'id-10', name: 'Market' });

    const ignoresSmallerNonFittingName = classifyImportRows(
      [row('credit', 'market')],
      [category('e', 'Market', 'expense'), category('r', 'market', 'revenue')],
      [],
    );
    expect(ignoresSmallerNonFittingName[0]?.category).toEqual({
      kind: 'existing',
      id: 'r',
      name: 'market',
    });
  });

  it('links the smallest stored name, then id, when none of the matches has the fitting type', () => {
    const byName = classifyImportRows(
      [row('debit', 'MARKET')],
      [category('b', 'market', 'revenue'), category('a', 'Market', 'revenue')],
      [],
    );
    expect(byName[0]?.category).toEqual({ kind: 'existing', id: 'a', name: 'Market' });

    const byId = classifyImportRows(
      [row('debit', 'Market')],
      [category('id-2', 'Market', 'revenue'), category('id-10', 'Market', 'revenue')],
      [],
    );
    expect(byId[0]?.category).toEqual({ kind: 'existing', id: 'id-10', name: 'Market' });
  });

  it('assigns #E11D48 to the first new tag and #0EA5E9 once that color is used', () => {
    const [created] = classifyImportRows([row('debit', null, ['  Food ', 'travel'])], [], []);
    expect(created?.tags).toEqual([
      { kind: 'create', name: 'Food', color: '#E11D48' },
      { kind: 'create', name: 'travel', color: '#0EA5E9' },
    ]);

    const [next] = classifyImportRows(
      [row('debit', null, ['travel'])],
      [],
      [tag('t1', 'Food', '#E11D48')],
    );
    expect(next?.tags).toEqual([{ kind: 'create', name: 'travel', color: '#0EA5E9' }]);
  });

  it('links an existing tag named Food from a cell of food and does not create one', () => {
    const [result] = classifyImportRows(
      [row('debit', null, ['  food '])],
      [],
      [tag('t1', 'Food', '#111111')],
    );
    expect(result?.tags).toEqual([{ kind: 'existing', id: 't1', name: 'Food' }]);
  });

  it('resolves several tags by stored name, then id, and plans a later row', () => {
    const [linked] = classifyImportRows(
      [row('debit', null, ['food'])],
      [],
      [tag('b', 'food', '#111111'), tag('a', 'Food', '#222222')],
    );
    expect(linked?.tags).toEqual([{ kind: 'existing', id: 'a', name: 'Food' }]);

    const planned = classifyImportRows(
      [row('debit', null, ['food']), row('credit', null, ['Food'])],
      [],
      [],
    );
    expect(planned[0]?.tags).toEqual([{ kind: 'create', name: 'food', color: '#E11D48' }]);
    expect(planned[1]?.tags).toEqual([{ kind: 'planned', name: 'food' }]);
  });

  it('links a category created by an earlier plan and does not create another', () => {
    const [first] = classifyImportRows([row('debit', '  Super   Market ')], [], []);
    expect(first?.category).toEqual({
      kind: 'create',
      name: 'Super Market',
      type: 'expense',
    });

    const [second] = classifyImportRows(
      [row('credit', 'super   market')],
      [category('created-1', 'Super Market', 'expense')],
      [],
    );
    expect(second?.category).toEqual({
      kind: 'existing',
      id: 'created-1',
      name: 'Super Market',
    });
  });
});
