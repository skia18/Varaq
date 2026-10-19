import { useState, type FormEvent } from 'react';
import { FolderPlus, LockKeyhole, Globe2 } from 'lucide-react';
import type { Collection, CollectionInput } from './CollectionsContext';
export function CollectionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Collection;
  onSubmit: (input: CollectionInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    initial?.visibility ?? 'private',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), description, visibility });
      onCancel();
    } catch {
      setError('Could not save the collection. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="collection-form" onSubmit={submit}>
      <header className="collection-form-heading">
        <span className="collection-form-icon">
          <FolderPlus aria-hidden="true" />
        </span>
        <div>
          <h2>{initial ? 'A few finishing touches.' : 'A place for your pages.'}</h2>
          <p>
            {initial
              ? 'Make this collection feel like yours.'
              : 'Give it a name. Gather the rest as you go.'}
          </p>
        </div>
      </header>
      <label>
        Name
        <input
          autoFocus
          required
          maxLength={100}
          placeholder="Words to Return To"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Description (optional)
        <textarea
          maxLength={1000}
          placeholder="A few words about what belongs here…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Visibility
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
        >
          <option value="private">Private — only you</option>
          <option value="public">Public — anyone with the link</option>
        </select>
      </label>
      <p className="collection-form-hint">
        {visibility === 'private' ? (
          <LockKeyhole aria-hidden="true" />
        ) : (
          <Globe2 aria-hidden="true" />
        )}
        {visibility === 'private'
          ? 'Just for you. You can share this collection later.'
          : 'Anyone with the link can browse the publicly available pieces.'}
      </p>
      {error && (
        <p className="collection-notice collection-notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="collection-actions">
        <button
          disabled={busy || !name.trim()}
          type="submit"
          className="varaq-action varaq-action--primary"
        >
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create collection'}
        </button>
        <button
          className="varaq-action collection-action-quiet"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
