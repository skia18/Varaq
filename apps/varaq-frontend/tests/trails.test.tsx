// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { TrailGraphView, TrailTeaser } from '@/components/literary/TrailView';

let host: HTMLDivElement;
let root: Root;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});
async function render(node: ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(node));
}

const base = {
  personaId: 'persona',
  slug: 'page',
  type: 'fragment' as const,
  status: 'published' as const,
  visibility: 'public' as const,
  medium: 'writing' as const,
  publishedAt: '2026-11-04T10:00:00Z',
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
  author: 'a quiet stranger',
  handle: 'quiet',
};
const graph = {
  rootId: 'source',
  nodes: [
    { ...base, id: 'source', title: 'The first page', body: 'A beginning.' },
    { ...base, id: 'response', title: 'What followed', body: 'An answer.' },
  ],
  edges: [{ sourceId: 'source', responseId: 'response', relation: 'inspired-by' as const }],
};

test('piece teaser exposes viewing, new response, and existing-piece actions', async () => {
  await render(
    <MemoryRouter>
      <TrailTeaser graph={graph} pieceId="source" />
    </MemoryRouter>,
  );
  const links = [...host.querySelectorAll('a')];
  expect(
    links.find((link) => /explore this trail/i.test(link.textContent ?? ''))?.getAttribute('href'),
  ).toBe('/trail/source');
  expect(
    links.find((link) => /create a response/i.test(link.textContent ?? ''))?.getAttribute('href'),
  ).toBe('/write?respondTo=source');
  expect(
    links
      .find((link) => /add an existing piece/i.test(link.textContent ?? ''))
      ?.getAttribute('href'),
  ).toBe('/wall/manage/edit?respondTo=source');
});

test('trail view renders source, response, and relationship label', async () => {
  await render(
    <MemoryRouter>
      <TrailGraphView graph={graph} />
    </MemoryRouter>,
  );
  expect(host.textContent).toContain('The first page');
  expect(host.textContent).toContain('What followed');
  expect(host.textContent).toContain('Inspired by');
});
