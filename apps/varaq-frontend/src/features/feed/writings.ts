import type { FeedPiece, PieceMedium, PieceType, TrailRelation } from '@/lib/api';
import { publicMediaUrl } from '@/features/media/storage';

export type WritingForm = 'Poems' | 'Short stories' | 'Essays' | 'Letters' | 'Fragments';
export type WritingTone = 'paper' | 'sage' | 'red' | 'plain' | 'blue' | 'blush' | 'ochre';
export type Writing = {
  id: string;
  title: string;
  author: string;
  handle: string;
  form: WritingForm;
  excerpt: string;
  body: string;
  date: string;
  minutes: number;
  tone: WritingTone;
  medium: PieceMedium;
  imageUrl?: string;
  imageAlt?: string;
  audioUrl?: string;
  coverUrl?: string;
  audioDuration?: number;
  credits?: string[];
  respondsTo?: { pieceId: string; relation: TrailRelation };
};
export const forms: Record<PieceType, WritingForm> = {
  poem: 'Poems',
  story: 'Short stories',
  essay: 'Essays',
  letter: 'Letters',
  fragment: 'Fragments',
};
export function toWriting(piece: FeedPiece): Writing {
  const storedMediaUrl = piece.mediaPath ? publicMediaUrl(piece.mediaPath) : undefined;
  return {
    id: piece.id,
    title: piece.title,
    author: piece.author,
    handle: piece.handle,
    form: forms[piece.type],
    body: piece.body,
    excerpt: piece.body.length > 240 ? `${piece.body.slice(0, 240)}…` : piece.body,
    date: new Date(piece.publishedAt ?? piece.createdAt).toLocaleDateString(),
    minutes: Math.max(1, Math.ceil(piece.body.trim().split(/\s+/).length / 200)),
    tone: 'paper',
    medium: piece.medium ?? 'writing',
    imageUrl:
      piece.imageUrl ??
      (piece.medium === 'photography' || piece.medium === 'artwork' ? storedMediaUrl : undefined),
    imageAlt: piece.imageAlt ?? undefined,
    audioUrl: piece.audioUrl ?? (piece.medium === 'audio' ? storedMediaUrl : undefined),
    coverUrl: piece.coverUrl ?? undefined,
    audioDuration: piece.audioDuration ?? undefined,
    credits: piece.credits,
    respondsTo: piece.respondsTo ?? undefined,
  };
}

export function mediumLabel(medium: PieceMedium) {
  if (medium === 'photography') return 'Photograph';
  if (medium === 'artwork') return 'Artwork';
  if (medium === 'audio') return 'Audio';
  return 'Writing';
}

export function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
