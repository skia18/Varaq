
import { useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Library,
  Search,
  Sprout,
  UserRound,
  LogIn,
  LogOut,
  ChevronUp,
  RefreshCw,
  Feather,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { SearchDialog } from './SearchDialog';
import { useAuth } from '@/auth/AuthProvider';

const navigation = [
  { label: 'The commons', to: '/', icon: BookOpen, end: true },
  { label: 'Collections', to: '/collections', icon: Library },
  { label: 'Saved pages', to: '/saved', icon: Bookmark },
  { label: 'My wall', to: '/wall/you', icon: UserRound },
];

export function SiteHeader() {
  const {
    user,
    persona,
    isLoading,
    isPersonaLoading,
    personaError,
    refreshPersona,
    signOut,
  } = useAuth();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSignOut() {
    setSignOutError(null);

    try {
      await signOut();
      setProfileMenuOpen(false);
      navigate('/', { replace: true });
    } catch {
      setSignOutError('Could not sign out. Please try again.');
    }
  }

  return (
    <aside className="sidebar">
      <div>
        <Link to="/" className="brand" aria-label="Varaq home">
          <span className="brand-name">varaq</span>
          <span className="brand-urdu" lang="ur">
            ورق
          </span>
        </Link>

        <p className="brand-caption">a place for your words.</p>
      </div>

      <nav className="side-navigation" aria-label="Main navigation">
        {navigation.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-section">
        <p className="eyebrow">Your little shelves</p>

        <Link to="/collections" className="side-collection">
          <span className="collection-dot red" />
          Things that linger
        </Link>

        <Link to="/collections" className="side-collection">
          <span className="collection-dot sage" />
          Between the lines
        </Link>

        <Link to="/collections" className="side-collection">
          <span className="collection-dot" />
          Rainy day reading
        </Link>
      </div>

      <div className="side-note">
        <p>
          Some things are better
          <br />
          left on a page.
        </p>
        <Sprout aria-hidden="true" />
      </div>

      <div className="relative mt-auto">
        {isLoading ? (
          <div className="side-user" aria-label="Loading account">
            <span className="avatar-mark">·</span>
            <span>
              <strong>One moment</strong>
              <small>Loading your account…</small>
            </span>
          </div>
        ) : user ? (
          <>
            <button
              type="button"
              className="side-user w-full text-left"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Open account menu"
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <span className="avatar-mark">
                {(
                  persona?.displayName?.[0] ??
                  user.email?.[0] ??
                  'v'
                ).toLowerCase()}
              </span>

              <span className="min-w-0 flex-1">
                <strong className="block truncate">
                  {isPersonaLoading
                    ? 'Loading persona…'
                    : (persona?.displayName ?? 'Your profile')}
                </strong>

                <small className="block truncate">
                  {persona
                    ? `@${persona.handle}`
                    : personaError
                      ? 'Profile unavailable'
                      : user.email}
                </small>
              </span>

              <ChevronUp
                aria-hidden="true"
                className={`shrink-0 transition-transform ${
                  profileMenuOpen ? '' : 'rotate-180'
                }`}
                size={16}
              />
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-lg border border-border bg-background p-1 shadow-lg"
              >
                {personaError && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-destructive">
                      Could not load your profile.
                    </p>

                    <button
                      type="button"
                      className="mt-1 flex items-center gap-2 text-xs underline"
                      onClick={() => void refreshPersona()}
                    >
                      <RefreshCw size={12} aria-hidden="true" />
                      Try again
                    </button>
                  </div>
                )}

                <Link
                  to="/wall/you"
                  role="menuitem"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <UserRound size={16} aria-hidden="true" />
                  Go to profile
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>

                {signOutError && (
                  <p className="px-3 py-2 text-xs text-destructive">
                    {signOutError}
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <Link to="/login" className="side-user">
            <span className="avatar-mark">
              <LogIn size={18} aria-hidden="true" />
            </span>

            <span>
              <strong>Sign in</strong>
              <small>Access your profile</small>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

export function Topbar() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand mobile-brand" aria-label="Varaq home">
          <span className="brand-name">varaq</span>
          <span className="brand-urdu" lang="ur">
            ورق
          </span>
        </Link>

        <p className="topbar-note">
          <span aria-hidden="true">✳</span>
          Leave a page of yourself behind.
        </p>

        <div className="topbar-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Search writing"
            title="Search writing"
            onClick={() => setSearchOpen(true)}
          >
            <Search aria-hidden="true" />
          </button>


        <Link to="/write" className="literary-button write-button">
          <Feather aria-hidden="true" size={16} strokeWidth={1.7} />
          <span>Leave a page</span>
        </Link>

        </div>
      </header>

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
