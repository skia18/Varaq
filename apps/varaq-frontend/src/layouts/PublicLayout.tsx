import { Outlet } from 'react-router-dom';
import { SiteHeader, Topbar } from '../components/navigation/SiteHeader';

export function PublicLayout() {
  return (
    <div className="varaq-shell">
      <SiteHeader />

      <main className="main-shell">
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}
