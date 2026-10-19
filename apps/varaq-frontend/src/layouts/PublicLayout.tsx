import { Outlet } from 'react-router-dom';
import { SiteHeader, Topbar } from '../components/navigation/SiteHeader';
import { CollectionsProvider } from '../features/collections/CollectionsContext';

export function PublicLayout() {
  return (
    <CollectionsProvider>
      <div className="varaq-shell">
        <SiteHeader />
        <main className="main-shell">
          <Topbar />
          <Outlet />
        </main>
      </div>
    </CollectionsProvider>
  );
}
