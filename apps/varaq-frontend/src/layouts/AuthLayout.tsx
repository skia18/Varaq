import { Outlet, useLocation } from 'react-router-dom';
import { PersonaGate } from '@/auth/PersonaSetup';
import { AccountScene } from './AccountScene';

export function AuthLayout() {
  const { pathname } = useLocation();
  const content = (
    <AccountScene>
      <Outlet />
    </AccountScene>
  );
  return pathname === '/login' || pathname === '/signup' ? (
    <PersonaGate>{content}</PersonaGate>
  ) : (
    content
  );
}
