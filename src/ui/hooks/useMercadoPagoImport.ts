/**
 * React hook that orchestrates Mercado Pago import via the companion extension.
 * Session wait has no timeout — Cancel disconnects and writes nothing.
 */

import { useState, useCallback, useRef } from 'react';
import { useDatabase } from './useDatabase.ts';
import { useAutoSync } from './useAutoSync.ts';
import {
  connectToExtension,
  type BridgeMessage,
  type InvestPassPort,
} from '../../sync/investpass-bridge.ts';
import { isValidAccountImportPeriod } from '../../domain/account-import-period.ts';
import {
  processMercadoPagoImport,
  type MercadoPagoImportResult,
} from '../../workers/mercado-pago-import.ts';
import { EXTENSION_UNAVAILABLE_MESSAGE } from '../extension-unavailable.ts';

export type MercadoPagoImportStatus =
  'idle' | 'connecting' | 'fetching' | 'waiting_for_session' | 'importing' | 'done' | 'error';

export type UseMercadoPagoImportReturn = {
  status: MercadoPagoImportStatus;
  summary: MercadoPagoImportResult | null;
  error: string | null;
  startImport: (accountId: string, periodStart: string, periodEnd: string) => Promise<void>;
  cancel: () => void;
};

/** YYYY-MM-DD in America/Sao_Paulo. */
export function todaySaoPauloDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function useMercadoPagoImport(extensionId: string): UseMercadoPagoImportReturn {
  const db = useDatabase();
  const { notifyChange } = useAutoSync();
  const [status, setStatus] = useState<MercadoPagoImportStatus>('idle');
  const [summary, setSummary] = useState<MercadoPagoImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importingRef = useRef(false);
  const portRef = useRef<InvestPassPort | null>(null);
  const cancelWaitRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    cancelWaitRef.current?.();
    cancelWaitRef.current = null;
    portRef.current?.disconnect();
    portRef.current = null;
    importingRef.current = false;
    setStatus('idle');
    setError(null);
    setSummary(null);
  }, []);

  const startImport = useCallback(
    async (accountId: string, periodStart: string, periodEnd: string) => {
      if (importingRef.current) {
        throw new Error('Import already in progress');
      }

      if (!isValidAccountImportPeriod(periodStart, periodEnd)) {
        setError('Start date must be on or before end date');
        setStatus('error');
        setSummary(null);
        return;
      }

      importingRef.current = true;
      setStatus('connecting');
      setError(null);
      setSummary(null);

      try {
        const port = connectToExtension(extensionId);
        if (!port) {
          setError(EXTENSION_UNAVAILABLE_MESSAGE);
          setStatus('error');
          return;
        }

        portRef.current = port;
        setStatus('fetching');

        const response = await new Promise<BridgeMessage>((resolve, reject) => {
          let settled = false;

          const settle = (fn: () => void) => {
            if (settled) return;
            settled = true;
            cancelWaitRef.current = null;
            fn();
          };

          cancelWaitRef.current = () => {
            settle(() => {
              port.disconnect();
              portRef.current = null;
              reject(new DOMException('Import cancelled', 'AbortError'));
            });
          };

          port.onMessage((msg) => {
            if (msg.type === 'MP_SESSION_MISSING') {
              setStatus('waiting_for_session');
              // Keep port open — no timeout while waiting for sign-in.
              return;
            }

            if (msg.type === 'MP_IMPORT_PAYLOAD' || msg.type === 'ERROR') {
              settle(() => {
                port.disconnect();
                portRef.current = null;
                resolve(msg);
              });
              return;
            }
          });

          try {
            port.send({ type: 'START_MP_IMPORT', periodStart, periodEnd });
          } catch (err) {
            settle(() => {
              port.disconnect();
              portRef.current = null;
              reject(err);
            });
          }
        });

        if (response.type === 'ERROR') {
          setError(response.message);
          setStatus('error');
          return;
        }

        if (response.type !== 'MP_IMPORT_PAYLOAD') {
          setError('Unexpected response from extension');
          setStatus('error');
          return;
        }

        setStatus('importing');
        const result = await processMercadoPagoImport(
          db,
          accountId,
          { start: periodStart, end: periodEnd },
          response.pages,
          { todaySaoPaulo: todaySaoPauloDate() },
        );
        setSummary(result);
        setStatus('done');
        notifyChange();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStatus('idle');
          setError(null);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
      } finally {
        importingRef.current = false;
        cancelWaitRef.current = null;
        portRef.current = null;
      }
    },
    [extensionId, db, notifyChange],
  );

  return { status, summary, error, startImport, cancel };
}
