/**
 * Active-provider resolver — builds a CloudProvider from the persisted SyncConfig.
 *
 * Centralizes the provider-construction and Google token-refresh logic so both the
 * manual Settings UI (SyncSection) and the auto-sync controller share one source of
 * truth. Pure async function: no React, no IndexedDB persistence. When a Google token
 * is silently refreshed, the (updated) config is returned for the caller to persist.
 */

import type { CloudProvider } from './cloud-provider.ts';
import type { SyncConfig } from './sync-config.ts';
import { createWebDavProvider } from './providers/webdav-provider.ts';
import { createGoogleDriveProvider } from './providers/google-drive-provider.ts';
import { ensureValidGoogleTokens } from './providers/google-auth-flow.ts';

export type ResolvedProvider =
  /** No cloud provider configured — sync should be skipped. */
  | { readonly kind: 'none' }
  /** Usable provider. `config` may carry refreshed Google tokens to persist. */
  | { readonly kind: 'ok'; readonly provider: CloudProvider; readonly config: SyncConfig }
  /** Google session expired; an interactive reconnect is required. */
  | { readonly kind: 'reconnect' };

/**
 * Resolve the active cloud provider from a SyncConfig, refreshing Google tokens
 * silently when needed.
 */
export async function resolveActiveProvider(config: SyncConfig): Promise<ResolvedProvider> {
  if (config.provider === 'webdav' && config.webdav) {
    return { kind: 'ok', provider: createWebDavProvider(config.webdav), config };
  }

  if (config.provider === 'google-drive') {
    if (!config.google) return { kind: 'none' };

    const valid = await ensureValidGoogleTokens(config.google);
    if (!valid) return { kind: 'reconnect' };

    const nextConfig: SyncConfig =
      valid.accessToken !== config.google.accessToken ? { ...config, google: valid } : config;

    return {
      kind: 'ok',
      provider: createGoogleDriveProvider(valid.accessToken),
      config: nextConfig,
    };
  }

  return { kind: 'none' };
}
