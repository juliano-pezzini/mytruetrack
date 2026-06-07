import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';
import { OfflineBanner } from './OfflineBanner.tsx';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/categories': 'Categories & Tags',
  '/settings': 'Settings',
};

export function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'mytruetrack';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <OfflineBanner />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
            <h1 className="text-lg font-semibold text-gray-900 pl-10 lg:pl-0">{title}</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
