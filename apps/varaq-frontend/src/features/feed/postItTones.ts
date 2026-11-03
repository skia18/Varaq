import type { WritingTone } from './writings';

export const POST_IT_TONES = [
  'paper',
  'sage',
  'blush',
  'blue',
  'ochre',
  'paper',
  'red',
  'sage',
  'blue',
  'blush',
] as const satisfies readonly WritingTone[];

export function postItTone(index: number): WritingTone {
  return POST_IT_TONES[index % POST_IT_TONES.length];
}
