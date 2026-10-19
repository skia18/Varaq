import { useEffect, useState } from 'react';
import { BookmarkPicker } from '@/features/collections/BookmarkPicker';
import { useParams } from 'react-router-dom';
import { apiRequest, type Piece } from '@/lib/api';
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
        <article>
          <h1>{piece.title}</h1>
          {piece.visibility === 'public' && <BookmarkPicker pieceId={piece.id} />}
          <div style={{ whiteSpace: 'pre-wrap' }}>{piece.body}</div>
        </article>
      ) : (
        <p>Loading…</p>
      )}
    </section>
  );
}
