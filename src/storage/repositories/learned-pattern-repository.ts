import type { Database, Row } from '../database.ts';
import type { LearnedCategoryPattern } from '../../domain/auto-categorization.ts';

function rowToPattern(row: Row): LearnedCategoryPattern {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    keyword: row.keyword as string,
    occurrenceCount: row.occurrence_count as number,
    confidenceScore: row.confidence_score as number,
    firstLearnedAt: row.first_learned_at as string,
    lastMatchedAt: (row.last_matched_at as string) || null,
    isActive: row.is_active === 1,
  };
}

export type LearnedPatternRepository = {
  create(pattern: LearnedCategoryPattern): LearnedCategoryPattern;
  getByKeyword(keyword: string): LearnedCategoryPattern[];
  getById(id: string): LearnedCategoryPattern | null;
  upsert(pattern: LearnedCategoryPattern): LearnedCategoryPattern;
};

export function createLearnedPatternRepository(db: Database): LearnedPatternRepository {
  return {
    create(pattern: LearnedCategoryPattern): LearnedCategoryPattern {
      db.exec(
        `INSERT INTO learned_category_patterns
         (id, category_id, keyword, occurrence_count, confidence_score, first_learned_at, last_matched_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pattern.id,
          pattern.categoryId,
          pattern.keyword,
          pattern.occurrenceCount,
          pattern.confidenceScore,
          pattern.firstLearnedAt,
          pattern.lastMatchedAt ?? '',
          pattern.isActive ? 1 : 0,
        ],
      );
      return pattern;
    },

    getByKeyword(keyword: string): LearnedCategoryPattern[] {
      return db
        .execO(
          'SELECT * FROM learned_category_patterns WHERE keyword = ? AND is_active = 1 ORDER BY confidence_score DESC',
          [keyword],
        )
        .map(rowToPattern);
    },

    getById(id: string): LearnedCategoryPattern | null {
      const rows = db.execO('SELECT * FROM learned_category_patterns WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToPattern(rows[0]!);
    },

    upsert(pattern: LearnedCategoryPattern): LearnedCategoryPattern {
      // Check if a pattern with same keyword+categoryId exists
      const existing = db.execO(
        'SELECT id FROM learned_category_patterns WHERE keyword = ? AND category_id = ?',
        [pattern.keyword, pattern.categoryId],
      );

      if (existing.length > 0) {
        const existingId = existing[0]!.id as string;
        db.exec(
          `UPDATE learned_category_patterns
           SET occurrence_count = ?, confidence_score = ?, last_matched_at = ?, is_active = ?
           WHERE id = ?`,
          [
            pattern.occurrenceCount,
            pattern.confidenceScore,
            pattern.lastMatchedAt ?? '',
            pattern.isActive ? 1 : 0,
            existingId,
          ],
        );
        return this.getById(existingId)!;
      }

      return this.create(pattern);
    },
  };
}
