import artLamp from '@/assets/media-demo/art-lamp.jpg';
import coverRockBeat from '@/assets/media-demo/cover-rock-beat.jpg';
import photoThreshold from '@/assets/media-demo/photo-threshold.jpg';
import rockBeat from '@/assets/media-demo/rock-beat.mp3';
import type { Writing } from './writings';

export const mediaDemoWritings: Writing[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Threshold of evening',
    author: 'noor',
    handle: 'noor',
    form: 'Fragments',
    excerpt: 'An open door at dusk. The kettle still knows who it pours for.',
    body: 'An open door at dusk.\n\nThe kettle sat where it always sat, and the day ended the way it has ended for years — slowly, then all at once, with the hills going quiet and the tiles keeping the last of the warmth.\n\nI photographed this the evening after I understood that some rooms only exist because someone keeps arriving at their door.',
    date: 'Design preview',
    minutes: 1,
    tone: 'paper',
    medium: 'photography',
    imageUrl: photoThreshold,
    imageAlt:
      'An open wooden door at dusk with warm light on terracotta tiles, a kettle and cup on a small table',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    title: 'A lamp, remembered',
    author: 'the moth',
    handle: 'the-moth',
    form: 'Fragments',
    excerpt: 'Painted from memory, after a poem about words that go missing between languages.',
    body: 'Painted from memory, after a poem about words that go missing between languages.\n\nThe flame is the only part I did not paint twice. Everything else — the brass, the dark, the torn edges of the paper — I kept redoing until it looked forgotten enough.',
    date: 'Design preview',
    minutes: 1,
    tone: 'paper',
    medium: 'artwork',
    imageUrl: artLamp,
    imageAlt:
      'Mixed-media artwork of a small brass oil lamp with an oxide-red flame on torn warm paper',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    title: 'Voltage in the margins',
    author: 'aarya',
    handle: 'aarya',
    form: 'Fragments',
    excerpt: 'A raw rock beat—restless drums, overdriven edges, and nowhere quiet to land.',
    body: 'A raw rock beat built for the moment a quiet page tears open.\n\nThe rhythm keeps pressing forward while the rough edges stay visible: loud, unfinished, and alive.',
    date: 'Design preview',
    minutes: 1,
    tone: 'paper',
    medium: 'audio',
    coverUrl: coverRockBeat,
    audioUrl: rockBeat,
    audioDuration: 58,
    credits: ['Rock beat · original demo track', 'Cover artwork · Varaq mixed-media study'],
  },
];
