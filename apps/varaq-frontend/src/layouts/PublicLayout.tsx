import { Outlet } from 'react-router-dom';
import { SiteHeader, Topbar } from '../components/navigation/SiteHeader';
import { CollectionsProvider } from '../features/collections/CollectionsContext';
import { PersonaGate } from '@/auth/PersonaSetup';

export function PublicLayout() {
  return (
    <PersonaGate>
      <CollectionsProvider>
        <div className="varaq-shell">
          <SiteHeader />
          <main className="main-shell">
            <Topbar />
            <Outlet />
          </main>
        </div>
      </CollectionsProvider>
    </PersonaGate>
  );
}
