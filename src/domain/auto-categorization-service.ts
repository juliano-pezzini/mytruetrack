/**
 * Auto-categorization service — pure functions for suggesting categories
 * and learning from user corrections.
 *
 * Decision tree:
 * 1. Check explicit rules in priority order (lowest number = highest priority)
 * 2. Fall back to learned patterns (highest confidence ≥ 70)
 * 3. Return null if no match
 */

import type {
  AutoCategoryRule,
  LearnedCategoryPattern,
  CategorizationSuggestion,
} from './auto-categorization.ts';

const EXPLICIT_RULE_MIN_CONFIDENCE = 80;
const LEARNED_PATTERN_MIN_CONFIDENCE = 70;

/**
 * Suggest a category for a transaction description.
 *
 * @param description - The transaction description to categorize
 * @param rules - Explicit rules sorted by priority (caller responsibility) or unsorted
 * @param patterns - Learned patterns
 * @returns A suggestion or null
 */
export function suggestCategory(
  description: string,
  rules: readonly AutoCategoryRule[],
  patterns: readonly LearnedCategoryPattern[],
): CategorizationSuggestion | null {
  const descLower = description.toLowerCase();

  // Step 1: Check explicit rules in priority order (lowest number first)
  const sortedRules = [...rules].filter((r) => r.isActive).sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (descLower.includes(rule.pattern.toLowerCase())) {
      return {
        categoryId: rule.categoryId,
        confidence: EXPLICIT_RULE_MIN_CONFIDENCE,
        source: 'explicit_rule',
      };
    }
  }

  // Step 2: Fall back to learned patterns
  const activePatterns = patterns.filter((p) => p.isActive);
  let bestPattern: LearnedCategoryPattern | null = null;

  for (const pattern of activePatterns) {
    if (!descLower.includes(pattern.keyword.toLowerCase())) continue;
    if (pattern.confidenceScore < LEARNED_PATTERN_MIN_CONFIDENCE) continue;

    if (
      !bestPattern ||
      pattern.confidenceScore > bestPattern.confidenceScore ||
      (pattern.confidenceScore === bestPattern.confidenceScore &&
        (pattern.lastMatchedAt ?? '') > (bestPattern.lastMatchedAt ?? ''))
    ) {
      bestPattern = pattern;
    }
  }

  if (bestPattern) {
    return {
      categoryId: bestPattern.categoryId,
      confidence: bestPattern.confidenceScore,
      source: 'learned_pattern',
    };
  }

  // Step 3: No match
  return null;
}

/**
 * Extract keywords from a transaction description.
 * Normalizes to lowercase, splits on whitespace, filters short words.
 */
export function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w, i, arr) => arr.indexOf(w) === i); // deduplicate
}

/**
 * Calculate confidence score for a learned pattern.
 *
 * Formula: min(95, 50 + (occurrenceCount * 5) + recencyBonus)
 * Recency bonus: +10 if matched in the last 30 days, +5 if last 90 days
 */
export function calculateConfidence(
  occurrenceCount: number,
  lastMatchedAt: string | null,
  now: string = new Date().toISOString(),
): number {
  let recencyBonus = 0;

  if (lastMatchedAt) {
    const lastDate = new Date(lastMatchedAt).getTime();
    const nowDate = new Date(now).getTime();
    const daysDiff = (nowDate - lastDate) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 30) {
      recencyBonus = 10;
    } else if (daysDiff <= 90) {
      recencyBonus = 5;
    }
  }

  return Math.min(95, 50 + occurrenceCount * 5 + recencyBonus);
}

/**
 * Process a user correction and return updated/new learned patterns.
 *
 * @param descriptionText - The transaction description that was corrected
 * @param correctedCategoryId - The category the user chose
 * @param existingPatterns - Current learned patterns
 * @param now - Current timestamp (ISO string) for recency tracking
 * @returns New array of patterns (existing updated + new ones added)
 */
export function processCorrection(
  descriptionText: string,
  correctedCategoryId: string,
  existingPatterns: readonly LearnedCategoryPattern[],
  now: string = new Date().toISOString(),
): LearnedCategoryPattern[] {
  const keywords = extractKeywords(descriptionText);
  const result = [...existingPatterns];

  for (const keyword of keywords) {
    const existingIndex = result.findIndex(
      (p) => p.keyword === keyword && p.categoryId === correctedCategoryId,
    );

    if (existingIndex >= 0) {
      // Update existing pattern
      const existing = result[existingIndex]!;
      const newCount = existing.occurrenceCount + 1;
      result[existingIndex] = {
        ...existing,
        occurrenceCount: newCount,
        confidenceScore: calculateConfidence(newCount, now, now),
        lastMatchedAt: now,
      };
    } else {
      // Create new pattern
      result.push({
        id: `lp-${keyword}-${correctedCategoryId}`,
        categoryId: correctedCategoryId,
        keyword,
        occurrenceCount: 1,
        confidenceScore: calculateConfidence(1, now, now),
        firstLearnedAt: now,
        lastMatchedAt: now,
        isActive: true,
      });
    }
  }

  return result;
}
