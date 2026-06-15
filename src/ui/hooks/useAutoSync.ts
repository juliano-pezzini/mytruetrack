import { useContext } from 'react';
import { AutoSyncContext, type AutoSyncContextValue } from '../../app/auto-sync-provider.tsx';

/**
 * Access auto-sync status and the `notifyChange` trigger.
 *
 * Returns a safe no-op default when used outside an AutoSyncProvider (e.g. in
 * isolated hook/component unit tests), so callers never need to guard for it.
 */
export function useAutoSync(): AutoSyncContextValue {
  return useContext(AutoSyncContext);
}
