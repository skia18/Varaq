import { createClient } from '@/lib/supabase/client';
import type { DraftMedia, DraftMedium } from '@/features/vault/crypto';

export const MEDIA_BUCKET = 'varaq-media-private' as const;
export const PUBLIC_MEDIA_BUCKET = 'varaq-media-public' as const;
export const MEDIA_QUOTA = 250 * 1024 * 1024;

type QuotaRow = { used_bytes: number; reserved_bytes: number; quota_bytes: number };
type ReservationRow = QuotaRow & { upload_id: string; object_path: string };

function extensionFor(file: File) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error('This file type is not supported.');
  return extension;
}

function firstRow<T>(data: T[] | T | null): T {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Storage did not return the expected result.');
  return row;
}

export function validateMediaFile(file: File, medium: Exclude<DraftMedium, 'writing'>) {
  const image = medium === 'photography' || medium === 'artwork';
  const allowed = image
    ? ['image/jpeg', 'image/png', 'image/webp']
    : ['audio/mpeg', 'audio/wav', 'audio/mp4'];
  const limit = image ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
  if (!allowed.includes(file.type))
    throw new Error(
      image ? 'Choose a JPEG, PNG, or WebP image.' : 'Choose an MP3, WAV, or M4A audio file.',
    );
  if (file.size < 1 || file.size > limit)
    throw new Error(`The file must be smaller than ${image ? '10 MB' : '25 MB'}.`);
}

async function validateAudioDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error('The audio file could not be read.'));
      audio.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error('The audio duration is invalid.');
    if (duration > 600) throw new Error('Audio must be 10 minutes or shorter.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function mediaUsage() {
  const { data, error } = await createClient().rpc('get_media_usage');
  if (error) throw error;
  return firstRow(data as QuotaRow[] | null);
}

export async function uploadDraftMedia(
  pieceId: string,
  medium: Exclude<DraftMedium, 'writing'>,
  file: File,
) {
  validateMediaFile(file, medium);
  if (medium === 'audio') await validateAudioDuration(file);
  const client = createClient();
  const { data: reserved, error: reserveError } = await client.rpc('reserve_media_upload', {
    p_piece_id: pieceId,
    p_kind: medium,
    p_byte_size: file.size,
    p_mime_type: file.type,
    p_extension: extensionFor(file),
  });
  if (reserveError) throw reserveError;
  const reservation = firstRow(reserved as ReservationRow[] | null);
  const media: DraftMedia = {
    uploadId: reservation.upload_id,
    bucket: MEDIA_BUCKET,
    path: reservation.object_path,
    mimeType: file.type,
    byteSize: file.size,
    originalName: file.name,
  };
  try {
    const { data: authorized, error: authorizationError } = await client.rpc(
      'can_upload_reserved_media',
      {
        p_bucket_id: MEDIA_BUCKET,
        p_object_path: media.path,
        p_metadata: { contentLength: file.size, mimetype: file.type },
      },
    );
    if (authorizationError) throw authorizationError;
    if (!authorized)
      throw new Error('The upload reservation was not authorized. Sign in again and retry.');
    const { error: uploadError } = await client.storage
      .from(MEDIA_BUCKET)
      .upload(media.path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const { error: finalizeError } = await client.rpc('finalize_media_upload', {
      p_upload_id: media.uploadId,
    });
    if (finalizeError) throw finalizeError;
    return media;
  } catch (error) {
    await client.storage.from(MEDIA_BUCKET).remove([media.path]);
    await client.rpc('release_media_upload', { p_upload_id: media.uploadId });
    throw error;
  }
}

export async function removeDraftMedia(media: DraftMedia) {
  const client = createClient();
  const { error } = await client.storage.from(media.bucket).remove([media.path]);
  if (error) throw error;
  const { error: releaseError } = await client.rpc('release_media_upload', {
    p_upload_id: media.uploadId,
  });
  if (releaseError) throw releaseError;
}

export async function signedMediaUrl(media: DraftMedia) {
  const { data, error } = await createClient()
    .storage.from(media.bucket)
    .createSignedUrl(media.path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function copyMediaForPublication(media: DraftMedia) {
  const { error } = await createClient()
    .storage.from(media.bucket)
    .copy(media.path, media.path, { destinationBucket: PUBLIC_MEDIA_BUCKET });
  if (error && !/already exists/i.test(error.message)) throw error;
  return media.path;
}

export async function removePrivateMediaSource(media: DraftMedia) {
  const { error } = await createClient().storage.from(media.bucket).remove([media.path]);
  if (error) throw error;
}

export async function copyPublishedMediaToPrivate(path: string) {
  const { error } = await createClient()
    .storage.from(PUBLIC_MEDIA_BUCKET)
    .copy(path, path, { destinationBucket: MEDIA_BUCKET });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function removePublicMediaSource(path: string) {
  const { error } = await createClient().storage.from(PUBLIC_MEDIA_BUCKET).remove([path]);
  if (error) throw error;
}

export function publicMediaUrl(path: string) {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
