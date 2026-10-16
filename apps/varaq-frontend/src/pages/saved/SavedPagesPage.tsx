import { Bookmark } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { WritingCard } from '../../components/literary/WritingCard';
import { writings } from '../../features/feed/writings';
import type { Writing } from '../../features/feed/writings';
import { useSavedPages } from '../../features/saved/SavedPagesContext';

export function SavedPagesPage() {
  const { savedIds } = useSavedPages();
  const navigate = useNavigate();

  const savedWritings = writings.filter((writing) => savedIds.includes(writing.id));

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

      {savedWritings.length > 0 ? (
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
