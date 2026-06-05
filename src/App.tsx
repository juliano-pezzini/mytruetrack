import { RouterProvider } from 'react-router-dom';
import { DatabaseProvider } from './app/database-provider.tsx';
import { router } from './app/router.tsx';

export function App() {
  return (
    <DatabaseProvider>
      <RouterProvider router={router} />
    </DatabaseProvider>
  );
}
