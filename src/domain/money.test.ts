import { describe, it, expect } from 'vitest';
import {
  fromCents,
  fromDecimal,
  add,
  subtract,
  negate,
  abs,
  toCents,
  format,
  isZero,
  isPositive,
  isNegative,
  ZERO,
} from './money.ts';

describe('Money', () => {
  describe('fromCents', () => {
    it('creates Money from integer cents', () => {
      const m = fromCents(15075);
      expect(toCents(m)).toBe(15075);
    });

    it('handles negative cents', () => {
      const m = fromCents(-50000);
      expect(toCents(m)).toBe(-50000);
    });

    it('handles zero', () => {
      const m = fromCents(0);
      expect(toCents(m)).toBe(0);
    });

    it('rejects non-integer', () => {
      expect(() => fromCents(1.5)).toThrow('requires an integer');
    });
  });

  describe('fromDecimal', () => {
    it('parses "150.75" to 15075 cents', () => {
      expect(toCents(fromDecimal('150.75'))).toBe(15075);
    });

    it('parses "3000.00" to 300000 cents', () => {
      expect(toCents(fromDecimal('3000.00'))).toBe(300000);
    });

    it('parses "-500.00" to -50000 cents', () => {
      expect(toCents(fromDecimal('-500.00'))).toBe(-50000);
    });

    it('parses "0.01" to 1 cent', () => {
      expect(toCents(fromDecimal('0.01'))).toBe(1);
    });

    it('parses "100" (no decimal) to 10000 cents', () => {
      expect(toCents(fromDecimal('100'))).toBe(10000);
    });

    it('parses "99.9" (one decimal) to 9990 cents', () => {
      expect(toCents(fromDecimal('99.9'))).toBe(9990);
    });

    it('parses "  42.50  " (whitespace) correctly', () => {
      expect(toCents(fromDecimal('  42.50  '))).toBe(4250);
    });

    it('rejects empty string', () => {
      expect(() => fromDecimal('')).toThrow('non-empty');
    });

    it('rejects invalid format', () => {
      expect(() => fromDecimal('abc')).toThrow('Invalid decimal');
    });
  });

  describe('arithmetic', () => {
    it('adds two Money values', () => {
      const result = add(fromCents(1000), fromCents(2500));
      expect(toCents(result)).toBe(3500);
    });

    it('subtracts Money values', () => {
      const result = subtract(fromCents(5000), fromCents(1500));
      expect(toCents(result)).toBe(3500);
    });

    it('subtraction can produce negative result', () => {
      const result = subtract(fromCents(1000), fromCents(3000));
      expect(toCents(result)).toBe(-2000);
    });

    it('negates a positive value', () => {
      expect(toCents(negate(fromCents(500)))).toBe(-500);
    });

    it('negates a negative value', () => {
      expect(toCents(negate(fromCents(-500)))).toBe(500);
    });

    it('abs of negative is positive', () => {
      expect(toCents(abs(fromCents(-3000)))).toBe(3000);
    });

    it('abs of positive stays positive', () => {
      expect(toCents(abs(fromCents(3000)))).toBe(3000);
    });
  });

  describe('comparisons', () => {
    it('isZero on ZERO', () => {
      expect(isZero(ZERO)).toBe(true);
    });

    it('isZero on non-zero', () => {
      expect(isZero(fromCents(1))).toBe(false);
    });

    it('isPositive', () => {
      expect(isPositive(fromCents(100))).toBe(true);
      expect(isPositive(fromCents(-100))).toBe(false);
      expect(isPositive(ZERO)).toBe(false);
    });

    it('isNegative', () => {
      expect(isNegative(fromCents(-100))).toBe(true);
      expect(isNegative(fromCents(100))).toBe(false);
    });
  });

  describe('format', () => {
    it('formats positive value', () => {
      expect(format(fromCents(123456))).toBe('1,234.56');
    });

    it('formats negative value', () => {
      const formatted = format(fromCents(-50000));
      // Different locales may use different negative formats
      expect(formatted).toContain('500.00');
    });

    it('formats zero', () => {
      expect(format(ZERO)).toBe('0.00');
    });

    it('formats small value', () => {
      expect(format(fromCents(1))).toBe('0.01');
    });
  });

  describe('no floating-point drift', () => {
    it('adding many small amounts stays exact', () => {
      let total = ZERO;
      for (let i = 0; i < 1000; i++) {
        total = add(total, fromCents(33)); // $0.33 × 1000 = $330.00
      }
      expect(toCents(total)).toBe(33000);
    });
  });
});
