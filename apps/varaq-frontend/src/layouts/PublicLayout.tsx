import { Outlet } from 'react-router-dom';
import { SiteHeader, Topbar } from '../components/navigation/SiteHeader';
import { CollectionsProvider } from '../features/collections/CollectionsContext';
import { PersonaGate } from '@/auth/PersonaSetup';
import { useState } from 'react';

export function PublicLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <PersonaGate>
      <CollectionsProvider>
        <div className={`varaq-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
          <SiteHeader
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
          <main className="main-shell">
            <Topbar />
            <Outlet />
          </main>
        </div>
      </CollectionsProvider>
    </PersonaGate>
  );
}
