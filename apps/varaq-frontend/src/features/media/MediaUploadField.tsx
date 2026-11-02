import { AudioLines, Camera, FileAudio, Image, LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DraftContent, DraftMedium } from '@/features/vault/crypto';
import {
  MEDIA_QUOTA,
  mediaUsage,
  removeDraftMedia,
  signedMediaUrl,
  uploadDraftMedia,
} from './storage';

const options: { value: DraftMedium; label: string; icon: typeof Camera }[] = [
  { value: 'writing', label: 'Writing', icon: Image },
  { value: 'photography', label: 'Photo', icon: Camera },
  { value: 'artwork', label: 'Artwork', icon: Image },
  { value: 'audio', label: 'Audio', icon: AudioLines },
];

function megabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function MediaUploadField({
  pieceId,
  content,
  onChange,
  disabled,
}: {
  pieceId: string;
  content: DraftContent;
  onChange: (content: DraftContent) => void;
  disabled: boolean;
}) {
  const medium = content.medium ?? 'writing';
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [usage, setUsage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void mediaUsage()
      .then((value) => setUsage(value.used_bytes + value.reserved_bytes))
      .catch(() => {});
  }, [content.media?.uploadId]);

  useEffect(() => {
    let active = true;
    setPreview('');
    if (content.media)
      void signedMediaUrl(content.media).then((url) => {
        if (active) setPreview(url);
      });
    return () => {
      active = false;
    };
  }, [content.media]);

  async function choose(file?: File) {
    if (!file || medium === 'writing') return;
    setUploading(true);
    setError('');
    try {
      const next = await uploadDraftMedia(pieceId, medium, file);
      if (content.media) await removeDraftMedia(content.media);
      onChange({ ...content, medium, media: next });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The upload could not be completed.');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    if (!content.media) return;
    setUploading(true);
    setError('');
    try {
      await removeDraftMedia(content.media);
      onChange({ ...content, media: undefined });
      setPreview('');
    } catch {
      setError('The media could not be removed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="media-upload-field" aria-labelledby="medium-heading">
      <div className="media-upload-heading">
        <div>
          <span className="eyebrow" id="medium-heading">
            Medium
          </span>
          <p>Choose what kind of page you are leaving behind.</p>
        </div>
        <span>
          {megabytes(usage)} of {megabytes(MEDIA_QUOTA)} used
        </span>
      </div>
      <div className="medium-options">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            type="button"
            key={value}
            className={medium === value ? 'is-selected' : ''}
            aria-pressed={medium === value}
            disabled={disabled || uploading}
            onClick={() => {
              if (content.media && value !== medium) {
                setError('Remove the current media before changing the medium.');
                return;
              }
              onChange({ ...content, medium: value });
              setError('');
            }}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {medium !== 'writing' && (
        <div className="media-upload-zone">
          {preview && medium !== 'audio' && <img src={preview} alt="Draft media preview" />}
          {preview && medium === 'audio' && <audio src={preview} controls preload="metadata" />}
          {!content.media && (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => input.current?.click()}
            >
              {uploading ? (
                <LoaderCircle className="animate-spin" />
              ) : medium === 'audio' ? (
                <FileAudio />
              ) : (
                <Camera />
              )}
              {uploading
                ? 'Uploading…'
                : medium === 'audio'
                  ? 'Choose an audio file'
                  : 'Choose an image'}
            </button>
          )}
          {content.media && (
            <div className="media-upload-meta">
              <span>
                {content.media.originalName} · {megabytes(content.media.byteSize)}
              </span>
              <button type="button" disabled={disabled || uploading} onClick={() => void remove()}>
                <Trash2 /> Remove
              </button>
            </div>
          )}
          <input
            ref={input}
            type="file"
            hidden
            accept={
              medium === 'audio'
                ? 'audio/mpeg,audio/wav,audio/mp4'
                : 'image/jpeg,image/png,image/webp'
            }
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          <small>
            {medium === 'audio'
              ? 'MP3, WAV, or M4A · up to 25 MB'
              : 'JPEG, PNG, or WebP · up to 10 MB'}
          </small>
        </div>
      )}
      {error && (
        <p className="media-upload-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
