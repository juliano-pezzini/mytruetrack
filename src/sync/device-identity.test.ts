import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDB } from 'idb';
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

  it('falls back to the default label when the stored value is blank or not a string', async () => {
    await clearDeviceLabel();
    const db = await openDB('mytruetrack-sync-state', 1);
    await db.put('state', '   ', 'device-label');
    expect(await getDeviceLabel()).toBe(generateDefaultDeviceLabel());

    await db.put('state', 1, 'device-label');
    expect(await getDeviceLabel()).toBe(generateDefaultDeviceLabel());
  });

  describe('browser and platform detection', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function stubNavigator(nav: Record<string, unknown> | undefined): void {
      vi.stubGlobal('navigator', nav);
    }

    it('reads the browser from userAgentData brands', () => {
      const cases: Array<[string, string]> = [
        ['Google Chrome', 'chrome'],
        ['Microsoft Edge', 'edge'],
        ['Firefox', 'firefox'],
        ['Safari', 'safari'],
        ['Opera GX', 'opera-gx'],
      ];
      for (const [brand, id] of cases) {
        stubNavigator({
          userAgent: '',
          platform: 'TestOS',
          userAgentData: { brands: [{ brand }], platform: 'TestOS' },
        });
        expect(detectBrowserId()).toBe(id);
        expect(generateDefaultDeviceLabel()).toBe(
          `${id.charAt(0).toUpperCase()}${id.slice(1)} · TestOS`,
        );
      }
    });

    it('reads the browser from the user agent when brand data is missing', () => {
      const cases: Array<[string, string]> = [
        ['Mozilla/5.0 Edg/120.0', 'edge'],
        ['Mozilla/5.0 Firefox/120.0', 'firefox'],
        ['Mozilla/5.0 Chrome/120.0', 'chrome'],
        ['Mozilla/5.0 Safari/17.0', 'safari'],
        ['SomeAgent/1.0', 'unknown'],
      ];
      for (const [userAgent, id] of cases) {
        stubNavigator({ userAgent, platform: 'TestOS', userAgentData: { brands: [] } });
        expect(detectBrowserId()).toBe(id);
      }
    });

    it('reads the platform from the user agent when no platform string is set', () => {
      const cases: Array<[string, string]> = [
        ['Mozilla/5.0 (Linux; Android 14)', 'Android'],
        ['Mozilla/5.0 (iPhone; CPU iPhone OS 17)', 'iOS'],
        ['Mozilla/5.0 (iPad)', 'iOS'],
        ['Mozilla/5.0 (Macintosh)', 'macOS'],
        ['Mozilla/5.0 (Windows NT 10.0)', 'Windows'],
        ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux'],
        ['SomeAgent/1.0', 'Unknown'],
      ];
      for (const [userAgent, platform] of cases) {
        stubNavigator({ userAgent, platform: '' });
        expect(generateDefaultDeviceLabel()).toBe(`Browser · ${platform}`);
      }
    });

    it('returns unknown identifiers when navigator is missing', () => {
      stubNavigator(undefined);
      expect(detectBrowserId()).toBe('unknown');
      expect(generateDefaultDeviceLabel()).toBe('Browser · Unknown');
    });
  });
});
