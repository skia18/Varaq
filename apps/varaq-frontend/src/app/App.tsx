import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { VaultProvider } from '@/features/vault/VaultProvider';
import { router } from './router';

export function App() {
  return (
    <AuthProvider>
      <VaultProvider>
        <RouterProvider router={router} />
      </VaultProvider>
    </AuthProvider>
  );
}
