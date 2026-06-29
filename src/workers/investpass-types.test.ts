import { describe, it, expect } from 'vitest';
import { InvestPassTransactionSchema, ImportPayloadSchema } from './investpass-types.ts';
import type { InvestPassImportResult } from './investpass-types.ts';

const validTransaction = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Supermercado Extra',
  date: '2025-06-15T14:30:00.000Z',
  amount: 15099,
  type: 'DEBIT' as const,
  ignored: false,
  category: { name: 'Groceries', icon: 'cart', color: '#FF5733' },
  account: { name: 'Nubank', institution: { name: 'Nu Pagamentos' } },
};

describe('InvestPassTransactionSchema', () => {
  it('validates a correct transaction', () => {
    const result = InvestPassTransactionSchema.safeParse(validTransaction);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(validTransaction.id);
      expect(result.data.amount).toBe(15099);
    }
  });

  it('accepts null category', () => {
    const tx = { ...validTransaction, category: null };
    const result = InvestPassTransactionSchema.safeParse(tx);
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = validTransaction;
    const result = InvestPassTransactionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid type enum', () => {
    const tx = { ...validTransaction, type: 'TRANSFER' };
    const result = InvestPassTransactionSchema.safeParse(tx);
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const tx = { ...validTransaction, amount: -100 };
    const result = InvestPassTransactionSchema.safeParse(tx);
    expect(result.success).toBe(false);
  });

  it('strips extra fields', () => {
    const tx = { ...validTransaction, extraField: 'should be removed' };
    const result = InvestPassTransactionSchema.safeParse(tx);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('extraField' in result.data).toBe(false);
    }
  });
});

describe('ImportPayloadSchema', () => {
  it('validates a correct payload', () => {
    const payload = { type: 'IMPORT_PAYLOAD', transactions: [validTransaction] };
    const result = ImportPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects wrong type literal', () => {
    const payload = { type: 'WRONG', transactions: [validTransaction] };
    const result = ImportPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe('InvestPassImportResult type', () => {
  it('is structurally compatible', () => {
    const result: InvestPassImportResult = {
      perAccount: {
        Nubank: { imported: 5, skipped: 1, errors: [] },
      },
      unmappedAccounts: ['Unknown Bank'],
    };
    expect(result.unmappedAccounts).toContain('Unknown Bank');
  });
});
