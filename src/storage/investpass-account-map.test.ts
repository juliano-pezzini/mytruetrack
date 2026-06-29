import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import {
  getAccountMap,
  getMapping,
  saveMapping,
  updateLastImportedDate,
  deleteMapping,
} from './investpass-account-map.ts';
import type { AccountMapEntry } from './investpass-account-map.ts';

const DB_NAME = 'mytruetrack-investpass-account-map';
const STORE_NAME = 'account-map';

async function clearStore(): Promise<void> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: 'investPassAccountName' });
      }
    },
  });
  await db.clear(STORE_NAME);
  db.close();
}

describe('investpass-account-map', () => {
  beforeEach(async () => {
    await clearStore();
  });

  it('saves and retrieves a mapping via getAccountMap', async () => {
    const entry: AccountMapEntry = {
      investPassAccountName: 'Nubank',
      mytruetrackAccountId: 'acc-1',
      lastImportedDate: null,
    };
    await saveMapping(entry);

    const all = await getAccountMap();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(entry);
  });

  it('getMapping returns the entry for a known name', async () => {
    const entry: AccountMapEntry = {
      investPassAccountName: 'Itaú',
      mytruetrackAccountId: 'acc-2',
      lastImportedDate: '2025-01-15',
    };
    await saveMapping(entry);

    const result = await getMapping('Itaú');
    expect(result).toEqual(entry);
  });

  it('getMapping returns undefined for unknown name', async () => {
    const result = await getMapping('NonExistent');
    expect(result).toBeUndefined();
  });

  it('updateLastImportedDate updates an existing entry', async () => {
    await saveMapping({
      investPassAccountName: 'Bradesco',
      mytruetrackAccountId: 'acc-3',
      lastImportedDate: null,
    });

    await updateLastImportedDate('Bradesco', '2025-06-01');

    const result = await getMapping('Bradesco');
    expect(result).toEqual({
      investPassAccountName: 'Bradesco',
      mytruetrackAccountId: 'acc-3',
      lastImportedDate: '2025-06-01',
    });
  });

  it('deleteMapping removes the entry', async () => {
    await saveMapping({
      investPassAccountName: 'Inter',
      mytruetrackAccountId: 'acc-4',
      lastImportedDate: null,
    });

    await deleteMapping('Inter');

    const all = await getAccountMap();
    expect(all).toHaveLength(0);
  });

  it('saveMapping overwrites an existing entry (upsert)', async () => {
    await saveMapping({
      investPassAccountName: 'Nubank',
      mytruetrackAccountId: 'acc-1',
      lastImportedDate: null,
    });
    await saveMapping({
      investPassAccountName: 'Nubank',
      mytruetrackAccountId: 'acc-99',
      lastImportedDate: '2025-03-01',
    });

    const all = await getAccountMap();
    expect(all).toHaveLength(1);
    expect(all[0]!.mytruetrackAccountId).toBe('acc-99');
  });
});
