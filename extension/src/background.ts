import { refreshToken, fetchTransactions } from './investpass-api.ts';

// TODO(P2): Add the production PWA origin once deployed (e.g. 'https://mytruetrack.app').
// For P1 MVP, the PWA runs on localhost only.
const ALLOWED_ORIGINS = ['http://localhost', 'https://localhost'];
const EXTENSION_VERSION = '0.1.0';

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const base = `${url.protocol}//${url.hostname}`;
    return ALLOWED_ORIGINS.includes(base);
  } catch {
    return false;
  }
}

type BridgeMessage =
  | { type: 'PING' }
  | { type: 'START_IMPORT'; periodStart: string; periodEnd: string };

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

async function handleMessage(
  port: chrome.runtime.Port,
  msg: BridgeMessage,
): Promise<void> {
  try {
    switch (msg.type) {
      case 'PING':
        port.postMessage({ type: 'PONG', extensionVersion: EXTENSION_VERSION });
        break;

      case 'START_IMPORT': {
        const token = await refreshToken();
        const transactions = await fetchTransactions(
          token,
          msg.periodStart,
          msg.periodEnd,
        );
        port.postMessage({ type: 'IMPORT_PAYLOAD', transactions });
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    port.postMessage({ type: 'ERROR', code: 'IMPORT_FAILED', message });
  }
}

chrome.runtime.onConnectExternal.addListener(handleConnection);

export { isOriginAllowed, handleConnection, handleMessage };
