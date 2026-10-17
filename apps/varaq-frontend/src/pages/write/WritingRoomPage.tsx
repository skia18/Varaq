import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Feather, Lock, Save } from 'lucide-react';

import { useAuth } from '@/auth/AuthProvider';
import { createPiece, getOwnerPiece, updateOwnerPiece, type PieceType } from '@/lib/api';

const pieceTypes: { value: PieceType; label: string }[] = [
  { value: 'poem', label: 'Poem' },
  { value: 'fragment', label: 'Fragment' },
  { value: 'story', label: 'Story' },
  { value: 'letter', label: 'Letter' },
  { value: 'essay', label: 'Essay' },
];

export function WritingRoomPage() {
  const { persona, isLoading, isPersonaLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const pieceId = searchParams.get('pieceId');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<PieceType>('fragment');
  const [isLoadingPiece, setIsLoadingPiece] = useState(false);
  const [isPieceLoaded, setIsPieceLoaded] = useState(!pieceId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!pieceId) {
      setTitle('');
      setBody('');
      setType('fragment');
      setError(null);
      setSavedMessage(null);
      setIsPieceLoaded(true);
      setIsLoadingPiece(false);
      return;
    }

    setIsPieceLoaded(false);
    setIsLoadingPiece(true);
    setError(null);
    setSavedMessage(null);

    async function loadPiece() {
      try {
        const piece = await getOwnerPiece(pieceId!);

        if (cancelled) return;


        setTitle(piece.title);
        setBody(piece.body);
        setType(piece.type);
        setIsPieceLoaded(true);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error ? err.message : 'Could not open this draft. Please try again.',
        );
      } finally {
        if (!cancelled) {
          setIsLoadingPiece(false);
        }
      }
    }

    void loadPiece();

    return () => {
      cancelled = true;
    };
  }, [pieceId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!persona) {
      setError('Your writing identity is not available yet.');
      return;
    }

    if (pieceId && !isPieceLoaded) {
      setError('Wait for the draft to finish loading before saving.');
      return;
    }

    if (!title.trim() || !body.trim()) {
      setError('Add a title and some writing before saving.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      if (pieceId) {
        await updateOwnerPiece(pieceId, {
          title: title.trim(),
          body: body.trim(),
          type,
        });

        setSavedMessage('Your draft changes have been saved.');
      } else {
        await createPiece({
          personaId: persona.id,
          title: title.trim(),
          body: body.trim(),
          type,
          visibility: 'private',
        });

        setSavedMessage('Your draft has been saved privately.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Your draft could not be saved. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || isPersonaLoading) {
    return (
      <section className="page-section">
        <p className="eyebrow">Writing room</p>
        <h1 className="font-heading text-3xl">Preparing your notebook…</h1>
      </section>
    );
  }

  if (!persona) {
    return (
      <section className="page-section">
        <p className="eyebrow">Writing room</p>
        <h1 className="font-heading text-3xl">Your page comes first.</h1>
        <p className="mt-3 text-muted-foreground">
          Set up your writing identity before creating a piece.
        </p>
        <Link
          to="/vault"
          className="mt-6 inline-flex items-center gap-2 text-sm underline underline-offset-4"
        >
          <ArrowLeft size={15} />
          Return to your wall
        </Link>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/vault"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={15} />
          Your wall
        </Link>

        <header className="mb-10 mt-8">
          <p className="eyebrow flex items-center gap-2">
            <Feather size={14} />
            The writing room
          </p>
          <h1 className="mt-3 font-heading text-4xl leading-tight sm:text-5xl">
            {pieceId ? 'Return to your words.' : 'Begin anywhere.'}
          </h1>
          <p className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-muted-foreground">
            A thought, a half-remembered afternoon, a sentence that stayed. Give it a little room.
          </p>
        </header>

        {isLoadingPiece && (
          <p className="mb-5 text-sm text-muted-foreground" role="status">
            Opening your draft…
          </p>
        )}

        <form onSubmit={handleSave}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-4">
            <span className="text-sm text-muted-foreground">
              Writing as <span className="font-medium text-foreground">@{persona.handle}</span>
            </span>

            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Lock size={12} />
              Private draft
            </span>
          </div>

          <label htmlFor="piece-type" className="mb-2 block text-sm text-muted-foreground">
            What are you writing?
          </label>

          <select
            id="piece-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as PieceType);
              setSavedMessage(null);
            }}
            disabled={!isPieceLoaded || isLoadingPiece}
            className="mb-8 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {pieceTypes.map((pieceType) => (
              <option key={pieceType.value} value={pieceType.value}>
                {pieceType.label}
              </option>
            ))}
          </select>

          <label htmlFor="piece-title" className="sr-only">
            Piece title
          </label>
          <input
            id="piece-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSavedMessage(null);
            }}
            maxLength={200}
            placeholder="Give this piece a title…"
            required
            disabled={!isPieceLoaded || isLoadingPiece}
            className="w-full border-0 border-b border-border/70 bg-transparent pb-5 font-heading text-3xl outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-4xl"
          />

          <label htmlFor="piece-body" className="sr-only">
            Your writing
          </label>
          <textarea
            id="piece-body"
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setSavedMessage(null);
            }}
            maxLength={50000}
            required
            disabled={!isPieceLoaded || isLoadingPiece}
            placeholder="Let the words arrive in their own time…"
            className="mt-7 min-h-[380px] w-full resize-y border-0 bg-transparent font-serif text-lg leading-8 text-foreground outline-none placeholder:text-muted-foreground/50 sm:min-h-[480px]"
          />

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Take your time. Nothing is public yet.</span>
            <span>{body.length.toLocaleString()} / 50,000</span>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {savedMessage && (
            <p role="status" className="mt-5 flex items-center gap-2 text-sm text-foreground">
              <Check size={16} />
              {savedMessage}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6">
            <p className="text-xs text-muted-foreground">Saved drafts are private by default.</p>

            <button
              type="submit"
              disabled={
                isSaving || isLoadingPiece || !isPieceLoaded || !title.trim() || !body.trim()
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {isSaving ? 'Saving…' : pieceId ? 'Save changes' : 'Save draft'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
