import { useEffect, useState } from 'react';
import { BookmarkPicker } from '@/features/collections/BookmarkPicker';
import { useParams } from 'react-router-dom';
import { apiRequest, type Piece } from '@/lib/api';
import { AudioPlayer } from '@/components/literary/AudioPlayer';
import { forms, mediumLabel } from '@/features/feed/writings';
import { publicMediaUrl } from '@/features/media/storage';
export function PublishedPiecePage() {
  const { pieceId } = useParams();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setPiece(null);
    setError('');
    void apiRequest<Piece>(`/api/v1/pieces/${encodeURIComponent(pieceId || '')}`)
      .then((p) => {
        if (!cancelled) setPiece(p);
      })
      .catch(() => {
        if (!cancelled) setError('This piece is unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [pieceId]);
  return (
    <section className="page-section">
      {error ? (
        <p role="alert">{error}</p>
      ) : piece ? (
        <article className="published-piece">
          <span className="eyebrow">
            {piece.medium && piece.medium !== 'writing'
              ? mediumLabel(piece.medium)
              : forms[piece.type]}
          </span>
          <h1>{piece.title}</h1>
          {piece.visibility === 'public' && <BookmarkPicker pieceId={piece.id} />}
          {(piece.medium === 'photography' || piece.medium === 'artwork') && piece.mediaPath && (
            <figure className="piece-media">
              <img src={publicMediaUrl(piece.mediaPath)} alt={piece.imageAlt ?? piece.title} />
            </figure>
          )}
          {piece.medium === 'audio' && piece.coverUrl && (
            <figure className="piece-media piece-media-cover">
              <img src={piece.coverUrl} alt={`Cover art for ${piece.title}`} />
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
        </article>
      ) : (
        <p>Loading…</p>
      )}
    </section>
  );
}
