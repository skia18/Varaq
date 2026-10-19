import { WritingEditor } from './WritingEditor';
import { useAuth } from '@/auth/AuthProvider';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOwnerPiece, updateOwnerPiece, type Piece } from '@/lib/api';

// Published content is intentionally readable by Varaq and uses the existing editor API.
export function LegacyWritingRoomPage() {
  const { persona } = useAuth();
  const [params] = useSearchParams();
  const id = params.get('pieceId');
  const [piece, setPiece] = useState<Piece | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setPiece(null);
    setError('');
    if (!id) {
      setError('Choose a published piece to edit.');
      return;
    }
    void getOwnerPiece(id)
      .then((p) => {
        if (p.status !== 'published')
          throw new Error('Move this legacy draft into the encrypted Vault before editing.');
        if (active) setPiece(p);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open published piece.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!piece) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateOwnerPiece(piece.id, { title: piece.title, body: piece.body, type: piece.type });
      setMessage('Published changes saved.');
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <WritingEditor
      content={piece || { title: '', body: '', type: 'fragment' }}
      onChange={(content) => {
        if (piece) {
          setPiece({ ...piece, ...content });
          setMessage('');
        }
      }}
      onSave={save}
      mode="published"
      handle={persona?.handle}
      backTo={persona ? `/wall/${encodeURIComponent(persona.handle)}` : '/vault'}
      loaded={!!piece}
      busy={busy}
      error={error}
      message={message}
    />
  );
}
