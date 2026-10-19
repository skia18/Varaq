// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { CollectionsProvider } from '@/features/collections/CollectionsContext';
import { BookmarkPicker } from '@/features/collections/BookmarkPicker';
const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  user: { id: 'user' } as { id: string } | null,
}));
vi.mock('@/lib/api', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.user = { id: 'user' };
  mocks.apiRequest.mockImplementation(async (_path: string, options?: RequestInit) =>
    options
      ? undefined
      : [
          {
            id: 'saved',
            name: 'Saved',
            description: '',
            systemType: 'saved',
            visibility: 'private',
            pieceIds: [],
          },
          {
            id: 'custom',
            name: 'After Midnight',
            description: '',
            systemType: null,
            visibility: 'private',
            pieceIds: [],
          },
        ],
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <CollectionsProvider>
          <BookmarkPicker pieceId="piece" />
        </CollectionsProvider>
      </MemoryRouter>,
    ),
  );
}
async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => (element as HTMLElement).click());
}
function checkbox(name: string) {
  return Array.from(document.querySelectorAll('.bookmark-popover label'))
    .find((label) => label.textContent?.includes(name))
    ?.querySelector('input') as HTMLInputElement;
}
test('opening bookmarks saves once, allows independent memberships, and reopening preserves them', async () => {
  await mount();
  await click(host.querySelector('[aria-label="Save and organize piece"]'));
  expect(checkbox('Saved').checked).toBe(true);
  expect(mocks.apiRequest).toHaveBeenCalledWith('/api/v1/collections/saved/pieces/piece', {
    method: 'PUT',
  });
  await click(checkbox('After Midnight'));
  await click(checkbox('Saved'));
  expect(checkbox('Saved').checked).toBe(false);
  expect(checkbox('After Midnight').checked).toBe(true);
  await click(
    Array.from(document.querySelectorAll('.bookmark-popover button')).find(
      (b) => b.textContent === 'Done',
    )!,
  );
  const before = mocks.apiRequest.mock.calls.length;
  await click(host.querySelector('[aria-label="Save and organize piece"]'));
  expect(mocks.apiRequest.mock.calls.length).toBe(before);
  expect(checkbox('Saved').checked).toBe(false);
  expect(checkbox('After Midnight').checked).toBe(true);
  expect(host.querySelector('.is-active')).not.toBeNull();
});
test('failed save shows feedback and retains unchecked membership', async () => {
  await mount();
  mocks.apiRequest.mockRejectedValueOnce(new Error('offline'));
  await click(host.querySelector('[aria-label="Save and organize piece"]'));
  expect(checkbox('Saved').checked).toBe(false);
  expect(document.querySelector('.bookmark-popover [role="status"]')?.textContent).toContain(
    'Could not update',
  );
});
test('new collection includes the piece in the create request and starts private', async () => {
  await mount();
  await click(host.querySelector('[aria-label="Save and organize piece"]'));
  await click(
    Array.from(document.querySelectorAll('.bookmark-popover button')).find(
      (b) => b.textContent?.trim() === 'New collection',
    )!,
  );
  const name = document.querySelector(
    '.bookmark-popover input[maxlength="100"]',
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      name,
      'Words to Return To',
    );
    name.dispatchEvent(new Event('input', { bubbles: true }));
  });
  mocks.apiRequest.mockResolvedValueOnce({
    id: 'new',
    name: 'Words to Return To',
    description: '',
    systemType: null,
    visibility: 'private',
    pieceIds: ['piece'],
  });
  await act(async () =>
    document
      .querySelector('.bookmark-popover form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  expect(mocks.apiRequest).toHaveBeenLastCalledWith('/api/v1/collections', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Words to Return To',
      description: '',
      visibility: 'private',
      pieceId: 'piece',
    }),
  });
  expect(checkbox('Words to Return To').checked).toBe(true);
});
test('sign out immediately hides the previous account collections', async () => {
  await mount();
  await click(host.querySelector('[aria-label="Save and organize piece"]'));
  mocks.user = null;
  await mount();
  expect(document.body.textContent).not.toContain('After Midnight');
  expect(document.body.textContent).toContain('Sign in');
});

test('picker stays in the viewport outside transformed cards and closes with Escape', async () => {
  await mount();
  const trigger = host.querySelector('[aria-label="Save and organize piece"]') as HTMLButtonElement;
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    left: 900,
    right: 932,
    top: 700,
    bottom: 732,
    width: 32,
    height: 32,
    x: 900,
    y: 700,
    toJSON() {},
  });
  await click(trigger);
  const panel = document.querySelector('.bookmark-popover') as HTMLElement;
  expect(host.contains(panel)).toBe(false);
  expect(panel.parentElement).toBe(document.body);
  expect(panel.style.bottom).toBe('76px');
  expect(Number.parseFloat(panel.style.left)).toBeGreaterThanOrEqual(16);
  expect(document.activeElement).toBe(panel);
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  expect(document.querySelector('.bookmark-popover')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test('clicks inside the picker preserve it; clicks outside dismiss it', async () => {
  await mount();
  await click(host.querySelector('[aria-label="Save and organize piece"]'));
  await act(async () =>
    document
      .querySelector('.bookmark-popover h2')!
      .dispatchEvent(new Event('pointerdown', { bubbles: true })),
  );
  expect(document.querySelector('.bookmark-popover')).not.toBeNull();
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(document.querySelector('.bookmark-popover')).toBeNull();
});
