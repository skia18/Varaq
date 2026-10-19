// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { PublicDirectory } from '@/features/discovery/PublicDirectory';
const mocks = vi.hoisted(() => ({ search: vi.fn(), collections: vi.fn() }));
vi.mock('@/lib/api', () => ({
  searchPersonas: mocks.search,
  getPersonaCollections: mocks.collections,
}));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  mocks.search.mockReset();
  mocks.collections.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount(element: React.ReactNode) {
  await act(async () => root.render(<MemoryRouter>{element}</MemoryRouter>));
  await act(async () => vi.advanceTimersByTimeAsync(300));
}
test('writers open their walls and pagination retains earlier writers', async () => {
  mocks.search
    .mockResolvedValueOnce({
      items: [{ id: 'one', handle: 'poet', displayName: 'Poet', bio: 'A little writing' }],
      nextCursor: 'next',
    })
    .mockResolvedValueOnce({
      items: [{ id: 'two', handle: 'reader', displayName: 'Reader', bio: null }],
      nextCursor: null,
    });
  await mount(<PublicDirectory query="po" />);
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/wall/poet');
  await act(async () => host.querySelector('button')!.click());
  expect(mocks.search).toHaveBeenLastCalledWith('po', { cursor: 'next' });
  expect(host.textContent).toContain('Poet');
  expect(host.textContent).toContain('Reader');
  expect(host.querySelector('button')).toBeNull();
});
test('collections show public counts and open shared detail pages', async () => {
  mocks.collections.mockResolvedValue({
    items: [
      { id: 'collection', name: 'Night pages', description: 'For late nights', pieceCount: 2 },
    ],
    nextCursor: null,
  });
  await mount(<PublicDirectory handle="poet" />);
  expect(host.textContent).toContain('2 pieces');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/collections/collection');
});
test('a query change ignores a previous search response', async () => {
  let finish!: (value: unknown) => void;
  mocks.search
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  await mount(<PublicDirectory key="old" query="old" />);
  await mount(<PublicDirectory key="new" query="new" />);
  await act(async () =>
    finish({ items: [{ id: 'old', handle: 'old', displayName: 'Old writer' }], nextCursor: null }),
  );
  expect(host.textContent).toContain('No writers found');
  expect(host.textContent).not.toContain('Old writer');
});
test('initial errors can be retried and empty collections have an explicit state', async () => {
  mocks.collections
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  await mount(<PublicDirectory handle="poet" />);
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => host.querySelector('button')!.click());
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(host.textContent).toContain('No public collections here yet.');
});
