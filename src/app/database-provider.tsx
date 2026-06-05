import { createContext, useEffect, useState, type ReactNode } from 'react';
import type { Database } from '../storage/database.ts';
import { initDatabase } from '../storage/init.ts';

export const DatabaseContext = createContext<Database | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then((database) => {
        if (!cancelled) setDb(database);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-700 mb-2">Database Error</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading…</p>
      </div>
    );
  }

  return <DatabaseContext value={db}>{children}</DatabaseContext>;
}
