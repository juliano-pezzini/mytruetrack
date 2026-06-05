import type { ReactNode } from 'react';
import { useVault } from '../ui/hooks/useVault.ts';
import { SetupWizard } from '../ui/pages/SetupWizard.tsx';
import { UnlockPage } from '../ui/pages/UnlockPage.tsx';

export function VaultGate({ children }: { children: ReactNode }) {
  const { status } = useVault();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading…</p>
      </div>
    );
  }

  if (status === 'needs-setup') {
    return <SetupWizard />;
  }

  if (status === 'needs-unlock') {
    return <UnlockPage />;
  }

  return <>{children}</>;
}
