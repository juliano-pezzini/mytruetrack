/**
 * Money — integer-cent value type for exact financial arithmetic.
 *
 * All amounts stored as integer cents (e.g., $150.75 = 15075).
 * Never use floats for money.
 */

/** Branded type to prevent accidental mixing with plain numbers */
export type Money = number & { readonly __brand: 'Money' };

/** Create Money from integer cents */
export function fromCents(cents: number): Money {
  if (!Number.isInteger(cents)) {
    throw new Error(`Money.fromCents requires an integer, got ${cents}`);
  }
  return cents as Money;
}

/** Create Money from a decimal string like "150.75" → 15075 cents */
export function fromDecimal(value: string): Money {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error('Money.fromDecimal requires a non-empty string');
  }

  // Handle negative sign
  const isNegative = trimmed.startsWith('-');
  const abs = isNegative ? trimmed.slice(1) : trimmed;

  const parts = abs.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid decimal format: "${value}"`);
  }

  const intPart = parts[0] ?? '0';
  const fracPart = (parts[1] ?? '').padEnd(2, '0').slice(0, 2);

  const intVal = parseInt(intPart, 10);
  const fracVal = parseInt(fracPart, 10);

  if (isNaN(intVal) || isNaN(fracVal)) {
    throw new Error(`Invalid decimal format: "${value}"`);
  }

  const cents = intVal * 100 + fracVal;
  return (isNegative ? -cents : cents) as Money;
}

/** Add two Money values */
export function add(a: Money, b: Money): Money {
  return (a + b) as Money;
}

/** Subtract b from a */
export function subtract(a: Money, b: Money): Money {
  return (a - b) as Money;
}

/** Negate a Money value */
export function negate(a: Money): Money {
  return (-a) as Money;
}

/** Absolute value */
export function abs(a: Money): Money {
  return Math.abs(a) as Money;
}

/** Get the raw integer cents value */
export function toCents(money: Money): number {
  return money as number;
}

/** Check if money is zero */
export function isZero(money: Money): boolean {
  return money === 0;
}

/** Check if money is positive */
export function isPositive(money: Money): boolean {
  return money > 0;
}

/** Check if money is negative */
export function isNegative(money: Money): boolean {
  return money < 0;
}

/** Format money for display: "1,234.56" or "-500.00" */
export function format(money: Money, locale: string = 'en-US'): string {
  const value = (money as number) / 100;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Zero constant */
export const ZERO: Money = 0 as Money;
