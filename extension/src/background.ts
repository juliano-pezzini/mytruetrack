import { refreshToken, fetchTransactions } from './investpass-api.ts';
import { fetchBinnaclePeriod } from './mercado-pago-api.ts';

// Keep in step with extension/manifest.json externally_connectable.matches.
const EXTENSION_VERSION = '0.1.0';
const MERCADO_PAGO_HOME = 'https://www.mercadopago.com.br/';

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.hostname === 'localhost') {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  const githubPages = url.hostname === 'github.io' || url.hostname.endsWith('.github.io');
  return githubPages && url.protocol === 'https:';
}

type BridgeMessage =
  | { type: 'PING' }
  | { type: 'START_IMPORT'; periodStart: string; periodEnd: string }
  | { type: 'START_MP_IMPORT'; periodStart: string; periodEnd: string };

async function openMercadoPagoHome(): Promise<void> {
  await chrome.tabs.create({ url: MERCADO_PAGO_HOME });
}

function handleConnection(port: chrome.runtime.Port): void {
  const senderOrigin = port.sender?.origin;

  if (!isOriginAllowed(senderOrigin)) {
    port.disconnect();
    return;
  }

  port.onMessage.addListener((msg: BridgeMessage) => {
    void handleMessage(port, msg);
  });
}

async function handleMessage(port: chrome.runtime.Port, msg: BridgeMessage): Promise<void> {
  try {
    switch (msg.type) {
      case 'PING':
        port.postMessage({ type: 'PONG', extensionVersion: EXTENSION_VERSION });
        break;

      case 'START_IMPORT': {
        const token = await refreshToken();
        const transactions = await fetchTransactions(token, msg.periodStart, msg.periodEnd);
        port.postMessage({ type: 'IMPORT_PAYLOAD', transactions });
        break;
      }

      case 'START_MP_IMPORT': {
        const result = await fetchBinnaclePeriod(msg.periodStart, msg.periodEnd);
        if ('sessionMissing' in result) {
          await openMercadoPagoHome();
          port.postMessage({ type: 'MP_SESSION_MISSING' });
          break;
        }
        if ('pageFailure' in result) {
          port.postMessage({
            type: 'ERROR',
            code: 'MP_PAGE_FAILED',
            message: result.message,
          });
          break;
        }
        port.postMessage({ type: 'MP_IMPORT_PAYLOAD', pages: result.pages });
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    port.postMessage({ type: 'ERROR', code: 'IMPORT_FAILED', message });
  }
}

chrome.runtime.onConnectExternal.addListener(handleConnection);

export { isOriginAllowed, handleConnection, handleMessage, openMercadoPagoHome };
