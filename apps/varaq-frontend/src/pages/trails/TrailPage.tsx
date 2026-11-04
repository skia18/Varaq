import { useEffect, useState } from 'react';
import { ArrowLeft, Feather } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getTrail, type TrailGraph } from '@/lib/api';
import { TrailGraphView, TrailLegend } from '@/components/literary/TrailView';

export function TrailPage() {
  const { pieceId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const openedFromDirectory = searchParams.get('from') === 'trails';
  const [graph, setGraph] = useState<TrailGraph | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setGraph(null);
    setError('');
    void getTrail(pieceId)
      .then((value) => {
        if (active) setGraph(value);
      })
      .catch(() => {
        if (active) setError('This Trail is unavailable.');
      });
    return () => {
      active = false;
    };
  }, [pieceId]);
  return (
    <section className="page-content trail-page">
      <header className="page-intro">
        <div>
          <h1>The trail</h1>
          <p>How one work inspired another. Every page remains its own.</p>
        </div>
      </header>
      <Link
        className="varaq-action varaq-action--small"
        to={openedFromDirectory ? '/trails' : `/piece/${pieceId}`}
      >
        <ArrowLeft />
        {openedFromDirectory ? 'Back to all Trails' : 'Back to the page'}
      </Link>
      {error ? (
        <p role="alert">{error}</p>
      ) : graph ? (
        <>
          <TrailLegend />
          <TrailGraphView graph={graph} />
          {graph.edges.length === 0 && (
            <div className="empty-page">
              <Feather aria-hidden="true" />
              <h2>This Trail begins here.</h2>
              <p>Create a response or connect one of your existing public pages.</p>
              <div className="trail-actions">
                <Link
                  className="varaq-action varaq-action--primary"
                  to={`/write?respondTo=${encodeURIComponent(pieceId)}`}
                >
                  Create a response
                </Link>
                <Link
                  className="varaq-action"
                  to={`/wall/manage/edit?respondTo=${encodeURIComponent(pieceId)}`}
                >
                  Add an existing piece
                </Link>
              </div>
            </div>
          )}
        </>
      ) : (
        <p role="status">Following the thread…</p>
      )}
    </section>
  );
}
