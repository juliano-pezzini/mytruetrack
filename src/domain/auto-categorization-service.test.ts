import { describe, it, expect } from 'vitest';
import {
  suggestCategory,
  extractKeywords,
  calculateConfidence,
  processCorrection,
} from './auto-categorization-service.ts';
import type { AutoCategoryRule, LearnedCategoryPattern } from './auto-categorization.ts';

// --- Helpers ---

function rule(
  overrides: Partial<AutoCategoryRule> & { pattern: string; categoryId: string; priority: number },
): AutoCategoryRule {
  return {
    id: `rule-${overrides.priority}`,
    isActive: true,
    ...overrides,
  };
}

function pattern(
  overrides: Partial<LearnedCategoryPattern> & {
    keyword: string;
    categoryId: string;
    confidenceScore: number;
  },
): LearnedCategoryPattern {
  return {
    id: `pat-${overrides.keyword}`,
    occurrenceCount: 1,
    firstLearnedAt: '2026-01-01T00:00:00Z',
    lastMatchedAt: null,
    isActive: true,
    ...overrides,
  };
}

describe('suggestCategory', () => {
  it('matches explicit rule by substring (case-insensitive)', () => {
    const rules = [rule({ pattern: 'walmart', categoryId: 'cat-groceries', priority: 10 })];
    const result = suggestCategory('WALMART SUPERCENTER #1234', rules, []);
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe('cat-groceries');
    expect(result!.source).toBe('explicit_rule');
    expect(result!.confidence).toBeGreaterThanOrEqual(80);
  });

  it('selects highest-priority rule (lowest number) when multiple match', () => {
    const rules = [
      rule({ pattern: 'gas', categoryId: 'cat-fuel', priority: 20 }),
      rule({ pattern: 'gas', categoryId: 'cat-utilities', priority: 10 }),
    ];
    const result = suggestCategory('GAS STATION FILL UP', rules, []);
    expect(result!.categoryId).toBe('cat-utilities'); // priority 10 wins
  });

  it('skips inactive rules', () => {
    const rules = [
      rule({ pattern: 'coffee', categoryId: 'cat-dining', priority: 10, isActive: false }),
    ];
    const result = suggestCategory('STARBUCKS COFFEE', rules, []);
    expect(result).toBeNull();
  });

  it('falls back to learned pattern when no rule matches', () => {
    const rules = [rule({ pattern: 'nonexistent', categoryId: 'cat-x', priority: 10 })];
    const patterns = [
      pattern({ keyword: 'starbucks', categoryId: 'cat-dining', confidenceScore: 85 }),
    ];
    const result = suggestCategory('STARBUCKS RESERVE #42', rules, patterns);
    expect(result!.categoryId).toBe('cat-dining');
    expect(result!.source).toBe('learned_pattern');
    expect(result!.confidence).toBe(85);
  });

  it('selects highest-confidence learned pattern', () => {
    const patterns = [
      pattern({ keyword: 'uber', categoryId: 'cat-transport', confidenceScore: 75 }),
      pattern({ keyword: 'uber', categoryId: 'cat-food', confidenceScore: 90 }),
    ];
    const result = suggestCategory('UBER EATS DELIVERY', [], patterns);
    expect(result!.categoryId).toBe('cat-food'); // 90 > 75
  });

  it('skips learned patterns below confidence threshold', () => {
    const patterns = [
      pattern({ keyword: 'random', categoryId: 'cat-x', confidenceScore: 50 }),
    ];
    const result = suggestCategory('RANDOM STORE', [], patterns);
    expect(result).toBeNull(); // 50 < 70 threshold
  });

  it('prefers most recently matched pattern on tie', () => {
    const patterns = [
      pattern({
        keyword: 'amazon',
        categoryId: 'cat-shopping',
        confidenceScore: 80,
        lastMatchedAt: '2026-05-01T00:00:00Z',
      }),
      pattern({
        keyword: 'amazon',
        categoryId: 'cat-electronics',
        confidenceScore: 80,
        lastMatchedAt: '2026-05-15T00:00:00Z',
      }),
    ];
    const result = suggestCategory('AMAZON.COM ORDER', [], patterns);
    expect(result!.categoryId).toBe('cat-electronics'); // more recent
  });

  it('returns null when nothing matches', () => {
    const result = suggestCategory('COMPLETELY UNKNOWN MERCHANT', [], []);
    expect(result).toBeNull();
  });

  it('skips inactive learned patterns', () => {
    const patterns = [
      pattern({
        keyword: 'netflix',
        categoryId: 'cat-entertainment',
        confidenceScore: 90,
        isActive: false,
      }),
    ];
    const result = suggestCategory('NETFLIX SUBSCRIPTION', [], patterns);
    expect(result).toBeNull();
  });
});

describe('extractKeywords', () => {
  it('extracts words >= 3 characters', () => {
    const kws = extractKeywords('WALMART SUPERCENTER 123 TX');
    expect(kws).toContain('walmart');
    expect(kws).toContain('supercenter');
    expect(kws).toContain('123');
    expect(kws).not.toContain('tx'); // 2 chars
  });

  it('deduplicates keywords', () => {
    const kws = extractKeywords('coffee coffee COFFEE');
    expect(kws).toEqual(['coffee']);
  });

  it('returns empty for short words only', () => {
    const kws = extractKeywords('A B C');
    expect(kws).toEqual([]);
  });
});

describe('calculateConfidence', () => {
  it('base confidence for 1 occurrence, no recency', () => {
    expect(calculateConfidence(1, null)).toBe(55); // 50 + 5
  });

  it('increases with occurrences', () => {
    expect(calculateConfidence(5, null)).toBe(75); // 50 + 25
  });

  it('caps at 95', () => {
    expect(calculateConfidence(20, null)).toBe(95); // min(95, 50 + 100)
  });

  it('adds recency bonus for recent match (< 30 days)', () => {
    const now = '2026-06-04T00:00:00Z';
    const recent = '2026-05-20T00:00:00Z'; // 15 days ago
    expect(calculateConfidence(1, recent, now)).toBe(65); // 50 + 5 + 10
  });

  it('adds smaller bonus for 30-90 day match', () => {
    const now = '2026-06-04T00:00:00Z';
    const older = '2026-04-01T00:00:00Z'; // ~64 days ago
    expect(calculateConfidence(1, older, now)).toBe(60); // 50 + 5 + 5
  });

  it('no bonus for > 90 day match', () => {
    const now = '2026-06-04T00:00:00Z';
    const old = '2026-01-01T00:00:00Z'; // ~154 days ago
    expect(calculateConfidence(1, old, now)).toBe(55); // 50 + 5 + 0
  });
});

describe('processCorrection', () => {
  it('creates new patterns from keywords', () => {
    const now = '2026-06-04T12:00:00Z';
    const result = processCorrection('WALMART SUPERCENTER', 'cat-groceries', [], now);

    expect(result.length).toBe(2); // "walmart", "supercenter"
    expect(result[0]!.keyword).toBe('walmart');
    expect(result[0]!.categoryId).toBe('cat-groceries');
    expect(result[0]!.occurrenceCount).toBe(1);
    expect(result[0]!.isActive).toBe(true);
  });

  it('increments existing pattern occurrence', () => {
    const existing = [
      pattern({
        keyword: 'walmart',
        categoryId: 'cat-groceries',
        confidenceScore: 55,
        occurrenceCount: 1,
      }),
    ];
    const now = '2026-06-04T12:00:00Z';
    const result = processCorrection('WALMART STORE', 'cat-groceries', existing, now);

    const updated = result.find((p) => p.keyword === 'walmart' && p.categoryId === 'cat-groceries');
    expect(updated!.occurrenceCount).toBe(2);
    expect(updated!.confidenceScore).toBeGreaterThan(55);
    expect(updated!.lastMatchedAt).toBe(now);
  });

  it('does not modify patterns for different categories', () => {
    const existing = [
      pattern({
        keyword: 'amazon',
        categoryId: 'cat-shopping',
        confidenceScore: 70,
        occurrenceCount: 3,
      }),
    ];
    const now = '2026-06-04T12:00:00Z';
    const result = processCorrection('AMAZON ORDER', 'cat-electronics', existing, now);

    // Original pattern unchanged
    const original = result.find((p) => p.categoryId === 'cat-shopping');
    expect(original!.occurrenceCount).toBe(3);

    // New pattern created for cat-electronics
    const newPat = result.find((p) => p.keyword === 'amazon' && p.categoryId === 'cat-electronics');
    expect(newPat).toBeDefined();
    expect(newPat!.occurrenceCount).toBe(1);
  });
});
