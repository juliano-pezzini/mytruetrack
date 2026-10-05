/**
 * Setup storage-choice policy: which vault actions a probe (or this-device-only) allows.
 */

import type { RemoteVaultStatus } from './vault-metadata.ts';
import { loadSyncConfig, saveSyncConfig } from './sync-config.ts';

export type StorageChoice = 'google-drive' | 'webdav' | 'local-only';

export type VaultActionProbe = RemoteVaultStatus | { readonly kind: 'local-only' };

export type VaultActions = {
  readonly create: boolean;
  readonly restore: boolean;
  readonly skip: boolean;
};

const CREATE_AND_SKIP: VaultActions = { create: true, restore: false, skip: true };
const RESTORE_ONLY: VaultActions = { create: false, restore: true, skip: false };
const BLOCKED: VaultActions = { create: false, restore: false, skip: false };

/** Which setup buttons are enabled for a probe result or this-device-only. */
export function vaultActionsForProbe(status: VaultActionProbe): VaultActions {
  switch (status.kind) {
    case 'local-only':
    case 'empty':
      return CREATE_AND_SKIP;
    case 'ready':
      return RESTORE_ONLY;
    case 'legacy':
    case 'corrupt':
      return BLOCKED;
  }
}

export type InferStorageChoiceInput = {
  readonly storageChoice?: StorageChoice | null;
  readonly provider: 'google-drive' | 'webdav' | null;
};

export type InferStorageChoiceContext = {
  readonly hasVault: boolean;
  readonly skipped: boolean;
};

/** Resolve freeze for origins that predate `storageChoice` (SSF-12). */
export function inferStorageChoice(
  config: InferStorageChoiceInput,
  ctx: InferStorageChoiceContext,
): StorageChoice | null {
  if (config.storageChoice) return config.storageChoice;
  if (config.provider === 'google-drive' || config.provider === 'webdav') return config.provider;
  if (ctx.hasVault || ctx.skipped) return 'local-only';
  return null;
}

/** Record the setup freeze without dropping provider tokens. */
export async function freezeStorageChoice(choice: StorageChoice): Promise<void> {
  const config = await loadSyncConfig();
  await saveSyncConfig({ ...config, storageChoice: choice });
}

/**
 * Write inferred freeze for existing origins. No-op when setup is incomplete
 * or the stored choice already matches.
 */
export async function persistInferredStorageChoice(
  ctx: InferStorageChoiceContext,
): Promise<StorageChoice | null> {
  const config = await loadSyncConfig();
  const inferred = inferStorageChoice(config, ctx);
  if (inferred === null) return null;
  if (config.storageChoice === inferred) return inferred;
  await saveSyncConfig({ ...config, storageChoice: inferred });
  return inferred;
}
