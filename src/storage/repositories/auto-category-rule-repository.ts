import type { Database, Row } from '../database.ts';
import type { AutoCategoryRule } from '../../domain/auto-categorization.ts';

function rowToRule(row: Row): AutoCategoryRule {
  return {
    id: row.id as string,
    pattern: row.pattern as string,
    categoryId: row.category_id as string,
    priority: row.priority as number,
    isActive: row.is_active === 1,
  };
}

export type AutoCategoryRuleRepository = {
  create(rule: AutoCategoryRule): AutoCategoryRule;
  getActive(): AutoCategoryRule[];
  getById(id: string): AutoCategoryRule | null;
  update(id: string, changes: Partial<Pick<AutoCategoryRule, 'pattern' | 'categoryId' | 'priority' | 'isActive'>>): AutoCategoryRule;
};

export function createAutoCategoryRuleRepository(db: Database): AutoCategoryRuleRepository {
  return {
    create(rule: AutoCategoryRule): AutoCategoryRule {
      db.exec(
        'INSERT INTO auto_category_rules (id, pattern, category_id, priority, is_active) VALUES (?, ?, ?, ?, ?)',
        [rule.id, rule.pattern, rule.categoryId, rule.priority, rule.isActive ? 1 : 0],
      );
      return rule;
    },

    getActive(): AutoCategoryRule[] {
      return db
        .execO('SELECT * FROM auto_category_rules WHERE is_active = 1 ORDER BY priority DESC')
        .map(rowToRule);
    },

    getById(id: string): AutoCategoryRule | null {
      const rows = db.execO('SELECT * FROM auto_category_rules WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToRule(rows[0]!);
    },

    update(id: string, changes: Partial<Pick<AutoCategoryRule, 'pattern' | 'categoryId' | 'priority' | 'isActive'>>): AutoCategoryRule {
      const existing = this.getById(id);
      if (!existing) throw new Error(`AutoCategoryRule not found: ${id}`);

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (changes.pattern !== undefined) { sets.push('pattern = ?'); values.push(changes.pattern); }
      if (changes.categoryId !== undefined) { sets.push('category_id = ?'); values.push(changes.categoryId); }
      if (changes.priority !== undefined) { sets.push('priority = ?'); values.push(changes.priority); }
      if (changes.isActive !== undefined) { sets.push('is_active = ?'); values.push(changes.isActive ? 1 : 0); }

      if (sets.length > 0) {
        values.push(id);
        db.exec(`UPDATE auto_category_rules SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return this.getById(id)!;
    },
  };
}
