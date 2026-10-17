import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </main>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;

    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
