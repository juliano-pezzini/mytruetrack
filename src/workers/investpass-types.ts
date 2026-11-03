/**
 * Zod schemas and types for InvestPass bridge payload validation.
 *
 * Validates data at the trust boundary before processing.
 */

import { z } from 'zod';
import type { ImportResult } from './types.ts';

/** zod >= 4.6.6 rejects this bound before it walks elements. */
export const MAX_INVESTPASS_TRANSACTIONS = 100_000;

export const InvestPassTransactionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  date: z.string().datetime(),
  amount: z.number().nonnegative().finite(),
  type: z.enum(['DEBIT', 'CREDIT']),
  ignored: z.boolean(),
  category: z
    .object({
      name: z.string(),
      icon: z.string(),
      color: z.string(),
    })
    .nullable(),
  account: z.object({
    name: z.string(),
    institution: z.object({
      name: z.string(),
    }),
  }),
});

export const ImportPayloadSchema = z.object({
  type: z.literal('IMPORT_PAYLOAD'),
  transactions: z.array(InvestPassTransactionSchema).max(MAX_INVESTPASS_TRANSACTIONS),
});

export type InvestPassTransaction = z.infer<typeof InvestPassTransactionSchema>;

export type InvestPassImportResult = {
  readonly perAccount: Record<string, ImportResult>;
  readonly unmappedAccounts: string[];
};
