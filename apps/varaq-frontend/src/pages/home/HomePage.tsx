import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowRight, Sprout } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { TrailPathIcon } from '@/components/icons/TrailPathIcon';
import { ReadingDialog } from '@/components/literary/ReadingDialog';
import { CommonsControls } from '@/features/feed/CommonsControls';
import { FeedGrid } from '@/features/feed/FeedGrid';
import { FeedStatus } from '@/features/feed/FeedStatus';
import { feedCategory, type FeedCategoryId } from '@/features/feed/categories';
import { usePublicFeed } from '@/features/feed/usePublicFeed';
import { useTrailStarts } from '@/features/feed/useTrailStarts';
import { toWriting, type Writing } from '@/features/feed/writings';
import { getFeed } from '@/lib/api';
import { LoadingState } from '@/components/ui/LoadingState';

export function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<FeedCategoryId>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [reading, setReading] = useState<Writing | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const trailsActive = searchParams.get('view') === 'trails';
  const category = feedCategory(selectedCategory);
  const feed = usePublicFeed({
    type: category.type,
    medium: category.medium,
    enabled: !trailsActive,
  });
  const writings = feed.items.map(toWriting);
  const trailStarts = useTrailStarts(trailsActive);
  const trailWritings = trailStarts.items.map(({ root }) => toWriting(root));

  function setTrailsActive(active: boolean) {
    const nextParams = new URLSearchParams(searchParams);
    if (active) nextParams.set('view', 'trails');
    else nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
  }

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
        void navigate(location.pathname + location.search, { replace: true, state: null });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setReadingError('Could not open this page. Please try again.');
      });
    return () => controller.abort();
  }, [location.key, location.pathname, location.search, location.state, navigate]);

  const viewMotion = {
    initial: reduceMotion ? false : { opacity: 0, filter: 'blur(3px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: reduceMotion ? { opacity: 1 } : { opacity: 0, filter: 'blur(2px)' },
    transition: { duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] },
  } as const;

  return (
    <div className="page-content commons-page">
      <CommonsControls
        selectedCategory={selectedCategory}
        filtersOpen={filtersOpen}
        trailsActive={trailsActive}
        onCategoryChange={setSelectedCategory}
        onFiltersOpenChange={setFiltersOpen}
        onTrailsActiveChange={setTrailsActive}
      />

      <header className="page-intro">
        <div>
          <h1>The commons</h1>
          <p>
            {trailsActive
              ? 'Where connected pages begin. Choose a Post-it and follow its Trail.'
              : 'Words from strangers. Feelings that aren’t so strange.'}
          </p>
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

      <div className="feed-layout">
        <div className="commons-feed-stack">
          <AnimatePresence initial={false}>
            {trailsActive ? (
              <motion.div className="commons-feed-view" key="trails" {...viewMotion}>
                {trailStarts.isLoading ? (
                  <LoadingState
                    label="Following the threads…"
                    detail="Finding where the connected pages begin."
                  />
                ) : trailStarts.error ? (
                  <div className="commons-mode-status" role="alert">
                    <p>{trailStarts.error}</p>
                    <button type="button" className="varaq-action" onClick={trailStarts.retry}>
                      Try again
                    </button>
                  </div>
                ) : trailWritings.length ? (
                  <FeedGrid
                    writings={trailWritings}
                    onRead={setReading}
                    ariaLabel="Trail beginnings"
                    hrefForWriting={(writing) =>
                      `/trail/${encodeURIComponent(writing.id)}?from=trails`
                    }
                  />
                ) : (
                  <div className="empty-page commons-trails-empty">
                    <TrailPathIcon aria-hidden="true" />
                    <h2>No Trails have been made yet.</h2>
                    <p>When one public page responds to another, its beginning will appear here.</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div className="commons-feed-view" key="pages" {...viewMotion}>
                <FeedGrid writings={writings} onRead={setReading} loading={feed.isLoading} />
                <FeedStatus feed={feed} visibleItemCount={writings.length} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="field-notes" aria-label="In the margins">
          <h2 className="notes-heading">
            <Sprout aria-hidden="true" />
            In the margins
          </h2>
          <div className="daily-line">
            <span className="eyebrow">A line to live with</span>
            <blockquote>
              “Let everything happen
              <br />
              to you: beauty and terror.
              <br />
              Just keep going.
              <br />
              No feeling is final.”
            </blockquote>
            <cite>— Rainer Maria Rilke</cite>
          </div>
          <div className="prompt-note">
            <span className="eyebrow">A small invitation</span>
            <p>
              Write about a place
              <br />
              that no longer exists,
              <br />
              except in you.
            </p>
            <Link to="/write">
              Take this to your page <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <p className="notes-bottom">No rush. Stay a little.</p>
        </aside>
      </div>

      {readingError && <p role="alert">{readingError}</p>}

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>

      <ReadingDialog reading={reading} onClose={() => setReading(null)} />
    </div>
  );
}
