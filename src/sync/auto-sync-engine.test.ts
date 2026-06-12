import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutoSyncController, type AutoSyncStatus } from './auto-sync-engine.ts';
import type { CloudProvider } from './cloud-provider.ts';

const fakeProvider = {} as CloudProvider;

/** A promise whose resolution/rejection can be controlled by the test. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createAutoSyncController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces a single push after the window elapses', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push,
      pull: vi.fn(),
      debounceMs: 5000,
      onError: vi.fn(),
    });

    c.notifyChange();
    expect(push).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(fakeProvider);
  });

  it('coalesces rapid writes into a single push', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push,
      pull: vi.fn(),
      debounceMs: 5000,
      onError: vi.fn(),
    });

    c.notifyChange();
    await vi.advanceTimersByTimeAsync(2000);
    c.notifyChange();
    await vi.advanceTimersByTimeAsync(2000);
    c.notifyChange();
    await vi.advanceTimersByTimeAsync(5000);

    expect(push).toHaveBeenCalledTimes(1);
  });

  it('skips push when no provider is configured', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const c = createAutoSyncController({
      getProvider: async () => null,
      push,
      pull: vi.fn(),
      debounceMs: 5000,
      onError: vi.fn(),
    });

    c.notifyChange();
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).not.toHaveBeenCalled();
  });

  it('pulls on load when a provider is configured', async () => {
    const pull = vi.fn().mockResolvedValue(undefined);
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push: vi.fn(),
      pull,
      onError: vi.fn(),
    });

    await c.pullOnLoad();
    expect(pull).toHaveBeenCalledWith(fakeProvider);
  });

  it('no-ops pull on load when no provider is configured', async () => {
    const pull = vi.fn();
    const c = createAutoSyncController({
      getProvider: async () => null,
      push: vi.fn(),
      pull,
      onError: vi.fn(),
    });

    await c.pullOnLoad();
    expect(pull).not.toHaveBeenCalled();
  });

  it('swallows pull-on-load errors and reports them', async () => {
    const onError = vi.fn();
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push: vi.fn(),
      pull: vi.fn().mockRejectedValue(new Error('boom')),
      onError,
    });

    await expect(c.pullOnLoad()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalled();
    expect(c.getStatus()).toBe('idle');
  });

  it('marks pending and retries on retryPending after a failed push', async () => {
    const push = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const statuses: AutoSyncStatus[] = [];
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push,
      pull: vi.fn(),
      debounceMs: 5000,
      onStatusChange: (s) => statuses.push(s),
      onError: vi.fn(),
    });

    c.notifyChange();
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(c.getStatus()).toBe('pending');

    c.retryPending();
    await vi.advanceTimersByTimeAsync(0);
    expect(push).toHaveBeenCalledTimes(2);
    expect(c.getStatus()).toBe('idle');
    expect(statuses).toContain('syncing');
    expect(statuses).toContain('pending');
  });

  it('retryPending is a no-op when nothing is pending', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push,
      pull: vi.fn(),
      onError: vi.fn(),
    });

    c.retryPending();
    await vi.advanceTimersByTimeAsync(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('schedules a follow-up push when a write arrives during an in-flight push', async () => {
    const first = deferred();
    const push = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(undefined);
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push,
      pull: vi.fn(),
      debounceMs: 5000,
      onError: vi.fn(),
    });

    // Start the first push.
    c.notifyChange();
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledTimes(1);
    expect(c.getStatus()).toBe('syncing');

    // A write lands mid-flight; its debounce fires while push #1 is still pending.
    c.notifyChange();
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledTimes(1); // still only the first

    // Resolve push #1 → the follow-up push should run.
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('dispose cancels a pending debounced push', async () => {
    const push = vi.fn().mockResolvedValue(undefined);
    const c = createAutoSyncController({
      getProvider: async () => fakeProvider,
      push,
      pull: vi.fn(),
      debounceMs: 5000,
      onError: vi.fn(),
    });

    c.notifyChange();
    c.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).not.toHaveBeenCalled();
  });
});
