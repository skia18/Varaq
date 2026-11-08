// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SearchDialog } from '@/components/navigation/SearchDialog';

const mocks = vi.hoisted(() => ({ getFeed: vi.fn() }));
vi.mock('@/lib/api', () => ({ getFeed: mocks.getFeed }));
vi.mock('@/features/discovery/PublicDirectory', () => ({ PublicDirectory: () => null }));
vi.mock('@/components/navigation/SearchResults', () => ({
  SearchResults: ({ query }: { query: string }) => <p data-testid="query">{query}</p>,
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('scrollTo', vi.fn());
  mocks.getFeed.mockResolvedValue({ items: [], nextCursor: null });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(open: boolean, onClose = vi.fn()) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <button type="button">Search opener</button>
        <SearchDialog open={open} onClose={onClose} />
      </MemoryRouter>,
    );
  });
  return onClose;
}

test('focuses the query, skips empty searches, and closes with Escape', async () => {
  await render(false);
  const opener = host.querySelector('button')!;
  opener.focus();
  const onClose = await render(true);
  const input = document.querySelector<HTMLInputElement>('[aria-label="Search published writing"]');
  expect(document.activeElement).toBe(input);

  await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
  expect(mocks.getFeed).not.toHaveBeenCalled();

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(onClose).toHaveBeenCalledOnce();
  await render(false, onClose);
  expect(document.activeElement).toBe(opener);
});
