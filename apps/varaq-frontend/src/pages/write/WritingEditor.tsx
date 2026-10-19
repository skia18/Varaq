import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Feather, Globe, Lock, Save } from 'lucide-react';
import type { DraftContent } from '@/features/vault/crypto';

type Props = {
  content: DraftContent;
  onChange: (content: DraftContent) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  mode: 'new' | 'draft' | 'published';
  handle?: string;
  backTo: string;
  loaded: boolean;
  busy: boolean;
  error: string;
  message: string;
  onLock?: () => void;
};
const types = [
  { value: 'poem', label: 'Poem' },
  { value: 'fragment', label: 'Fragment' },
  { value: 'story', label: 'Story' },
  { value: 'letter', label: 'Letter' },
  { value: 'essay', label: 'Essay' },
] as const;

// Shared presentation keeps draft and published editing aligned with the Writing Room.
export function WritingEditor({
  content,
  onChange,
  onSave,
  mode,
  handle,
  backTo,
  loaded,
  busy,
  error,
  message,
  onLock,
}: Props) {
  const published = mode === 'published';
  return (
    <section className="page-content" aria-labelledby="writing-room-heading">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to={backTo} className="varaq-action varaq-action--small">
            <ArrowLeft size={15} />
            {published ? 'My Wall' : 'My Vault'}
          </Link>
          {onLock && (
            <button type="button" onClick={onLock} className="varaq-action varaq-action--small">
              <Lock size={14} />
              Lock Vault
            </button>
          )}
        </div>
        <header className="mb-10 mt-8">
          <p className="eyebrow flex items-center gap-2">
            <Feather size={14} />
            The writing room
          </p>
          <h1
            id="writing-room-heading"
            className="mt-3 font-heading text-4xl leading-tight sm:text-5xl"
          >
            {mode === 'new'
              ? 'Begin anywhere.'
              : published
                ? 'Return to your published words.'
                : 'Return to your words.'}
          </h1>
          <p className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-muted-foreground">
            {published
              ? 'A little room to revisit what you have shared. Changes here update your published piece.'
              : 'A thought, a half-remembered afternoon, a sentence that stayed. Give it a little room.'}
          </p>
        </header>
        {!loaded && !error && (
          <p className="mb-5 text-sm text-muted-foreground" role="status">
            {published ? 'Opening your piece…' : 'Preparing your notebook…'}
          </p>
        )}
        <form
          onSubmit={onSave}
          aria-label={published ? 'Edit published writing' : 'Write a private draft'}
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-4">
            <span className="text-sm text-muted-foreground">
              {handle ? (
                <>
                  Writing as <span className="font-medium text-foreground">@{handle}</span>
                </>
              ) : (
                'Preparing your writing identity…'
              )}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              {published ? <Globe size={12} /> : <Lock size={12} />}{' '}
              {published ? 'Published piece' : 'Encrypted draft'}
            </span>
          </div>
          <label htmlFor="piece-type" className="mb-2 block text-sm text-muted-foreground">
            What are you writing?
          </label>
          <select
            id="piece-type"
            value={content.type}
            onChange={(e) => onChange({ ...content, type: e.target.value as DraftContent['type'] })}
            disabled={!loaded || busy}
            className="mb-8 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label htmlFor="piece-title" className="sr-only">
            Piece title
          </label>
          <input
            id="piece-title"
            value={content.title}
            onChange={(e) => onChange({ ...content, title: e.target.value })}
            maxLength={200}
            placeholder="Give this piece a title…"
            required
            disabled={!loaded || busy}
            className="w-full border-0 border-b border-border/70 bg-transparent pb-5 font-heading text-3xl outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-4xl"
          />
          <label htmlFor="piece-body" className="sr-only">
            Your writing
          </label>
          <textarea
            id="piece-body"
            value={content.body}
            onChange={(e) => onChange({ ...content, body: e.target.value })}
            maxLength={50000}
            required
            disabled={!loaded || busy}
            placeholder="Let the words arrive in their own time…"
            className="mt-7 min-h-[380px] w-full resize-y border-0 bg-transparent font-serif text-lg leading-8 text-foreground outline-none placeholder:text-muted-foreground/50 sm:min-h-[480px]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {published
                ? 'Your published piece stays visible while you edit.'
                : 'Take your time. Nothing is public yet.'}
            </span>
            <span>{content.body.length.toLocaleString()} / 50,000</span>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="mt-5 flex items-center gap-2 text-sm text-foreground">
              <Check size={16} />
              {message}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6">
            <p className="text-xs text-muted-foreground">
              {published
                ? 'Saving updates your published writing.'
                : 'Your writing is encrypted before it is saved.'}
            </p>
            <button
              type="submit"
              disabled={busy || !loaded || !content.title.trim() || !content.body.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {busy
                ? 'Saving…'
                : published
                  ? 'Save published changes'
                  : mode === 'new'
                    ? 'Save draft'
                    : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
