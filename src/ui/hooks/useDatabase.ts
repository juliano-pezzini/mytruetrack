import { useContext } from 'react';
import { DatabaseContext } from '../../app/database-provider.tsx';
import type { Database } from '../../storage/database.ts';

export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error('useDatabase must be used within DatabaseProvider after initialization');
  }
  return db;
}
