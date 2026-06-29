/**
 * React hook that orchestrates the full InvestPass import flow:
 * connect to extension → fetch transactions → validate → check mappings → import.
 */

import { useState, useCallback, useRef } from 'react';
import { useDatabase } from './useDatabase.ts';
import {
  connectToExtension,
  type BridgeMessage,
} from '../../sync/investpass-bridge.ts';
import { ImportPayloadSchema } from '../../workers/investpass-types.ts';
import type { InvestPassImportResult, InvestPassTransaction } from '../../workers/investpass-types.ts';
import { getAccountMap, saveMapping } from '../../storage/investpass-account-map.ts';
import { processInvestPassImport } from '../../workers/investpass-import.ts';

export type ImportStatus = 'idle' | 'connecting' | 'fetching' | 'mapping' | 'importing' | 'done' | 'error';

export type UseInvestPassImportReturn = {
  status: ImportStatus;
  summary: InvestPassImportResult | null;
  unmappedAccounts: string[];
  error: string | null;
  startImport: (periodStart: string, periodEnd: string) => Promise<void>;
  mapAccount: (investPassName: string, mytruetrackAccountId: string) => Promise<void>;
};

/** Maximum time (ms) to wait for the extension to respond before timing out. */
const BRIDGE_TIMEOUT_MS = 30_000;

export function useInvestPassImport(extensionId: string): UseInvestPassImportReturn {
  const db = useDatabase();
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [summary, setSummary] = useState<InvestPassImportResult | null>(null);
  const [unmappedAccounts, setUnmappedAccounts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stash pending transactions while waiting for account mapping
  const pendingTransactions = useRef<InvestPassTransaction[]>([]);
  const importingRef = useRef(false);

  const runImport = useCallback(async (transactions: InvestPassTransaction[]) => {
    setStatus('importing');
    const accountMap = await getAccountMap();
    const result = await processInvestPassImport(db, transactions, accountMap);
    setSummary(result);
    setStatus('done');
  }, [db]);

  const startImport = useCallback(async (periodStart: string, periodEnd: string) => {
    if (importingRef.current) {
      throw new Error('Import already in progress');
    }
    importingRef.current = true;

    try {
      setStatus('connecting');
      setError(null);
      setSummary(null);
      setUnmappedAccounts([]);

      const port = connectToExtension(extensionId);
      if (!port) {
        setError('InvestPass extension not available');
        setStatus('error');
        return;
      }

      setStatus('fetching');

      const response = await new Promise<BridgeMessage>((resolve, reject) => {
        const timer = setTimeout(() => {
          port.disconnect();
          reject(new Error('Extension did not respond within 30 seconds'));
        }, BRIDGE_TIMEOUT_MS);

        port.onMessage((msg) => {
          clearTimeout(timer);
          port.disconnect();
          resolve(msg);
        });

        try {
          port.send({ type: 'START_IMPORT', periodStart, periodEnd });
        } catch (err) {
          clearTimeout(timer);
          port.disconnect();
          reject(err);
        }
      });

      if (response.type === 'ERROR') {
        setError(response.message);
        setStatus('error');
        return;
      }

      // Validate at the trust boundary
      const parsed = ImportPayloadSchema.safeParse(response);
      if (!parsed.success) {
        setError('Invalid payload from extension');
        setStatus('error');
        return;
      }

      const transactions = parsed.data.transactions;

      // Check for unmapped accounts
      const accountMap = await getAccountMap();
      const mappedNames = new Set(accountMap.map((e) => e.investPassAccountName));
      const txnAccountNames = new Set(transactions.map((t) => t.account.name));
      const unmapped = [...txnAccountNames].filter((name) => !mappedNames.has(name));

      if (unmapped.length > 0) {
        pendingTransactions.current = transactions;
        setUnmappedAccounts(unmapped);
        setStatus('mapping');
        // Don't reset importingRef — mapAccount will handle it
        return;
      }

      await runImport(transactions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus('error');
    } finally {
      // Only reset if we didn't enter the mapping flow (which returns early above)
      if (pendingTransactions.current.length === 0) {
        importingRef.current = false;
      }
    }
  }, [extensionId, runImport]);

  const mapAccount = useCallback(async (investPassName: string, mytruetrackAccountId: string) => {
    await saveMapping({
      investPassAccountName: investPassName,
      mytruetrackAccountId,
      lastImportedDate: null,
    });

    setUnmappedAccounts((prev) => {
      const next = prev.filter((n) => n !== investPassName);
      if (next.length === 0) {
        // All mapped — proceed with import
        void (async () => {
          try {
            await runImport(pendingTransactions.current);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus('error');
          } finally {
            importingRef.current = false;
            pendingTransactions.current = [];
          }
        })();
      }
      return next;
    });
  }, [runImport]);

  return { status, summary, unmappedAccounts, error, startImport, mapAccount };
}
