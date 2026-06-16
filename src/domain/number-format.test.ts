import { describe, it, expect } from 'vitest';
import { detectNumberFormat, parseAmount } from './number-format.ts';
import { toCents } from './money.ts';

describe('number-format', () => {
  describe('detectNumberFormat', () => {
    it('detects US format from dot decimals', () => {
      expect(detectNumberFormat(['1234.56', '12.00', '0.99'])).toBe('us');
    });

    it('detects EU/BR format from comma decimals', () => {
      expect(detectNumberFormat(['1234,56', '12,00', '0,99'])).toBe('eu');
    });

    it('detects US format with thousands grouping', () => {
      expect(detectNumberFormat(['1,234.56', '2,000.00'])).toBe('us');
    });

    it('detects EU format with thousands grouping', () => {
      expect(detectNumberFormat(['1.234,56', '2.000,00'])).toBe('eu');
    });

    it('uses the rightmost separator when both are present', () => {
      expect(detectNumberFormat(['1.234,56'])).toBe('eu');
      expect(detectNumberFormat(['1,234.56'])).toBe('us');
    });

    it('treats multiple dots as EU thousands grouping', () => {
      expect(detectNumberFormat(['1.234.567'])).toBe('eu');
    });

    it('treats multiple commas as US thousands grouping', () => {
      expect(detectNumberFormat(['1,234,567'])).toBe('us');
    });

    it('defaults to US when there is no signal', () => {
      expect(detectNumberFormat(['100', '250', ''])).toBe('us');
      expect(detectNumberFormat([])).toBe('us');
    });
  });

  describe('parseAmount', () => {
    it('parses US decimals', () => {
      expect(toCents(parseAmount('1234.56', 'us'))).toBe(123456);
      expect(toCents(parseAmount('1,234.56', 'us'))).toBe(123456);
    });

    it('parses EU/BR decimals', () => {
      expect(toCents(parseAmount('1234,56', 'eu'))).toBe(123456);
      expect(toCents(parseAmount('1.234,56', 'eu'))).toBe(123456);
    });

    it('handles negative signs', () => {
      expect(toCents(parseAmount('-150,75', 'eu'))).toBe(-15075);
      expect(toCents(parseAmount('-150.75', 'us'))).toBe(-15075);
    });

    it('handles accounting-style parentheses as negative', () => {
      expect(toCents(parseAmount('(1.234,56)', 'eu'))).toBe(-123456);
    });

    it('strips currency symbols and spaces', () => {
      expect(toCents(parseAmount('R$ 1.234,56', 'eu'))).toBe(123456);
      expect(toCents(parseAmount('$1,234.56', 'us'))).toBe(123456);
    });

    it('throws on non-numeric input like a header value', () => {
      expect(() => parseAmount('Receita', 'eu')).toThrow();
      expect(() => parseAmount('', 'us')).toThrow();
    });
  });
});
