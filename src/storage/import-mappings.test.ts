import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from 'idb';
import {
  saveMapping,
  listMappings,
  listMappingsForAccount,
  touchMapping,
  deleteMapping,
} from './import-mappings.ts';
import type { ColumnMapping } from '../workers/types.ts';

const config: ColumnMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountStrategy: 'single',
  amountColumn: 2,
  debitColumn: null,
  creditColumn: null,
  typeColumn: null,
  numberFormat: 'eu',
};

async function clearStore(): Promise<void> {
  const db = await openDB('mytruetrack-import-mappings', 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('mappings')) {
        d.createObjectStore('mappings', { keyPath: 'id' });
      }
    },
  });
  await db.clear('mappings');
  db.close();
}

describe('import-mappings', () => {
  beforeEach(async () => {
    await clearStore();
  });

  it('saves and lists a mapping', async () => {
    const saved = await saveMapping({ name: 'Itaú', config, accountId: 'acc-1' });
    expect(saved.id).toBeTruthy();
    expect(saved.accountId).toBe('acc-1');

    const all = await listMappings();
    expect(all).toHaveLength(1);
    expect(all[0]!.name).toBe('Itaú');
    expect(all[0]!.config.numberFormat).toBe('eu');
  });

  it('scopes mappings to an account plus global ones', async () => {
    await saveMapping({ name: 'For acc-1', config, accountId: 'acc-1' });
    await saveMapping({ name: 'For acc-2', config, accountId: 'acc-2' });
    await saveMapping({ name: 'Global', config, accountId: null });

    const forAcc1 = await listMappingsForAccount('acc-1');
    const names = forAcc1.map((m) => m.name).sort();
    expect(names).toEqual(['For acc-1', 'Global']);
  });

  it('orders mappings most-recently-used first', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(1_000);
      const a = await saveMapping({ name: 'A', config, accountId: null });
      nowSpy.mockReturnValue(2_000);
      await saveMapping({ name: 'B', config, accountId: null });
      nowSpy.mockReturnValue(3_000);
      await touchMapping(a.id);

      const all = await listMappings();
      expect(all[0]!.name).toBe('A');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('deletes a mapping', async () => {
    const saved = await saveMapping({ name: 'Temp', config, accountId: null });
    await deleteMapping(saved.id);
    expect(await listMappings()).toHaveLength(0);
  });
});
