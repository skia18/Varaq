import { useEffect, useState } from 'react';
import { ArrowRight, Feather, Footprints } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTrails, type TrailSummary } from '@/lib/api';
import { mediumLabel, toWriting } from '@/features/feed/writings';
import { TrailPathIcon } from '@/components/icons/TrailPathIcon';

export function TrailsPage() {
  const [trails, setTrails] = useState<TrailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getTrails()
      .then(({ items }) => {
        if (active) setTrails(items);
      })
      .catch(() => {
        if (active) setError('The Trails could not be gathered right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="page-content trails-directory-page">
      <header className="page-intro trails-directory-intro">
        <div>
          <h1>Trails</h1>
          <p>Follow the lines between works—what inspired, answered, and continued.</p>
        </div>
        <TrailPathIcon aria-hidden="true" />
      </header>

      {loading ? (
        <p className="trails-directory-status" role="status">Following the threads…</p>
      ) : error ? (
        <p className="trails-directory-status" role="alert">{error}</p>
      ) : trails.length ? (
        <ol className="trail-footprint-path">
          {trails.map((trail) => {
            const root = toWriting(trail.root);
            return (
              <li className="trail-footprint-stop" key={trail.root.id}>
                <Link
                  className="trail-footprint-mark"
                  to={`/trail/${trail.root.id}?from=trails`}
                  aria-label={`Explore the trail beginning with ${root.title}`}
                >
                  <Footprints aria-hidden="true" />
                </Link>
                <div className="trail-footprint-copy">
                  <div className="trail-directory-kicker">
                    <span>{trail.pieceCount} {trail.pieceCount === 1 ? 'page' : 'pages'} along this path</span>
                  </div>
                  <h2>
                    <Link to={`/trail/${trail.root.id}?from=trails`}>{root.title}</Link>
                  </h2>
                  <p className="trail-directory-excerpt">{root.excerpt || 'A page that began a new thread.'}</p>
                  <div className="trail-directory-meta">
                    <span>Begun by <Link to={`/wall/${encodeURIComponent(root.handle)}`}>{root.author}</Link></span>
                    <span>{mediumLabel(root.medium)}</span>
                  </div>
                  <Link className="trail-directory-link" to={`/trail/${trail.root.id}?from=trails`}>
                    Follow this trail <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="empty-page trails-directory-empty">
          <Feather aria-hidden="true" />
          <h2>No Trails have been made yet.</h2>
          <p>When one public work responds to another, its path will appear here.</p>
          <Link className="varaq-action varaq-action--primary" to="/">
            Browse the commons
          </Link>
        </div>
      )}
    </section>
  );
}
