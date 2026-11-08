import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Feather, GitFork, Globe, Lock, Save } from 'lucide-react';
import type { DraftContent } from '@/features/vault/crypto';
import type { Piece } from '@/lib/api';
import { MediaUploadField } from '@/features/media/MediaUploadField';
import { LoadingLabel, LoadingState } from '@/components/ui/LoadingState';
import '@/styles/pages.css';

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
  pieceId?: string;
  responseSource?: Piece | null;
  trailSources?: Piece[];
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
  pieceId,
  responseSource,
  trailSources = [],
}: Props) {
  const published = mode === 'published';
  const selectedSource =
    responseSource ?? trailSources.find((source) => source.id === content.respondsTo?.pieceId);
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
          {published && pieceId && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/piece/${pieceId}`} className="varaq-action varaq-action--small">
                Read page
              </Link>
              <Link to={`/trail/${pieceId}`} className="varaq-action varaq-action--small">
                <GitFork size={14} /> View Trail
              </Link>
            </div>
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
          <LoadingState
            variant="section"
            label={published ? 'Opening your piece…' : 'Preparing your notebook…'}
            detail="Making a quiet place for your words."
          />
        )}
        <form
          onSubmit={onSave}
          aria-label={published ? 'Edit published writing' : 'Write a private draft'}
        >
          {published && !content.respondsTo && (
            <section className="respond-banner" aria-labelledby="trail-relationship-heading">
              <span className="eyebrow">Trail relationship</span>
              <h2 id="trail-relationship-heading">Connect this page to another.</h2>
              <p className="muted-copy">
                Choose a public page that inspired this one or whose thread it continues.
              </p>
              <label className="trail-source-select">
                Source page
                <select
                  value=""
                  disabled={!loaded || busy || trailSources.length === 0}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    onChange({
                      ...content,
                      respondsTo: { pieceId: event.target.value, relation: 'inspired-by' },
                    });
                  }}
                >
                  <option value="">
                    {trailSources.length ? 'Choose a public page…' : 'No public pages available'}
                  </option>
                  {trailSources.map((source) => (
                    <option value={source.id} key={source.id}>
                      {source.title}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
          {selectedSource && content.respondsTo && (
            <section className="respond-banner" aria-labelledby="response-source-heading">
              <span className="eyebrow">A response to</span>
              <Link id="response-source-heading" to={`/piece/${selectedSource.id}`}>
                <strong>{selectedSource.title}</strong>
              </Link>
              <fieldset className="relation-options">
                <legend>This piece…</legend>
                <label>
                  <input
                    type="radio"
                    name="trail-relation"
                    checked={content.respondsTo.relation === 'inspired-by'}
                    onChange={() =>
                      onChange({
                        ...content,
                        respondsTo: { ...content.respondsTo!, relation: 'inspired-by' },
                      })
                    }
                  />
                  <span>
                    Inspired by<small>A new work carrying something of this one.</small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="trail-relation"
                    checked={content.respondsTo.relation === 'continues'}
                    onChange={() =>
                      onChange({
                        ...content,
                        respondsTo: { ...content.respondsTo!, relation: 'continues' },
                      })
                    }
                  />
                  <span>
                    Continues<small>A continuation of the same thread.</small>
                  </span>
                </label>
              </fieldset>
              {published && (
                <button
                  type="button"
                  className="varaq-action varaq-action--small trail-change-source"
                  onClick={() => onChange({ ...content, respondsTo: undefined })}
                >
                  Remove or choose a different source
                </button>
              )}
            </section>
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-4">
            <span className="text-sm text-muted-foreground">
              {handle ? (
                <>
                  Writing as <span className="font-medium text-foreground">@{handle}</span>
                </>
              ) : (
                <LoadingLabel>Preparing your writing identity</LoadingLabel>
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
          {!published && pieceId && (
            <MediaUploadField
              pieceId={pieceId}
              content={content}
              onChange={onChange}
              disabled={!loaded || busy}
            />
          )}
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
              disabled={
                busy ||
                !loaded ||
                !content.title.trim() ||
                (!content.body.trim() && !content.image && !content.audio && !content.media)
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {busy ? (
                <LoadingLabel>Saving your words</LoadingLabel>
              ) : published ? (
                'Save published changes'
              ) : mode === 'new' ? (
                'Save draft'
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
