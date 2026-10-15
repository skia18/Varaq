export type WritingForm =
  | 'Poems'
  | 'Short stories'
  | 'Essays'
  | 'Letters'
  | 'Fragments';

export type WritingTone = 'paper' | 'sage' | 'red' | 'photo' | 'plain';

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
  appreciations: number;
  tone: WritingTone;
};

export const writings: Writing[] = [
  {
    id: '1',
    title: 'Things the house remembers',
    author: 'noor',
    handle: 'noor',
    form: 'Poems',
    excerpt:
      'The door still opens\nas if you might arrive.\n\nThe kettle learns\na smaller kind of song.\n\nAnd the house —\nthe house keeps your silence\nin all the rooms\nI no longer enter.',
    body:
      'The door still opens\nas if you might arrive.\n\nThe kettle learns\na smaller kind of song.\n\nAnd the house —\nthe house keeps your silence\nin all the rooms\nI no longer enter.\n\nI leave one light on.\nNot for you, anymore.\nFor the part of me\nthat still comes home with you.',
    date: '2 hours ago',
    minutes: 2,
    appreciations: 128,
    tone: 'paper',
  },
  {
    id: '2',
    title: 'A small theory of staying',
    author: 'the moth',
    handle: 'the-moth',
    form: 'Fragments',
    excerpt:
      'Perhaps belonging is not\na place, but the people\nwho notice when\nyou go quiet.',
    body:
      'Perhaps belonging is not\na place, but the people\nwho notice when\nyou go quiet.\n\nThe ones who make room for your silence,\nwithout asking it to become something else.',
    date: '4 hours ago',
    minutes: 1,
    appreciations: 86,
    tone: 'sage',
  },
  {
    id: '3',
    title: 'The light we leave on',
    author: 'aarya',
    handle: 'aarya',
    form: 'Essays',
    excerpt:
      'My mother never called it waiting. She just left the light on.',
    body:
      'My mother never called it waiting. She just left the light on.\n\nEvery evening, the same small ritual: a hand reaching for the switch, the hallway turning gold, a cup set beside the kettle. I thought these were ordinary things. I thought love would announce itself more clearly.\n\nIt took moving away to understand that a light can be a sentence. That a cup can be a question. That some people say come home without ever saying the words.\n\nNow, in a city she has never visited, I leave a light on too.',
    date: 'Yesterday',
    minutes: 4,
    appreciations: 204,
    tone: 'photo',
  },
  {
    id: '4',
    title: 'Dear almost',
    author: 'ink & ash',
    handle: 'ink-and-ash',
    form: 'Letters',
    excerpt:
      'I am writing to the version of us that never happened. The one that caught the train. The one that said the thing.\n\nI hope you are well.',
    body:
      'Dear almost,\n\nI am writing to the version of us that never happened. The one that caught the train. The one that said the thing.\n\nI hope you are well. I hope the apartment has a window facing east. I hope you still buy flowers on Tuesdays, even when there is no occasion.\n\nHere, things are quieter. Not worse. Just different.\n\nYours, in another life.',
    date: '5 hours ago',
    minutes: 3,
    appreciations: 67,
    tone: 'plain',
  },
  {
    id: '5',
    title: 'In another language',
    author: 'noor',
    handle: 'noor',
    form: 'Poems',
    excerpt:
      'There is a word\nin my mother’s tongue\nfor the ache of a place\nyou can no longer return to.\n\nI have forgotten the word.\nI have not forgotten the ache.',
    body:
      'There is a word\nin my mother’s tongue\nfor the ache of a place\nyou can no longer return to.\n\nI have forgotten the word.\nI have not forgotten the ache.\n\nSome nights I say it\nwithout making a sound.',
    date: 'Yesterday',
    minutes: 2,
    appreciations: 93,
    tone: 'red',
  },
  {
    id: '6',
    title: 'The last bookshop on the street',
    author: 'aarya',
    handle: 'aarya',
    form: 'Short stories',
    excerpt:
      'Every Thursday, the old man bought the same book. Every Friday, he brought it back. On the seventh week, I finally asked him why.',
    body:
      'Every Thursday, the old man bought the same book. Every Friday, he brought it back. On the seventh week, I finally asked him why.\n\n“My wife wrote a note in a copy once,” he said. “I’m trying to find it.”\n\nI looked at the shelves. At the hundreds of stories, waiting patiently for someone to open them.\n\n“Then let’s start at the beginning,” I said.\n\nHe smiled. Outside, the rain stopped.',
    date: 'Yesterday',
    minutes: 5,
    appreciations: 156,
    tone: 'paper',
  },
];