import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../init.ts';
import { createTagRepository } from './tag-repository.ts';
import type { Database } from '../database.ts';
import type { TagRepository } from './tag-repository.ts';

describe('TagRepository', () => {
  let db: Database;
  let repo: TagRepository;

  beforeEach(async () => {
    db = await initDatabase();
    repo = createTagRepository(db);
  });

  afterEach(async () => {
    await closeDatabase(db);
  });

  it('creates and reads back a tag', async () => {
    const tag = await repo.create({ id: 't1', name: 'Important' });
    expect(tag.name).toBe('Important');
    expect(tag.color).toBe('#808080'); // default

    const fetched = await repo.getById('t1');
    expect(fetched!.name).toBe('Important');
    expect(fetched!.color).toBe('#808080');
  });

  it('creates tag with custom color', async () => {
    const tag = await repo.create({ id: 't1', name: 'Red', color: '#FF0000' });
    expect(tag.color).toBe('#FF0000');

    const fetched = await repo.getById('t1');
    expect(fetched!.color).toBe('#FF0000');
  });

  it('getAll returns tags ordered by name', async () => {
    await repo.create({ id: 't1', name: 'Zebra' });
    await repo.create({ id: 't2', name: 'Alpha' });

    const all = await repo.getAll();
    expect(all.map((t) => t.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('updates only provided fields', async () => {
    await repo.create({ id: 'u1', name: 'Old', color: '#111111' });
    const updated = await repo.update('u1', { name: 'New' });
    expect(updated.name).toBe('New');
    expect(updated.color).toBe('#111111'); // unchanged
  });

  it('updates color alone', async () => {
    await repo.create({ id: 'u2', name: 'Keep', color: '#111111' });
    const updated = await repo.update('u2', { color: '#FF0000' });
    expect(updated.name).toBe('Keep');
    expect(updated.color).toBe('#FF0000');
  });

  it('returns null for non-existent id', async () => {
    expect(await repo.getById('nope')).toBeNull();
  });

  it('deletes a tag and cleans up junction table', async () => {
    await repo.create({ id: 'del', name: 'Gone' });
    // Add a junction entry
    await db.exec("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ('txn1', 'del')");
    expect(await db.execO("SELECT * FROM transaction_tags WHERE tag_id = 'del'")).toHaveLength(1);

    await repo.delete('del');
    expect(await repo.getById('del')).toBeNull();
    expect(await db.execO("SELECT * FROM transaction_tags WHERE tag_id = 'del'")).toHaveLength(0);
  });
});
