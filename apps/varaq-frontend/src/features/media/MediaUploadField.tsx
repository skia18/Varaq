import { Camera, FileAudio, LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DraftContent, DraftMedia } from '@/features/vault/crypto';
import {
  MEDIA_QUOTA,
  mediaUsage,
  removeDraftMedia,
  signedMediaUrl,
  uploadDraftMedia,
} from './storage';

const megabytes = (bytes: number) =>
  `${(bytes / 1024 / 1024).toFixed(bytes >= 10485760 ? 0 : 1)} MB`;

function Attachment({
  kind,
  media,
  pieceId,
  disabled,
  onChange,
}: {
  kind: 'image' | 'audio';
  media?: DraftMedia;
  pieceId: string;
  disabled: boolean;
  onChange: (media?: DraftMedia) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setPreview('');
    if (media) void signedMediaUrl(media).then((url) => active && setPreview(url));
    return () => {
      active = false;
    };
  }, [media]);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const next = await uploadDraftMedia(
        pieceId,
        kind === 'audio' ? 'audio' : 'photography',
        file,
      );
      if (media) await removeDraftMedia(media);
      onChange(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function remove() {
    if (!media) return;
    setBusy(true);
    setError('');
    try {
      await removeDraftMedia(media);
      onChange();
    } catch {
      setError('The attachment could not be removed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="media-upload-zone">
      <span className="eyebrow">{kind === 'audio' ? 'Audio' : 'Image'}</span>
      {preview && kind === 'image' && <img src={preview} alt="Draft image preview" />}
      {preview && kind === 'audio' && <audio src={preview} controls preload="metadata" />}
      {!media && (
        <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? (
            <LoaderCircle className="animate-spin" />
          ) : kind === 'audio' ? (
            <FileAudio />
          ) : (
            <Camera />
          )}
          {busy ? 'Uploading…' : `Add ${kind}`}
        </button>
      )}
      {media && (
        <div className="media-upload-meta">
          <span>
            {media.originalName} · {megabytes(media.byteSize)}
          </span>
          <button type="button" disabled={disabled || busy} onClick={() => void remove()}>
            <Trash2 /> Remove
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={
          kind === 'audio' ? 'audio/mpeg,audio/wav,audio/mp4' : 'image/jpeg,image/png,image/webp'
        }
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <small>
        {kind === 'audio' ? 'MP3, WAV, or M4A · up to 25 MB' : 'JPEG, PNG, or WebP · up to 10 MB'}
      </small>
      {error && (
        <p className="media-upload-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
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
  const [usage, setUsage] = useState(0);
  const image =
    content.image ?? (content.media && content.medium !== 'audio' ? content.media : undefined);
  const audio =
    content.audio ?? (content.media && content.medium === 'audio' ? content.media : undefined);
  useEffect(() => {
    void mediaUsage()
      .then((v) => setUsage(v.used_bytes + v.reserved_bytes))
      .catch(() => {});
  }, [image?.uploadId, audio?.uploadId]);
  return (
    <section className="media-upload-field" aria-labelledby="attachments-heading">
      <div className="media-upload-heading">
        <div>
          <span className="eyebrow" id="attachments-heading">
            Attachments
          </span>
          <p>Add an image, audio, text, or combine all three.</p>
        </div>
        <span>
          {megabytes(usage)} of {megabytes(MEDIA_QUOTA)} used
        </span>
      </div>
      <div className="media-attachment-grid">
        <Attachment
          kind="image"
          media={image}
          pieceId={pieceId}
          disabled={disabled}
          onChange={(image) => onChange({ ...content, image, media: undefined, medium: undefined })}
        />
        <Attachment
          kind="audio"
          media={audio}
          pieceId={pieceId}
          disabled={disabled}
          onChange={(audio) => onChange({ ...content, audio, media: undefined, medium: undefined })}
        />
      </div>
    </section>
  );
}
