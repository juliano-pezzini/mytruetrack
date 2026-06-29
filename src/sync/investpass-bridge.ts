/**
 * PWA-side bridge client for communicating with the InvestPass companion
 * Chrome extension via chrome.runtime.connect (externally_connectable).
 */

import type { InvestPassTransaction } from '../workers/investpass-types.ts';
import type { InvestPassImportResult } from '../workers/investpass-types.ts';

// ── Minimal Chrome types (avoids hard dependency on @types/chrome at compile time) ─

type ChromePort = {
  postMessage(message: unknown): void;
  onMessage: { addListener(cb: (message: BridgeMessage) => void): void };
  disconnect(): void;
};

type ChromeRuntime = {
  connect(extensionId: string): ChromePort;
};

type ChromeGlobal = {
  chrome?: { runtime?: ChromeRuntime };
};

// ── Message types ──────────────────────────────────────────────────────

export type BridgeMessage =
  | { type: 'PING' }
  | { type: 'PONG'; extensionVersion: string }
  | { type: 'START_IMPORT'; periodStart: string; periodEnd: string }
  | { type: 'IMPORT_PAYLOAD'; transactions: InvestPassTransaction[] }
  | { type: 'IMPORT_RESULT'; summary: InvestPassImportResult }
  | { type: 'ERROR'; code: string; message: string };

// ── Port wrapper ───────────────────────────────────────────────────────

export type InvestPassPort = {
  /** Send a message to the extension. */
  send(message: BridgeMessage): void;
  /** Register a handler for incoming messages. */
  onMessage(handler: (message: BridgeMessage) => void): void;
  /** Disconnect the port. */
  disconnect(): void;
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Connect to the InvestPass extension and return a typed port wrapper.
 * Returns null if chrome.runtime is unavailable (extension not installed).
 */
export function connectToExtension(extensionId: string): InvestPassPort | null {
  const runtime = (globalThis as ChromeGlobal).chrome?.runtime;
  if (!runtime?.connect) return null;

  let port: ChromePort;
  try {
    port = runtime.connect(extensionId);
  } catch {
    return null;
  }

  return {
    send(message: BridgeMessage) {
      port.postMessage(message);
    },
    onMessage(handler: (message: BridgeMessage) => void) {
      port.onMessage.addListener(handler);
    },
    disconnect() {
      port.disconnect();
    },
  };
}

const PING_TIMEOUT_MS = 2000;

/**
 * Check if the InvestPass extension is available by attempting a PING/PONG
 * handshake with a timeout.
 */
export async function isExtensionAvailable(extensionId: string): Promise<boolean> {
  const port = connectToExtension(extensionId);
  if (!port) return false;

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      port.disconnect();
      resolve(false);
    }, PING_TIMEOUT_MS);

    port.onMessage((msg) => {
      if (msg.type === 'PONG') {
        clearTimeout(timer);
        port.disconnect();
        resolve(true);
      }
    });

    port.send({ type: 'PING' });
  });
}
