// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { openDB } from 'idb';
import type { Database } from '../../../storage/database.ts';
import { saveMapping } from '../../../storage/import-mappings.ts';
import type { ColumnMapping, ImportGrid } from '../../../workers/types.ts';
import { ImportWizard } from './ImportWizard.tsx';

const db: Database = {
  exec: async () => undefined,
  execA: async () => [],
  execO: async () => [],
  close: async () => undefined,
};

const grid: ImportGrid = {
  headers: ['Date', 'Description', 'Amount', 'Notes', 'Labels'],
  rows: [['01/02/2026', 'Rent', '10.00', 'Market', 'food']],
};

const savedMapping: ColumnMapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountStrategy: 'single',
  amountColumn: 2,
  debitColumn: null,
  creditColumn: null,
  typeColumn: null,
  numberFormat: 'us',
  dateFormat: 'mdy',
  categoryColumn: 3,
  tagsColumn: 4,
};

async function clearMappings(): Promise<void> {
  const db = await openDB('mytruetrack-import-mappings', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('mappings')) {
        database.createObjectStore('mappings', { keyPath: 'id' });
      }
    },
  });
  await db.clear('mappings');
  db.close();
}

describe('ImportWizard saved mapping', () => {
  beforeEach(async () => {
    await clearMappings();
  });

  it('replaces the auto-detected date format and column pickers when a saved mapping loads', async () => {
    await saveMapping({ name: 'Month first', config: savedMapping, accountId: 'acc-1' });

    render(
      createElement(ImportWizard, {
        db,
        accountId: 'acc-1',
        grid,
        fileName: 'statement.csv',
        onComplete: () => undefined,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('2026-02-01')).toBeTruthy();
    });
    expect((screen.getByTestId('map-date-format') as HTMLSelectElement).value).toBe('dmy');
    expect((screen.getByTestId('map-category') as HTMLSelectElement).value).toBe('');
    expect((screen.getByTestId('map-tags') as HTMLSelectElement).value).toBe('');

    fireEvent.click(await screen.findByRole('button', { name: 'Month first' }));

    await waitFor(() => {
      expect(screen.getByText('2026-01-02')).toBeTruthy();
    });
    expect(screen.queryByText('2026-02-01')).toBeNull();
    expect((screen.getByTestId('map-date-format') as HTMLSelectElement).value).toBe('mdy');
    expect((screen.getByTestId('map-category') as HTMLSelectElement).value).toBe('3');
    expect((screen.getByTestId('map-tags') as HTMLSelectElement).value).toBe('4');
  });
});
