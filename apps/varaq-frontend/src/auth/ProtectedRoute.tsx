import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { LoadingState } from '@/components/ui/LoadingState';

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <LoadingState
        variant="page"
        label="Opening your account…"
        detail="Your pages are finding their way back to you."
      />
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;

    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
