/**
 * Cloud vault metadata — portable wrapped DEK + device registry in the sync folder.
 */

export const VAULT_METADATA_FILENAME = 'vault-metadata.json';

export type VaultDeviceEntry = {
  readonly label: string;
  readonly browser: string;
  readonly lastSeenAt: string;
};

export type VaultMetadata = {
  readonly version: 1;
  readonly wrappedDek: string;
  readonly salt: string;
  readonly iterations: number;
  readonly devices: Readonly<Record<string, VaultDeviceEntry>>;
};

export type RemoteVaultStatus =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ready'; readonly metadata: VaultMetadata }
  | { readonly kind: 'legacy'; readonly segmentCount: number }
  | { readonly kind: 'corrupt'; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDeviceEntry(value: unknown, siteId: string): VaultDeviceEntry {
  if (!isRecord(value)) {
    throw new Error(`devices[${siteId}] must be an object`);
  }
  const { label, browser, lastSeenAt } = value;
  if (typeof label !== 'string' || label.length === 0) {
    throw new Error(`devices[${siteId}].label is required`);
  }
  if (typeof browser !== 'string' || browser.length === 0) {
    throw new Error(`devices[${siteId}].browser is required`);
  }
  if (typeof lastSeenAt !== 'string' || lastSeenAt.length === 0) {
    throw new Error(`devices[${siteId}].lastSeenAt is required`);
  }
  return { label, browser, lastSeenAt };
}

/** Parse and validate vault metadata JSON bytes. */
export function parseVaultMetadata(bytes: Uint8Array): VaultMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Vault metadata is not valid JSON');
  }
  if (!isRecord(parsed)) {
    throw new Error('Vault metadata must be a JSON object');
  }
  if (parsed.version !== 1) {
    throw new Error('Vault metadata version must be 1');
  }
  if (typeof parsed.wrappedDek !== 'string' || parsed.wrappedDek.length === 0) {
    throw new Error('Vault metadata wrappedDek is required');
  }
  if (typeof parsed.salt !== 'string' || parsed.salt.length === 0) {
    throw new Error('Vault metadata salt is required');
  }
  if (typeof parsed.iterations !== 'number' || !Number.isFinite(parsed.iterations)) {
    throw new Error('Vault metadata iterations is required');
  }
  if (!isRecord(parsed.devices)) {
    throw new Error('Vault metadata devices must be an object');
  }
  const devices: Record<string, VaultDeviceEntry> = {};
  for (const [siteId, entry] of Object.entries(parsed.devices)) {
    devices[siteId] = parseDeviceEntry(entry, siteId);
  }
  return {
    version: 1,
    wrappedDek: parsed.wrappedDek,
    salt: parsed.salt,
    iterations: parsed.iterations,
    devices,
  };
}

/** Serialize vault metadata to UTF-8 JSON bytes. */
export function serializeVaultMetadata(meta: VaultMetadata): Uint8Array {
  const payload = {
    version: meta.version,
    wrappedDek: meta.wrappedDek,
    salt: meta.salt,
    iterations: meta.iterations,
    devices: meta.devices,
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}
