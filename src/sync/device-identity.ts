/**
 * Local device display label for vault metadata registry entries.
 */

import { openDB } from 'idb';

const DB_NAME = 'mytruetrack-sync-state';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const DEVICE_LABEL_KEY = 'device-label';
const MAX_LABEL_LENGTH = 64;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

/** Coarse browser identifier from user agent signals. */
export function detectBrowserId(): string {
  const nav = globalThis.navigator;
  if (!nav) return 'unknown';

  const brands = (nav as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData?.brands;
  if (brands && brands.length > 0) {
    const name = brands[0]!.brand.toLowerCase();
    if (name.includes('chrome')) return 'chrome';
    if (name.includes('edge')) return 'edge';
    if (name.includes('firefox')) return 'firefox';
    if (name.includes('safari')) return 'safari';
    return name.replace(/\s+/g, '-');
  }

  const ua = nav.userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('chrome/')) return 'chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari';
  return 'unknown';
}

function detectPlatformLabel(): string {
  const nav = globalThis.navigator;
  if (!nav) return 'Unknown';

  const platform =
    (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    nav.platform;
  if (typeof platform === 'string' && platform.length > 0) {
    return platform;
  }

  const ua = nav.userAgent;
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac/i.test(ua)) return 'macOS';
  if (/win/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

/** Auto-generated label from browser + platform (non-empty). */
export function generateDefaultDeviceLabel(): string {
  const browser = detectBrowserId();
  const browserName =
    browser === 'unknown' ? 'Browser' : browser.charAt(0).toUpperCase() + browser.slice(1);
  const platform = detectPlatformLabel();
  return `${browserName} · ${platform}`;
}

/** Custom label if set, otherwise the default (never empty). */
export async function getDeviceLabel(): Promise<string> {
  const db = await getDb();
  const stored = await db.get(STORE_NAME, DEVICE_LABEL_KEY);
  if (typeof stored === 'string') {
    const trimmed = stored.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return generateDefaultDeviceLabel();
}

/** Persist a trimmed custom device label (1–64 chars). */
export async function setDeviceLabel(label: string): Promise<void> {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    throw new Error('Device label must not be empty');
  }
  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`Device label must be at most ${MAX_LABEL_LENGTH} characters`);
  }
  const db = await getDb();
  await db.put(STORE_NAME, trimmed, DEVICE_LABEL_KEY);
}

/** Remove a custom label so defaults apply again. */
export async function clearDeviceLabel(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, DEVICE_LABEL_KEY);
}
