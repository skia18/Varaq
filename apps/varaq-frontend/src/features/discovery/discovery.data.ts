export type PieceType = 'poem' | 'fragment' | 'story' | 'letter' | 'essay';

export type LiteraryPiece = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  handle: string;
  type: PieceType;
  themes: string[];
  readingTime: number;
};

export const discoveryPieces: LiteraryPiece[] = [
  {
    id: '1',
    slug: 'on-returning',
    title: 'On returning',
    excerpt:
      'Some places remember us differently. We return carrying years they never witnessed, hoping the doors will recognise our hands.',
    author: 'The Quiet Atlas',
    handle: 'quietatlas',
    type: 'essay',
    themes: ['memory', 'belonging'],
    readingTime: 4,
  },
  {
    id: '2',
    slug: 'the-quiet-between',
    title: 'The quiet between',
    excerpt:
      'There is a language in the pauses, in the unfinished sentence, in the space where your name almost becomes a prayer.',
    author: 'Paper Moon',
    handle: 'papermoon',
    type: 'poem',
    themes: ['longing', 'silence'],
    readingTime: 2,
  },
  {
    id: '3',
    slug: 'a-small-letter',
    title: 'A small letter',
    excerpt:
      'I have stopped trying to explain the weather inside me. Today, I only wanted to tell you that the jasmine has bloomed.',
    author: 'Ink & Ash',
    handle: 'inkandash',
    type: 'letter',
    themes: ['love', 'ordinary life'],
    readingTime: 3,
  },
  {
    id: '4',
    slug: 'things-we-keep',
    title: 'Things we keep',
    excerpt:
      'A ticket folded four times. A sentence from a stranger. The key to a house that no longer exists.',
    author: 'Almost August',
    handle: 'almostaugust',
    type: 'fragment',
    themes: ['memory', 'loss'],
    readingTime: 1,
  },
  {
    id: '5',
    slug: 'the-last-train',
    title: 'The last train home',
    excerpt:
      'At the final station, a boy held a paper bag of oranges as if it contained everything he had promised to bring back.',
    author: 'Northbound',
    handle: 'northbound',
    type: 'story',
    themes: ['belonging', 'change'],
    readingTime: 5,
  },
  {
    id: '6',
    slug: 'learning-to-stay',
    title: 'Learning to stay',
    excerpt:
      'Perhaps courage is not the departure or the arrival, but the quiet decision to remain when leaving would be easier.',
    author: 'The Quiet Atlas',
    handle: 'quietatlas',
    type: 'essay',
    themes: ['change', 'belonging'],
    readingTime: 4,
  },
];

export const pieceTypes: Array<'all' | PieceType> = [
  'all',
  'poem',
  'fragment',
  'story',
  'letter',
  'essay',
];

export const discoveryThemes = [
  'memory',
  'longing',
  'belonging',
  'love',
  'silence',
  'loss',
  'change',
  'ordinary life',
];
