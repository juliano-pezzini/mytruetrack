import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  detectBrowserId,
  generateDefaultDeviceLabel,
  getDeviceLabel,
  setDeviceLabel,
  clearDeviceLabel,
} from './device-identity.ts';

describe('device-identity', () => {
  beforeEach(async () => {
    await clearDeviceLabel();
  });

  it('detectBrowserId and generateDefaultDeviceLabel return non-empty values', () => {
    expect(detectBrowserId().length).toBeGreaterThan(0);
    expect(generateDefaultDeviceLabel().length).toBeGreaterThan(0);
  });

  it('getDeviceLabel returns default when no custom label is stored', async () => {
    const label = await getDeviceLabel();
    expect(label).toBe(generateDefaultDeviceLabel());
  });

  it('setDeviceLabel persists and getDeviceLabel returns it after reload', async () => {
    await setDeviceLabel('  Samsung S24  ');
    expect(await getDeviceLabel()).toBe('Samsung S24');

    // Simulate reload: read again from IDB
    expect(await getDeviceLabel()).toBe('Samsung S24');
  });

  it('setDeviceLabel rejects empty and over-64 labels', async () => {
    await expect(setDeviceLabel('   ')).rejects.toThrow(/empty/i);
    await expect(setDeviceLabel('x'.repeat(65))).rejects.toThrow(/64/i);
  });
});
