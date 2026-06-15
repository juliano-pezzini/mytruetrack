import { RouterProvider } from 'react-router-dom';
import { DatabaseProvider } from './app/database-provider.tsx';
import { VaultProvider } from './app/vault-provider.tsx';
import { VaultGate } from './app/vault-gate.tsx';
import { AutoSyncProvider } from './app/auto-sync-provider.tsx';
import { router } from './app/router.tsx';

export function App() {
  return (
    <VaultProvider>
      <VaultGate>
        <DatabaseProvider>
          <AutoSyncProvider>
            <RouterProvider router={router} />
          </AutoSyncProvider>
        </DatabaseProvider>
      </VaultGate>
    </VaultProvider>
  );
}
