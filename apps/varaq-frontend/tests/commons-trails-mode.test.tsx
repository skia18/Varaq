// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { HomePage } from '@/pages/home/HomePage';

const mocks = vi.hoisted(() => ({
  publicFeed: vi.fn(),
  trailStarts: vi.fn(),
}));

vi.mock('@/features/feed/usePublicFeed', () => ({ usePublicFeed: mocks.publicFeed }));
vi.mock('@/features/feed/useTrailStarts', () => ({ useTrailStarts: mocks.trailStarts }));
vi.mock('@/features/feed/FeedStatus', () => ({ FeedStatus: () => null }));
vi.mock('@/components/literary/ReadingDialog', () => ({ ReadingDialog: () => null }));
vi.mock('@/features/feed/FeedGrid', () => ({
  FeedGrid: ({
    writings,
    ariaLabel,
    hrefForWriting,
  }: {
    writings: Array<{ id: string; title: string }>;
    ariaLabel?: string;
    hrefForWriting?: (writing: { id: string; title: string }) => string;
  }) => (
    <section aria-label={ariaLabel}>
      {writings.map((writing) => (
        <a href={hrefForWriting?.(writing)} key={writing.id}>
          {writing.title}
        </a>
      ))}
    </section>
  ),
}));

let host: HTMLDivElement | undefined;
let root: Root | undefined;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  mocks.publicFeed.mockReturnValue({ items: [], isLoading: false, error: null });
  mocks.trailStarts.mockReturnValue({
    items: [
      {
        root: {
          id: 'trail-root',
          personaId: 'persona',
          slug: 'the-beginning',
          title: 'The beginning',
          body: 'The first page in a longer conversation.',
          type: 'fragment',
          status: 'published',
          visibility: 'public',
          medium: 'writing',
          createdAt: '2026-11-06T10:00:00Z',
          updatedAt: '2026-11-06T10:00:00Z',
          publishedAt: '2026-11-06T10:00:00Z',
          author: 'A Writer',
          handle: 'writer',
        },
        pieceCount: 3,
        updatedAt: '2026-11-06T10:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
    retry: vi.fn(),
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  vi.unstubAllGlobals();
});

test('Trails mode renders originating Post-its that open their Trail', async () => {
  await act(async () =>
    root?.render(
      <MemoryRouter initialEntries={['/?view=trails']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    ),
  );

  expect(mocks.trailStarts).toHaveBeenCalledWith(true);
  expect(host?.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Trails');
  const trailLink = host?.querySelector('section[aria-label="Trail beginnings"] a');
  expect(trailLink?.textContent).toBe('The beginning');
  expect(trailLink?.getAttribute('href')).toBe('/trail/trail-root?from=trails');
});
