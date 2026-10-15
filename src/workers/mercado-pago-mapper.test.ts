import { describe, it, expect } from 'vitest';
import { flattenBinnaclePages, mapBinnacleItem } from './mercado-pago-mapper.ts';
import { fromCents } from '../domain/money.ts';

/** Synthetic movement mirroring PoC shape (no personal data). */
function movement(overrides: Record<string, unknown> = {}) {
  return {
    movement_id: 'AbCdEfGhIjKlMnOp1',
    datetime: '2026-03-15T18:30:00.000-03:00',
    title: 'PIX received',
    description: 'detail text',
    amount: {
      currency_id: 'BRL',
      fraction: '10.50',
      cents: '1050',
    },
    metadata: { kind: 'transfer', detail: 'pix' },
    ...overrides,
  };
}

function pageWithItems(items: unknown[]) {
  return {
    total: items.length,
    pages: 1,
    groups: [
      {
        title: '15 de março',
        right_content: 'Saldo do dia R$ 1.000,00',
        items,
      },
    ],
  };
}

describe('mapBinnacleItem', () => {
  it('maps a BRL credit (positive signed cents) to ParsedTransaction', () => {
    const result = mapBinnacleItem(
      movement({
        amount: { currency_id: 'BRL', fraction: '10.50', cents: '1050' },
      }),
    );
    expect(result).toEqual({
      date: '2026-03-15',
      description: 'PIX received',
      amount: fromCents(1050),
      type: 'credit',
      externalId: 'AbCdEfGhIjKlMnOp1',
    });
  });

  it('maps a BRL debit (negative signed cents) to ParsedTransaction', () => {
    const result = mapBinnacleItem(
      movement({
        movement_id: 'DebitMovementId001',
        title: 'Payment',
        amount: { currency_id: 'BRL', fraction: '-25.00', cents: '-2500' },
      }),
    );
    expect(result).toEqual({
      date: '2026-03-15',
      description: 'Payment',
      amount: fromCents(2500),
      type: 'debit',
      externalId: 'DebitMovementId001',
    });
  });

  it('errors on non-BRL currency_id', () => {
    const result = mapBinnacleItem(
      movement({ amount: { currency_id: 'USD', fraction: '10', cents: '1000' } }),
    );
    expect(result).toEqual({ error: expect.stringMatching(/BRL|currency/i) });
  });

  it('errors when currency_id is missing', () => {
    const result = mapBinnacleItem(
      movement({ amount: { fraction: '10', cents: '1000' } }),
    );
    expect(result).toEqual({ error: expect.stringMatching(/BRL|currency/i) });
  });

  it('errors when amount is not positive', () => {
    const result = mapBinnacleItem(
      movement({ amount: { currency_id: 'BRL', fraction: '0', cents: '0' } }),
    );
    expect(result).toEqual({ error: expect.stringMatching(/amount/i) });
  });

  it('errors when title is empty', () => {
    const result = mapBinnacleItem(movement({ title: '   ' }));
    expect(result).toEqual({ error: expect.stringMatching(/title|description/i) });
  });

  it('errors when datetime is not a valid ISO datetime', () => {
    const result = mapBinnacleItem(movement({ datetime: 'not-a-date' }));
    expect(result).toEqual({ error: expect.stringMatching(/datetime|date/i) });
  });

  it('does not drop a movement because of metadata.kind', () => {
    for (const kind of ['payment', 'credit', 'transfer', 'investment'] as const) {
      const result = mapBinnacleItem(movement({ metadata: { kind, detail: 'off' } }));
      expect(result).toMatchObject({ externalId: 'AbCdEfGhIjKlMnOp1', type: 'credit' });
    }
  });

  it('derives cents from fraction×100 when cents is absent', () => {
    const result = mapBinnacleItem(
      movement({ amount: { currency_id: 'BRL', fraction: '12.34' } }),
    );
    expect(result).toMatchObject({ amount: fromCents(1234), type: 'credit' });
  });
});

describe('flattenBinnaclePages', () => {
  it('flattens movement items and ignores day-group headers', () => {
    const page = {
      total: 2,
      pages: 1,
      groups: [
        {
          title: '15 de março',
          right_content: 'Saldo do dia',
          items: [
            movement({ movement_id: 'CreditId00000001', title: 'In' }),
            movement({
              movement_id: 'DebitId000000002',
              title: 'Out',
              amount: { currency_id: 'BRL', fraction: '-5.00', cents: '-500' },
            }),
          ],
        },
        {
          title: 'Empty day header only',
          right_content: 'R$ 0,00',
          // no items — day header must not become a transaction
        },
      ],
    };

    const { rows, errors } = flattenBinnaclePages([page]);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId)).toEqual(['CreditId00000001', 'DebitId000000002']);
    expect(rows.map((r) => r.type)).toEqual(['credit', 'debit']);
  });

  it('collects row errors without dropping valid siblings', () => {
    const page = pageWithItems([
      movement({ movement_id: 'OkMovementId00001', title: 'Good' }),
      movement({
        movement_id: 'BadCurrencyId0001',
        amount: { currency_id: 'EUR', fraction: '1', cents: '100' },
      }),
      movement({ movement_id: 'EmptyTitleId00001', title: '' }),
    ]);

    const { rows, errors } = flattenBinnaclePages([page]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe('OkMovementId00001');
    expect(errors).toHaveLength(2);
  });

  it('merges items across multiple pages', () => {
    const page1 = pageWithItems([movement({ movement_id: 'Page1MoveId000001' })]);
    const page2 = pageWithItems([
      movement({
        movement_id: 'Page2MoveId000001',
        amount: { currency_id: 'BRL', fraction: '-1.00', cents: '-100' },
      }),
    ]);

    const { rows, errors } = flattenBinnaclePages([page1, page2]);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });
});
