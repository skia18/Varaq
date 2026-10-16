import { useState } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WritingCard } from '../../components/literary/WritingCard';
import { writings } from '../../features/feed/writings';
import type { Writing } from '../../features/feed/writings';

const shelves = [
  {
    name: 'Things that linger',
    description: 'For the things we carry, long after.',
    ids: ['1', '3', '5'],
  },
  {
    name: 'Between the lines',
    description: 'What is said. What is left unsaid.',
    ids: ['2', '4', '5'],
  },
  {
    name: 'Rainy day reading',
    description: 'A window, a cup, a little time.',
    ids: ['3', '6', '4'],
  },
];

export function CollectionsPage() {
  const [selectedShelf, setSelectedShelf] = useState<number | null>(null);
  const navigate = useNavigate();
  const shelf = selectedShelf === null ? null : shelves[selectedShelf];
  const shelfWritings = shelf ? writings.filter((writing) => shelf.ids.includes(writing.id)) : [];

  function readWriting(writing: Writing) {
    navigate('/', { state: { openWritingId: writing.id } });
  }

  return (
    <div className="page-content">
      <header className="page-intro">
        <div>
          <h1>{shelf?.name ?? 'Collections'}</h1>
          <p>
            {shelf?.description ?? 'A few words, gathered together. Little shelves to return to.'}
          </p>
        </div>
      </header>

      {shelf ? (
        <>
          <button
            type="button"
            className="quiet-link collection-back"
            onClick={() => setSelectedShelf(null)}
          >
            <ArrowLeft aria-hidden="true" />
            All collections
          </button>
          {shelfWritings.length ? (
            <div className="collection-writing-grid">
              {shelfWritings.map((writing) => (
                <WritingCard key={writing.id} writing={writing} onRead={readWriting} />
              ))}
            </div>
          ) : (
            <div className="empty-page">
              <h2>This shelf is waiting for its pages.</h2>
            </div>
          )}
        </>
      ) : (
        <div className="collection-grid">
          {shelves.map((collection, index) => (
            <button
              type="button"
              className={`collection-cover collection-cover-${index + 1}`}
              key={collection.name}
              onClick={() => setSelectedShelf(index)}
            >
              <span className="eyebrow">Collected pages · 0{index + 1}</span>
              <span className="collection-cover-main">
                <strong>{collection.name}</strong>
                <span>{collection.description}</span>
              </span>
              <span className="collection-cover-bottom">
                <span>{collection.ids.length} pages</span>
                <ArrowUpRight aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      )}

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>
    </div>
  );
}
