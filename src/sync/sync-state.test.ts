import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getSyncState, savePushState, savePullState, clearSyncState } from './sync-state.ts';

describe('sync-state', () => {
  beforeEach(async () => {
    await clearSyncState();
  });

  it('returns defaults when never synced', async () => {
    const state = await getSyncState();
    expect(state.lastPushedVersion).toBe(0);
    expect(state.lastPushedAt).toBeNull();
    expect(state.lastPulledAt).toBeNull();
  });

  it('saves and retrieves push state', async () => {
    await savePushState(42);

    const state = await getSyncState();
    expect(state.lastPushedVersion).toBe(42);
    expect(state.lastPushedAt).not.toBeNull();
    expect(state.lastPulledAt).toBeNull();
  });

  it('saves and retrieves pull state', async () => {
    await savePullState();

    const state = await getSyncState();
    expect(state.lastPulledAt).not.toBeNull();
    expect(state.lastPushedVersion).toBe(0); // push not touched
  });

  it('preserves push state when saving pull', async () => {
    await savePushState(10);
    await savePullState();

    const state = await getSyncState();
    expect(state.lastPushedVersion).toBe(10);
    expect(state.lastPushedAt).not.toBeNull();
    expect(state.lastPulledAt).not.toBeNull();
  });

  it('clearSyncState resets to defaults', async () => {
    await savePushState(99);
    await savePullState();
    await clearSyncState();

    const state = await getSyncState();
    expect(state.lastPushedVersion).toBe(0);
    expect(state.lastPushedAt).toBeNull();
    expect(state.lastPulledAt).toBeNull();
  });

  it('overwrites push version on subsequent saves', async () => {
    await savePushState(1);
    await savePushState(5);

    const state = await getSyncState();
    expect(state.lastPushedVersion).toBe(5);
  });
});
