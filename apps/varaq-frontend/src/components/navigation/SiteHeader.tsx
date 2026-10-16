import { useState } from 'react';
import { BookOpen, Bookmark, Feather, Library, Search, Sprout, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { SearchDialog } from './SearchDialog';

const navigation = [
  { label: 'The commons', to: '/', icon: BookOpen, end: true },
  { label: 'Collections', to: '/collections', icon: Library },
  { label: 'Saved pages', to: '/saved', icon: Bookmark },
  { label: 'My wall', to: '/wall/you', icon: UserRound },
];

export function SiteHeader() {
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
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
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

      <Link to="/wall/you" className="side-user">
        <span className="avatar-mark">q</span>
        <span>
          <strong>a quiet stranger</strong>
          <small>@aquietstranger</small>
        </span>
      </Link>
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
            <Feather aria-hidden="true" />
            Leave a page
          </Link>
        </div>
      </header>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
