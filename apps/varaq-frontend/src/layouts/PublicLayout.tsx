import { Outlet } from 'react-router-dom';
import { SiteHeader } from '../components/navigation/SiteHeader';

export function PublicLayout() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}