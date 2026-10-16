import { Outlet } from 'react-router-dom';
import { SiteHeader, Topbar } from '../components/navigation/SiteHeader';
import { SavedPagesProvider } from '../features/saved/SavedPagesContext';

export function PublicLayout() {
  return (
    <SavedPagesProvider>
      <div className="varaq-shell">
        <SiteHeader />
        <main className="main-shell">
          <Topbar />
          <Outlet />
        </main>
      </div>
    </SavedPagesProvider>
  );
}
