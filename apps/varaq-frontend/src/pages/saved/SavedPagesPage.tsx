import { useEffect, useState } from 'react';
import { getFeed } from '@/lib/api';
import { Bookmark } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { WritingCard } from '../../components/literary/WritingCard';
import { toWriting } from '../../features/feed/writings';
import type { Writing } from '../../features/feed/writings';
import { useSavedPages } from '../../features/saved/SavedPagesContext';

export function SavedPagesPage() {
  const { savedIds } = useSavedPages();
  const navigate = useNavigate();

  const [savedWritings, setSavedWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    // Ignore IDs from the retired numeric sample dataset.
    const ids = savedIds.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    );
    setLoading(true);
    setError(null);
    setSavedWritings([]);
    const batches: string[][] = [];
    for (let start = 0; start < ids.length; start += 50) batches.push(ids.slice(start, start + 50));
    void Promise.all(
      batches.map((batch) => getFeed({ ids: batch, limit: 50, signal: controller.signal })),
    )
      .then((pages) => {
        if (!controller.signal.aborted)
          setSavedWritings(pages.flatMap((page) => page.items.map(toWriting)));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load your saved pages. Please refresh to try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [savedIds]);

  function readWriting(writing: Writing) {
    navigate('/', {
      state: { openWritingId: writing.id },
    });
  }

  return (
    <div className="page-content">
      <header className="page-intro">
        <div>
          <h1>Saved pages</h1>
          <p>Some words ask to be kept. These are yours to return to.</p>
        </div>
      </header>

      {loading ? (
        <p role="status">Loading saved pages…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : savedWritings.length > 0 ? (
        <section className="saved-writing-grid" aria-label="Your saved writing">
          {savedWritings.map((writing) => (
            <WritingCard key={writing.id} writing={writing} onRead={readWriting} />
          ))}
        </section>
      ) : (
        <section className="empty-page">
          <Bookmark aria-hidden="true" />
          <h2>A shelf waiting for its first page.</h2>
          <p>Nothing kept here yet.</p>
          <Link to="/" className="literary-button">
            Back to the commons
          </Link>
        </section>
      )}

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>
    </div>
  );
}
