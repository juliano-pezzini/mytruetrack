import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { OfflineBanner } from './OfflineBanner.tsx';
import { SyncStatusIndicator } from './SyncStatusIndicator.tsx';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/categories': 'Categories & Tags',
  '/settings': 'Settings',
  '/import/investpass': 'InvestPass Import',
};

export function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'mytruetrack';

  return (
    <div className="app-shell min-h-screen flex flex-col bg-mtt-bg">
      <OfflineBanner />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-mtt-surface border-b border-mtt-border flex items-center justify-between px-6 shrink-0">
            <h1 className="text-sm font-semibold text-mtt-fg pl-10 lg:pl-0 tracking-tight">
              {title}
            </h1>
            <SyncStatusIndicator />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
