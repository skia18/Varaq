import { useEffect, useState } from 'react';
import {
  BookOpen,
  Feather,
  Library,
  LockKeyhole,
  LogIn,
  LogOut,
  Search,
  UserRound,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import varaqMark from '@/assets/varaq-mark.png';
import { useAuth } from '@/auth/AuthProvider';
import { useVault } from '@/features/vault/VaultProvider';
import { LoadingLabel } from '@/components/ui/LoadingState';
import { SearchDialog } from './SearchDialog';

const dockSpring = { type: 'spring', stiffness: 420, damping: 34 } as const;

function Brand() {
  return (
    <Link to="/" className="dock-brand" aria-label="Varaq home">
      <img src={varaqMark} alt="" width={1024} height={1024} />
      <span>varaq</span>
      <small lang="ur">ورق</small>
    </Link>
  );
}

export function FloatingDock() {
  const { lock } = useVault();
  const { user, persona, isLoading, isPersonaLoading, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const navigation = [
    { label: 'The commons', shortLabel: 'Commons', to: '/', icon: BookOpen, end: true },
    { label: 'Collections', shortLabel: 'Collections', to: '/collections', icon: Library },
    ...(user && persona
      ? [
          {
            label: 'My Wall',
            shortLabel: 'Wall',
            to: `/wall/${encodeURIComponent(persona.handle)}`,
            icon: UserRound,
          },
        ]
      : []),
    ...(user
      ? [
          {
            label: 'My Vault',
            shortLabel: 'Vault',
            to: '/vault',
            icon: LockKeyhole,
          },
        ]
      : []),
  ];

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    setSignOutError(null);
    lock();

    try {
      await signOut();
      setAccountMenuOpen(false);
      void navigate('/', { replace: true });
    } catch {
      setSignOutError('Could not sign out. Please try again.');
    }
  }

  return (
    <>
      <div className="floating-dock-frame">
        <motion.header
          className="floating-dock"
          aria-label="Varaq navigation"
          initial={reduceMotion ? false : { opacity: 0, y: -24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={dockSpring}
        >
          <Brand />

          <LayoutGroup id="primary-navigation">
            <nav className="dock-navigation" aria-label="Main navigation">
              {navigation.map(({ label, shortLabel, to, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  aria-label={label}
                  title={label}
                  className={({ isActive }) => `dock-link${isActive ? ' is-active' : ''}`}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          className="dock-active-pill"
                          layoutId="dock-active-pill"
                          transition={reduceMotion ? { duration: 0 } : dockSpring}
                        />
                      )}
                      <Icon aria-hidden="true" />
                      <span>{shortLabel}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </LayoutGroup>

          <div className="dock-actions">
            <button
              type="button"
              className="dock-icon-button"
              aria-label="Search writing"
              title="Search writing"
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden="true" />
            </button>

            <div className="dock-account">
              <button
                type="button"
                className={`dock-icon-button${accountMenuOpen ? ' is-active' : ''}`}
                aria-label="Account menu"
                title="Account"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <UserRound aria-hidden="true" />
              </button>

              <AnimatePresence>
                {accountMenuOpen && (
                  <motion.div
                    role="menu"
                    aria-label="Account menu"
                    className="dock-account-menu"
                    initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                  >
                    {isLoading ? (
                      <p className="dock-menu-status">
                        <LoadingLabel>Loading account</LoadingLabel>
                      </p>
                    ) : user ? (
                      <>
                        <div className="dock-account-summary">
                          <span className="avatar-mark">
                            {(persona?.displayName?.[0] ?? user.email?.[0] ?? 'v').toLowerCase()}
                          </span>
                          <span>
                            <strong>{persona?.displayName ?? user.email ?? 'Your account'}</strong>
                            <small>
                              {isPersonaLoading ? (
                                <LoadingLabel>Loading profile</LoadingLabel>
                              ) : persona ? (
                                `@${persona.handle}`
                              ) : (
                                'No public profile yet'
                              )}
                            </small>
                          </span>
                        </div>

                        {persona && (
                          <Link to={`/wall/${encodeURIComponent(persona.handle)}`} role="menuitem">
                            <UserRound aria-hidden="true" /> My Wall
                          </Link>
                        )}
                        <Link to="/vault" role="menuitem">
                          <LockKeyhole aria-hidden="true" /> My Vault
                        </Link>
                        <button type="button" role="menuitem" onClick={() => void handleSignOut()}>
                          <LogOut aria-hidden="true" /> Sign out
                        </button>
                        {signOutError && <p className="dock-menu-error">{signOutError}</p>}
                      </>
                    ) : (
                      <Link to="/login" role="menuitem">
                        <LogIn aria-hidden="true" /> Sign in
                      </Link>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/write" className="dock-write-button">
              <Feather aria-hidden="true" />
              <span>Leave a page</span>
            </Link>
          </div>
        </motion.header>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
