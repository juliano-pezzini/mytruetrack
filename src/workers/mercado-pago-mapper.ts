/**
 * Map Mercado Pago binnacle JSON pages to ParsedTransaction rows.
 *
 * PoC envelope: { total, pages, groups[] }. Day groups expose movements under `items`.
 * Amount sign: signed `amount.cents` / `amount.fraction` strings (negative ⇒ debit).
 */

import { z } from 'zod';
import { fromCents } from '../domain/money.ts';
import type { ImportError, ParsedTransaction } from './types.ts';

const AmountSchema = z.object({
  currency_id: z.string().optional(),
  fraction: z.string().optional(),
  cents: z.string().optional(),
});

const MovementItemSchema = z.object({
  movement_id: z.string().min(1),
  datetime: z.string(),
  title: z.string(),
  amount: AmountSchema,
  description: z.string().optional(),
  metadata: z.unknown().optional(),
});

const DayGroupSchema = z
  .object({
    title: z.string().optional(),
    right_content: z.string().optional(),
    items: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const BinnaclePageSchema = z.object({
  total: z.number(),
  pages: z.number(),
  groups: z.array(DayGroupSchema),
});

export type MapBinnacleItemResult = ParsedTransaction | { readonly error: string };

/**
 * Convert an ISO datetime to YYYY-MM-DD in America/Sao_Paulo.
 */
function convertDateToSaoPaulo(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Prefer `cents` as full minor units when present; else derive from fraction×100.
 * Sign comes from the chosen numeric string (negative ⇒ debit).
 */
function parseSignedCents(amount: z.infer<typeof AmountSchema>): number | null {
  if (amount.cents !== undefined && amount.cents.trim() !== '') {
    const raw = Number(amount.cents.replace(',', '.'));
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    return raw;
  }
  if (amount.fraction !== undefined && amount.fraction.trim() !== '') {
    const raw = Number(amount.fraction.replace(',', '.'));
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw * 100);
  }
  return null;
}

export function mapBinnacleItem(item: unknown): MapBinnacleItemResult {
  const parsed = MovementItemSchema.safeParse(item);
  if (!parsed.success) {
    return { error: 'Invalid movement item' };
  }

  const { movement_id, datetime, title, amount } = parsed.data;

  if (amount.currency_id !== 'BRL') {
    return { error: 'currency_id must be BRL' };
  }

  const description = title.trim();
  if (description === '') {
    return { error: 'title/description is required' };
  }

  const date = convertDateToSaoPaulo(datetime);
  if (date === null) {
    return { error: 'datetime is not a valid ISO datetime' };
  }

  const signedCents = parseSignedCents(amount);
  if (signedCents === null) {
    return { error: 'amount is not a valid integer cent value' };
  }

  const absolute = Math.abs(signedCents);
  if (absolute <= 0) {
    return { error: 'amount must be positive' };
  }

  return {
    date,
    description,
    amount: fromCents(absolute),
    type: signedCents < 0 ? 'debit' : 'credit',
    externalId: movement_id,
  };
}

export function flattenBinnaclePages(
  pages: readonly unknown[],
): { rows: ParsedTransaction[]; errors: ImportError[] } {
  const rows: ParsedTransaction[] = [];
  const errors: ImportError[] = [];
  let index = 0;

  for (const page of pages) {
    const envelope = BinnaclePageSchema.safeParse(page);
    if (!envelope.success) {
      errors.push({ index, message: 'Invalid binnacle page envelope' });
      index++;
      continue;
    }

    for (const group of envelope.data.groups) {
      for (const item of group.items ?? []) {
        const result = mapBinnacleItem(item);
        if ('error' in result) {
          errors.push({ index, message: result.error });
        } else {
          rows.push(result);
        }
        index++;
      }
    }
  }

  return { rows, errors };
}
