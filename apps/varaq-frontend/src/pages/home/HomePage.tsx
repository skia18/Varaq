import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowDownLeft } from 'lucide-react';
import { FeedGrid } from '@/features/feed/FeedGrid';
import { toWriting, forms, type Writing } from '../../features/feed/writings';

import { getFeed, type PieceType } from '@/lib/api';
import { usePublicFeed } from '@/features/feed/usePublicFeed';
import { FeedStatus } from '@/features/feed/FeedStatus';

const filters = ['All pages', 'Poems', 'Short stories', 'Essays', 'Letters', 'Fragments'] as const;

type FeedFilter = (typeof filters)[number];

export function HomePage() {
  const [filter, setFilter] = useState<FeedFilter>('All pages');
  const type = Object.entries(forms).find(([, label]) => label === filter)?.[0] as
    | PieceType
    | undefined;
  const feed = usePublicFeed({ type });
  const writings = feed.items.map(toWriting);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [reading, setReading] = useState<Writing | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Saved pages and search may open a piece outside the first feed page.
  useEffect(() => {
    const id = (location.state as { openWritingId?: string } | null)?.openWritingId;
    if (!id) return;
    const controller = new AbortController();
    setReadingError(null);
    void getFeed({ ids: [id], limit: 1, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        if (page.items[0]) setReading(toWriting(page.items[0]));
        else setReadingError('This page is no longer publicly available.');
        navigate(location.pathname + location.search, { replace: true, state: null });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setReadingError('Could not open this page. Please try again.');
      });
    return () => controller.abort();
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  return (
    <div className="page-content">
      <header className="page-intro">
        <div>
          <h1>The commons</h1>
          <p>Words from strangers. Feelings that aren’t so strange.</p>
        </div>

        <div className="intro-note">
          <span>
            Take what you need.
            <br />
            Leave what you feel.
          </span>
          <ArrowDownLeft aria-hidden="true" />
        </div>
      </header>

      <div className="feed-toolbar">
        <div className="filter-list" aria-label="Filter writing">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? 'filter-active' : 'filter-button'}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
            >
              {item}
            </button>
          ))}
        </div>

        <span className="sort-control">Most recently published</span>
      </div>

      <FeedGrid writings={writings} onRead={setReading} loading={feed.isLoading} />

      <FeedStatus feed={feed} />
      {readingError && <p role="alert">{readingError}</p>}

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>

      {reading && (
        <div
          className="reading-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReading(null);
            }
          }}
          role="presentation"
        >
          <section
            className="reading-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reading-title"
          >
            <button
              type="button"
              className="reading-close"
              onClick={() => setReading(null)}
              aria-label="Close reading"
            >
              ×
            </button>

            <span className="eyebrow">
              {reading.form} · {reading.minutes} min read
            </span>

            <h2 id="reading-title" className="reading-title">
              {reading.title}
            </h2>

            <p className="reading-byline">
              by {reading.author} · {reading.date}
            </p>

            <div className="reading-body">{reading.body}</div>
          </section>
        </div>
      )}
    </div>
  );
}
