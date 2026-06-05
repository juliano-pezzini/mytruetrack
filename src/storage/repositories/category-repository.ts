import type { Database, Row } from '../database.ts';
import type { Category, CategoryType, CreateCategoryParams } from '../../domain/category.ts';
import { createCategory } from '../../domain/category.ts';

function rowToCategory(row: Row): Category {
  return createCategory({
    id: row.id as string,
    name: row.name as string,
    type: row.type as CategoryType,
    parentId: (row.parent_id as string) || null,
    description: (row.description as string) || null,
  });
}

export type CategoryRepository = {
  create(params: CreateCategoryParams): Category;
  getById(id: string): Category | null;
  getAll(): Category[];
  update(id: string, changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>): Category;
  delete(id: string): void;
};

export function createCategoryRepository(db: Database): CategoryRepository {
  return {
    create(params: CreateCategoryParams): Category {
      const category = createCategory(params);
      db.exec(
        'INSERT INTO categories (id, parent_id, name, type, description) VALUES (?, ?, ?, ?, ?)',
        [
          category.id,
          category.parentId ?? '',
          category.name,
          category.type,
          category.description ?? '',
        ],
      );
      return category;
    },

    getById(id: string): Category | null {
      const rows = db.execO('SELECT * FROM categories WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToCategory(rows[0]!);
    },

    getAll(): Category[] {
      return db.execO('SELECT * FROM categories ORDER BY name').map(rowToCategory);
    },

    update(id: string, changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>): Category {
      const existing = this.getById(id);
      if (!existing) throw new Error(`Category not found: ${id}`);

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (changes.name !== undefined) {
        sets.push('name = ?');
        values.push(changes.name);
      }
      if (changes.type !== undefined) {
        sets.push('type = ?');
        values.push(changes.type);
      }
      if (changes.parentId !== undefined) {
        sets.push('parent_id = ?');
        values.push(changes.parentId ?? '');
      }
      if (changes.description !== undefined) {
        sets.push('description = ?');
        values.push(changes.description ?? '');
      }

      if (sets.length > 0) {
        values.push(id);
        db.exec(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return this.getById(id)!;
    },

    delete(id: string): void {
      const children = db.execO('SELECT id FROM categories WHERE parent_id = ?', [id]);
      if (children.length > 0) {
        throw new Error(`Cannot delete category ${id}: has ${children.length} child categories`);
      }
      db.exec('DELETE FROM categories WHERE id = ?', [id]);
    },
  };
}
