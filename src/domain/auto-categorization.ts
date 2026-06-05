/**
 * Auto-categorization types — rules, learned patterns, corrections, suggestions.
 *
 * These are pure type definitions for the auto-categorization system.
 * Service logic is in auto-categorization-service.ts.
 */

/** Explicit rule: pattern → category mapping with priority */
export type AutoCategoryRule = Readonly<{
  id: string;
  pattern: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
}>;

/** Learned pattern from user corrections */
export type LearnedCategoryPattern = Readonly<{
  id: string;
  categoryId: string;
  keyword: string;
  occurrenceCount: number;
  confidenceScore: number; // 0–100
  firstLearnedAt: string; // ISO datetime
  lastMatchedAt: string | null;
  isActive: boolean;
}>;

/** How a user corrected a categorization */
export type CorrectionType = 'override' | 'manual_assign' | 'reject_suggestion';

/** Audit record of a user correction */
export type AutoCategoryCorrection = Readonly<{
  id: string;
  transactionId: string;
  originalCategoryId: string | null;
  correctedCategoryId: string;
  descriptionText: string;
  correctionType: CorrectionType;
  confidenceAtCorrection: number | null;
}>;

/** Source of a categorization suggestion */
export type SuggestionSource = 'explicit_rule' | 'learned_pattern';

/** A category suggestion returned by the auto-categorization service */
export type CategorizationSuggestion = Readonly<{
  categoryId: string;
  confidence: number; // 0–100
  source: SuggestionSource;
}>;
