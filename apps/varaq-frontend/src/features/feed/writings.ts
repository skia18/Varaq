import type { FeedPiece, PieceType } from '@/lib/api';

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
};
export const forms: Record<PieceType, WritingForm> = {
  poem: 'Poems',
  story: 'Short stories',
  essay: 'Essays',
  letter: 'Letters',
  fragment: 'Fragments',
};
export function toWriting(piece: FeedPiece): Writing {
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
  };
}
