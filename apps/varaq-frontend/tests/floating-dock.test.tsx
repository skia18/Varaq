// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { FloatingDock } from '@/components/navigation/SiteHeader';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  lock: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/auth/AuthProvider', () => ({ useAuth: mocks.auth }));
vi.mock('@/features/vault/VaultProvider', () => ({
  useVault: () => ({ lock: mocks.lock }),
}));
vi.mock('@/components/navigation/SearchDialog', () => ({
  SearchDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Search writing</div> : null,
}));

let host: HTMLDivElement | undefined;
let root: Root | undefined;

function requireElement<T extends Element>(element: T | null, description: string): T {
  if (!element) throw new Error(`Expected ${description} to exist.`);
  return element;
}

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
  mocks.lock.mockReset();
  mocks.signOut.mockReset();
  mocks.auth.mockReturnValue({
    user: null,
    persona: null,
    isLoading: false,
    isPersonaLoading: false,
    signOut: mocks.signOut,
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

async function render(node: ReactNode, route = '/') {
  if (!root) throw new Error('Test root was not created.');
  await act(async () => root?.render(<MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>));
}

test('dock contains the complete phase-one navigation and marks the current route', async () => {
  mocks.auth.mockReturnValue({
    user: { email: 'writer@example.com' },
    persona: { handle: 'quiet-writer', displayName: 'Quiet Writer' },
    isLoading: false,
    isPersonaLoading: false,
    signOut: mocks.signOut,
  });

  await render(<FloatingDock />, '/collections');

  if (!host) throw new Error('Test host was not created.');
  const mainNavigation = requireElement(
    host.querySelector('nav[aria-label="Main navigation"]'),
    'main navigation',
  );
  const destinations = [...mainNavigation.querySelectorAll('a')].map((link) =>
    link.getAttribute('href'),
  );
  expect(destinations).toEqual(['/', '/trails', '/collections', '/wall/quiet-writer', '/vault']);
  expect(mainNavigation.querySelector('a.is-active')?.getAttribute('href')).toBe('/collections');
  expect(host.querySelector('a[href="/write"]')).not.toBeNull();
});

test('search and account actions remain available from the dock', async () => {
  await render(<FloatingDock />);

  if (!host) throw new Error('Test host was not created.');
  const searchButton = requireElement(
    host.querySelector<HTMLButtonElement>('button[aria-label="Search writing"]'),
    'search button',
  );
  await act(async () => searchButton.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe('Search writing');

  const accountButton = requireElement(
    host.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]'),
    'account button',
  );
  await act(async () => accountButton.click());
  expect(host.querySelector('[role="menu"] a')?.getAttribute('href')).toBe('/login');
});
