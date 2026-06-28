import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { connectToExtension, isExtensionAvailable } from './investpass-bridge.ts';
import type { BridgeMessage } from './investpass-bridge.ts';

// ── Chrome mock helpers ────────────────────────────────────────────────

type MessageListener = (message: BridgeMessage) => void;

function createMockPort() {
  const listeners: MessageListener[] = [];
  return {
    port: {
      postMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn((cb: MessageListener) => listeners.push(cb)),
      },
      disconnect: vi.fn(),
    },
    /** Simulate the extension sending a message back to the PWA. */
    simulateMessage(msg: BridgeMessage) {
      for (const cb of listeners) cb(msg);
    },
  };
}

function installChromeMock(mockPort: ReturnType<typeof createMockPort>['port']) {
  const g = globalThis as { chrome?: unknown };
  g.chrome = {
    runtime: {
      connect: vi.fn(() => mockPort),
    },
  };
}

function removeChromeMock() {
  const g = globalThis as { chrome?: unknown };
  delete g.chrome;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('investpass-bridge', () => {
  afterEach(() => {
    removeChromeMock();
    vi.restoreAllMocks();
  });

  describe('connectToExtension', () => {
    it('returns an InvestPassPort when chrome.runtime.connect succeeds', () => {
      const { port } = createMockPort();
      installChromeMock(port);

      const result = connectToExtension('test-ext-id');
      const g = globalThis as { chrome?: { runtime: { connect: ReturnType<typeof vi.fn> } } };

      expect(result).not.toBeNull();
      expect(g.chrome!.runtime.connect).toHaveBeenCalledWith('test-ext-id');
    });

    it('returns null when chrome.runtime is unavailable', () => {
      // No chrome mock installed
      const result = connectToExtension('test-ext-id');

      expect(result).toBeNull();
    });

    it('send() delegates to port.postMessage', () => {
      const { port } = createMockPort();
      installChromeMock(port);

      const wrapper = connectToExtension('test-ext-id')!;
      const msg: BridgeMessage = { type: 'PING' };
      wrapper.send(msg);

      expect(port.postMessage).toHaveBeenCalledWith(msg);
    });

    it('onMessage() delegates to port.onMessage.addListener', () => {
      const { port } = createMockPort();
      installChromeMock(port);

      const wrapper = connectToExtension('test-ext-id')!;
      const handler = vi.fn();
      wrapper.onMessage(handler);

      expect(port.onMessage.addListener).toHaveBeenCalledWith(handler);
    });
  });

  describe('isExtensionAvailable', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true when extension responds with PONG', async () => {
      const mock = createMockPort();
      installChromeMock(mock.port);

      const promise = isExtensionAvailable('test-ext-id');

      // Simulate the extension responding
      mock.simulateMessage({ type: 'PONG', extensionVersion: '0.1.0' });

      expect(await promise).toBe(true);
      expect(mock.port.disconnect).toHaveBeenCalled();
    });

    it('returns false on timeout (no PONG)', async () => {
      const mock = createMockPort();
      installChromeMock(mock.port);

      const promise = isExtensionAvailable('test-ext-id');

      // Advance past the timeout
      vi.advanceTimersByTime(2500);

      expect(await promise).toBe(false);
      expect(mock.port.disconnect).toHaveBeenCalled();
    });

    it('returns false when chrome.runtime is unavailable', async () => {
      // No chrome mock
      const result = await isExtensionAvailable('test-ext-id');
      expect(result).toBe(false);
    });

    it('sends a PING message to initiate the handshake', async () => {
      const mock = createMockPort();
      installChromeMock(mock.port);

      const promise = isExtensionAvailable('test-ext-id');
      mock.simulateMessage({ type: 'PONG', extensionVersion: '0.1.0' });

      await promise;

      expect(mock.port.postMessage).toHaveBeenCalledWith({ type: 'PING' });
    });
  });
});
