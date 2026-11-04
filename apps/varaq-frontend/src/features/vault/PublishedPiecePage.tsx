import { useEffect, useState } from 'react';
import { BookmarkPicker } from '@/features/collections/BookmarkPicker';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Globe2, Link2 } from 'lucide-react';
import { apiRequest, getTrail, type Piece, type TrailGraph } from '@/lib/api';
import { AudioPlayer } from '@/components/literary/AudioPlayer';
import { forms, literaryFormLabel } from '@/features/feed/writings';
import { publicMediaUrl } from '@/features/media/storage';
import { TrailTeaser } from '@/components/literary/TrailView';
export function PublishedPiecePage() {
  const { pieceId } = useParams();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [error, setError] = useState('');
  const [trail, setTrail] = useState<TrailGraph | null>(null);
  const [trailLoading, setTrailLoading] = useState(true);
  const [trailError, setTrailError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setPiece(null);
    setError('');
    setTrail(null);
    setTrailLoading(true);
    setTrailError('');
    void apiRequest<Piece>(`/api/v1/pieces/${encodeURIComponent(pieceId || '')}`)
      .then((p) => {
        if (!cancelled) setPiece(p);
      })
      .catch(() => {
        if (!cancelled) setError('This piece is unavailable.');
      });
    void getTrail(pieceId || '')
      .then((value) => {
        if (!cancelled) setTrail(value);
      })
      .catch(() => {
        if (!cancelled)
          setTrailError(
            'The Trail could not be loaded. Refresh after updating the backend and database.',
          );
      })
      .finally(() => {
        if (!cancelled) setTrailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pieceId]);
  return (
    <section className="page-content piece-page">
      {error ? (
        <p role="alert">{error}</p>
      ) : piece ? (
        <article className="published-piece">
          <Link to="/" className="varaq-action varaq-action--small piece-back"><ArrowLeft />The commons</Link>
          <div className="piece-heading-meta">
            <span className="eyebrow">{literaryFormLabel(forms[piece.type])}</span>
            <span className="piece-visibility">{piece.visibility === 'unlisted' ? <Link2 /> : <Globe2 />}{piece.visibility === 'unlisted' ? 'Unlisted' : 'Public'}</span>
          </div>
          <h1>{piece.title}</h1>
          {piece.visibility === 'public' && <BookmarkPicker pieceId={piece.id} />}
          {(piece.medium === 'photography' || piece.medium === 'artwork') && piece.mediaPath && (
            <figure className="piece-media">
              <img src={publicMediaUrl(piece.mediaPath)} alt={piece.imageAlt ?? piece.title} />
            </figure>
          )}
          {piece.medium === 'audio' && (piece.coverUrl || piece.coverPath) && (
            <figure className="piece-media piece-media-cover">
              <img
                src={piece.coverUrl ?? publicMediaUrl(piece.coverPath!)}
                alt={`Cover art for ${piece.title}`}
              />
            </figure>
          )}
          {piece.medium === 'audio' && piece.mediaPath && (
            <AudioPlayer
              src={publicMediaUrl(piece.mediaPath)}
              duration={piece.audioDuration ?? undefined}
            />
          )}
          <div className="published-piece-body">{piece.body}</div>
          {piece.credits && piece.credits.length > 0 && (
            <ul className="media-credits">
              {piece.credits.map((credit) => (
                <li key={credit}>{credit}</li>
              ))}
            </ul>
          )}
          {piece.visibility === 'public' && (
            <TrailTeaser
              graph={trail}
              pieceId={piece.id}
              loading={trailLoading}
              error={trailError}
            />
          )}
        </article>
      ) : (
        <p>Loading…</p>
      )}
    </section>
  );
}
