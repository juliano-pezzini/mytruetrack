import type { Database, Row } from '../database.ts';
import type { Tag, CreateTagParams } from '../../domain/tag.ts';
import { createTag } from '../../domain/tag.ts';

function rowToTag(row: Row): Tag {
  return createTag({
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
  });
}

export type TagRepository = {
  create(params: CreateTagParams): Promise<Tag>;
  getById(id: string): Promise<Tag | null>;
  getAll(): Promise<Tag[]>;
  update(id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag>;
  delete(id: string): Promise<void>;
};

export function createTagRepository(db: Database): TagRepository {
  return {
    async create(params: CreateTagParams): Promise<Tag> {
      const tag = createTag(params);
      await db.exec('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', [tag.id, tag.name, tag.color]);
      return tag;
    },

    async getById(id: string): Promise<Tag | null> {
      const rows = await db.execO('SELECT * FROM tags WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToTag(rows[0]!);
    },

    async getAll(): Promise<Tag[]> {
      return (await db.execO('SELECT * FROM tags ORDER BY name')).map(rowToTag);
    },

    async update(id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>): Promise<Tag> {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Tag not found: ${id}`);

      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (changes.name !== undefined) {
        sets.push('name = ?');
        values.push(changes.name);
      }
      if (changes.color !== undefined) {
        sets.push('color = ?');
        values.push(changes.color);
      }

      if (sets.length > 0) {
        values.push(id);
        await db.exec(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return (await this.getById(id))!;
    },

    async delete(id: string): Promise<void> {
      await db.exec('DELETE FROM transaction_tags WHERE tag_id = ?', [id]);
      await db.exec('DELETE FROM tags WHERE id = ?', [id]);
    },
  };
}
