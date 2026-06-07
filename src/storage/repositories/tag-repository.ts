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
  create(params: CreateTagParams): Tag;
  getById(id: string): Tag | null;
  getAll(): Tag[];
  update(id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>): Tag;
  delete(id: string): void;
};

export function createTagRepository(db: Database): TagRepository {
  return {
    create(params: CreateTagParams): Tag {
      const tag = createTag(params);
      db.exec('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', [tag.id, tag.name, tag.color]);
      return tag;
    },

    getById(id: string): Tag | null {
      const rows = db.execO('SELECT * FROM tags WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return rowToTag(rows[0]!);
    },

    getAll(): Tag[] {
      return db.execO('SELECT * FROM tags ORDER BY name').map(rowToTag);
    },

    update(id: string, changes: Partial<Pick<Tag, 'name' | 'color'>>): Tag {
      const existing = this.getById(id);
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
        db.exec(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      return this.getById(id)!;
    },

    delete(id: string): void {
      db.exec('DELETE FROM transaction_tags WHERE tag_id = ?', [id]);
      db.exec('DELETE FROM tags WHERE id = ?', [id]);
    },
  };
}
