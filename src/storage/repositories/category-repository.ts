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
  create(params: CreateCategoryParams): Promise<Category>;
  getById(id: string): Promise<Category | null>;
  getAll(): Promise<Category[]>;
  update(
    id: string,
    changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>,
  ): Promise<Category>;
  delete(id: string): Promise<void>;
};

export function createCategoryRepository(db: Database): CategoryRepository {
  return {
    async create(params: CreateCategoryParams): Promise<Category> {
      const category = createCategory(params);
      await db.exec(
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

    async getById(id: string): Promise<Category | null> {
      const rows = await db.execO('SELECT * FROM categories WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToCategory(rows[0]!);
    },

    async getAll(): Promise<Category[]> {
      return (await db.execO('SELECT * FROM categories ORDER BY name')).map(rowToCategory);
    },

    async update(
      id: string,
      changes: Partial<Pick<Category, 'name' | 'type' | 'parentId' | 'description'>>,
    ): Promise<Category> {
      const existing = await this.getById(id);
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
        await db.exec(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return (await this.getById(id))!;
    },

    async delete(id: string): Promise<void> {
      const children = await db.execO('SELECT id FROM categories WHERE parent_id = ?', [id]);
      if (children.length > 0) {
        throw new Error(`Cannot delete category ${id}: has ${children.length} child categories`);
      }
      await db.exec('DELETE FROM categories WHERE id = ?', [id]);
    },
  };
}
