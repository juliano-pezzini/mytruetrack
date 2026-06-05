import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '../ui/components/Layout.tsx';
import { DashboardPage } from '../ui/pages/DashboardPage.tsx';
import { AccountsPage } from '../ui/pages/AccountsPage.tsx';
import { TransactionsPage } from '../ui/pages/TransactionsPage.tsx';
import { CategoriesPage } from '../ui/pages/CategoriesPage.tsx';
import { SettingsPage } from '../ui/pages/SettingsPage.tsx';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
