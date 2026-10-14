import { Link } from 'react-router-dom';

export function SiteHeader() {
  return (
    <header className="border-b border-ink/10 px-6 py-5">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link
          to="/"
          className="font-display text-3xl font-semibold tracking-tight"
        >
          varaq<span className="text-oxide">.</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <Link to="/" className="transition-opacity hover:opacity-70">
            Home
          </Link>
          <a href="/discover" className="transition-opacity hover:opacity-70">
            Discover
          </a>
          <a href="/write" className="transition-opacity hover:opacity-70">
            Write
          </a>
        </div>
      </nav>
    </header>
  );
}