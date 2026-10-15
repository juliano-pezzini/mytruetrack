import { describe, expect, it } from 'vitest';
import { nameKey, splitTagNames, storedName } from './import-names.ts';

describe('storedName and nameKey', () => {
  it('stores Super Market and matches that name, not SuperMarket', () => {
    expect(storedName('  Super   Market ')).toBe('Super Market');
    expect(nameKey('  Super   Market ')).toBe(nameKey('Super Market'));
    expect(nameKey('Super Market')).not.toBe(nameKey('SuperMarket'));
  });

  it('keeps the casing of the input after collapsing whitespace', () => {
    expect(storedName('  SUPER   market ')).toBe('SUPER market');
    expect(nameKey('SUPER market')).toBe(nameKey('super market'));
  });

  it('does not match Café to Cafe', () => {
    expect(nameKey('Café')).not.toBe(nameKey('Cafe'));
  });

  it('treats punctuation as significant', () => {
    expect(nameKey('Super-Market')).not.toBe(nameKey('Super Market'));
  });
});

describe('splitTagNames', () => {
  it('splits food, travel; work into food, travel, and work', () => {
    expect(splitTagNames('food, travel; work')).toEqual(['food', 'travel', 'work']);
  });

  it('keeps food and travel once from food, food,, travel', () => {
    expect(splitTagNames('food, food,, travel')).toEqual(['food', 'travel']);
  });

  it('yields no names from commas, semicolons, and whitespace', () => {
    expect(splitTagNames(' , ; ')).toEqual([]);
  });
});
