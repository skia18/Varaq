import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, Sprout } from 'lucide-react';
import { WritingCard } from '../../components/literary/WritingCard';
import { writings, type Writing, type WritingForm } from '../../features/feed/writings';

const filters = [
  'All pages',
  'Poems',
  'Short stories',
  'Essays',
  'Letters',
  'Fragments',
] as const;

type FeedFilter = (typeof filters)[number];

export function HomePage() {
  const [filter, setFilter] = useState<FeedFilter>('All pages');
  const [sort, setSort] = useState<'recent' | 'loved'>('recent');
  const [reading, setReading] = useState<Writing | null>(null);

  const filtered = useMemo(() => {
    const result = writings.filter(
      (writing) => filter === 'All pages' || writing.form === (filter as WritingForm),
    );

    return sort === 'loved'
      ? [...result].sort((a, b) => b.appreciations - a.appreciations)
      : result;
  }, [filter, sort]);

  const columns = [0, 1, 2].map((column) =>
    filtered.filter((_, index) => index % 3 === column),
  );

  return (
    <div className="page-content">
      <header className="page-intro">
        <div>
          <h1>The commons</h1>
          <p>Words from strangers. Feelings that aren’t so strange.</p>
        </div>

        <div className="intro-note">
          <span>Take what you need.
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

        <select
          className="sort-control"
          aria-label="Sort pages"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="recent">Recently left here</option>
          <option value="loved">Most appreciated</option>
        </select>
      </div>

      <div className="feed-layout">
        <section aria-label="Recent writing" className="writing-grid">
          {columns.map((column, index) => (
            <div className="writing-column" key={index}>
              {column.map((writing) => (
                <WritingCard
                  key={writing.id}
                  writing={writing}
                  onRead={setReading}
                />
              ))}
            </div>
          ))}
        </section>

        <aside className="field-notes">
          <h2 className="notes-heading">
            <Sprout aria-hidden="true" />
            In the margins
          </h2>

          <div className="daily-line">
            <span className="eyebrow">A line to live with</span>
            <blockquote>
              “Let everything happen to you: beauty and terror. Just keep going.
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
            <a href="/write">
              Take this to your page <ArrowRight aria-hidden="true" />
            </a>
          </div>

          <p className="notes-bottom">No rush. Stay a little.</p>
        </aside>
      </div>

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>

      {reading && (
        <div
          className="reading-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReading(null);
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