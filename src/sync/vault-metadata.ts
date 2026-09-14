/**
 * Cloud vault metadata — portable wrapped DEK + device registry in the sync folder.
 */

import type { CloudProvider } from './cloud-provider.ts';
import type { KeyData } from '../crypto/key-store.ts';

export const VAULT_METADATA_FILENAME = 'vault-metadata.json';

const CHANGES_SEGMENT_RE = /^changes-[0-9a-f]+-\d+\.bin$/;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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

function countChangeSegments(files: readonly { readonly name: string }[]): number {
  let count = 0;
  for (const file of files) {
    if (CHANGES_SEGMENT_RE.test(file.name)) count += 1;
  }
  return count;
}

/** Classify remote vault state from provider folder listing. */
export async function probeRemoteVault(provider: CloudProvider): Promise<RemoteVaultStatus> {
  const files = await provider.list();
  const hasMetadata = files.some((f) => f.name === VAULT_METADATA_FILENAME);
  if (hasMetadata) {
    const raw = await provider.download(VAULT_METADATA_FILENAME);
    if (!raw) {
      return { kind: 'corrupt', reason: 'Vault metadata file is missing on download' };
    }
    try {
      const metadata = parseVaultMetadata(raw);
      return { kind: 'ready', metadata };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { kind: 'corrupt', reason };
    }
  }
  const segmentCount = countChangeSegments(files);
  if (segmentCount >= 1) {
    return { kind: 'legacy', segmentCount };
  }
  return { kind: 'empty' };
}

/** Delete remote vault metadata when present. Returns true if a file was removed. */
export async function deleteVaultMetadata(provider: CloudProvider): Promise<boolean> {
  const files = await provider.list();
  if (!files.some((f) => f.name === VAULT_METADATA_FILENAME)) {
    return false;
  }
  await provider.delete(VAULT_METADATA_FILENAME);
  return true;
}

export type UpsertVaultMetadataArgs = {
  readonly siteId: string;
  readonly keyData: KeyData;
  readonly label: string;
  readonly browser: string;
};

/** Download-merge-upload vault metadata (create when absent). */
export async function upsertVaultMetadata(
  provider: CloudProvider,
  args: UpsertVaultMetadataArgs,
): Promise<void> {
  const { siteId, keyData, label, browser } = args;
  const lastSeenAt = new Date().toISOString();

  let existing: VaultMetadata | null = null;
  const raw = await provider.download(VAULT_METADATA_FILENAME);
  if (raw) {
    existing = parseVaultMetadata(raw);
  }

  const devices: Record<string, VaultDeviceEntry> = existing ? { ...existing.devices } : {};
  devices[siteId] = { label, browser, lastSeenAt };

  const meta: VaultMetadata = {
    version: 1,
    wrappedDek: bytesToBase64(keyData.wrappedDek),
    salt: bytesToBase64(keyData.salt),
    iterations: keyData.iterations,
    devices,
  };

  await provider.upload(VAULT_METADATA_FILENAME, serializeVaultMetadata(meta));
}

/** Download remote metadata for restore or display. */
export async function downloadVaultMetadata(provider: CloudProvider): Promise<VaultMetadata> {
  const raw = await provider.download(VAULT_METADATA_FILENAME);
  if (!raw) {
    throw new Error('Vault metadata is not present on the cloud provider');
  }
  return parseVaultMetadata(raw);
}
