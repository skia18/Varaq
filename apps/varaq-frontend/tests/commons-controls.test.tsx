// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { CommonsControls } from '@/features/feed/CommonsControls';
import type { FeedCategoryId } from '@/features/feed/categories';

let host: HTMLDivElement | undefined;
let root: Root | undefined;

function ControlsHarness() {
  const [selectedCategory, setSelectedCategory] = useState<FeedCategoryId>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [trailsActive, setTrailsActive] = useState(false);
  return (
    <CommonsControls
      selectedCategory={selectedCategory}
      filtersOpen={filtersOpen}
      trailsActive={trailsActive}
      onCategoryChange={setSelectedCategory}
      onFiltersOpenChange={setFiltersOpen}
      onTrailsActiveChange={setTrailsActive}
    />
  );
}

function button(label: string) {
  const element = [...(host?.querySelectorAll('button') ?? [])].find(
    (candidate) =>
      candidate.getAttribute('aria-label') === label || candidate.textContent?.includes(label),
  );
  if (!element) throw new Error(`Expected the ${label} button to exist.`);
  return element;
}

beforeEach(async () => {
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
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(<ControlsHarness />));
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('filters unfold into the fixed category icon set and retain the selection', async () => {
  expect(button('Filters').getAttribute('aria-expanded')).toBe('false');
  await act(async () => button('Filters').click());

  expect(button('Filters').getAttribute('aria-expanded')).toBe('true');
  expect(host?.querySelectorAll('.category-filter')).toHaveLength(9);

  await act(async () => button('Poems').click());
  expect(button('Poems').getAttribute('aria-pressed')).toBe('true');
  expect(button('Poems').textContent).toContain('Poems');
});

test('Trails visibly activates and folds the category control away', async () => {
  await act(async () => button('Filters').click());
  await act(async () => button('Trails').click());

  expect(button('Trails').getAttribute('aria-pressed')).toBe('true');
  expect(button('Filters').getAttribute('aria-expanded')).toBe('false');
  expect(host?.querySelector('.trails-active-dot')).not.toBeNull();
});

test('category labels wait for hover intent before expanding', async () => {
  await act(async () => button('Filters').click());
  const essays = button('Essays');
  vi.useFakeTimers();

  await act(async () => essays.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  expect(essays.textContent).not.toContain('Essays');

  await act(async () => vi.advanceTimersByTimeAsync(159));
  expect(essays.textContent).not.toContain('Essays');

  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(essays.textContent).toContain('Essays');
});

test('mobile filters unfold as a vertical stack of desktop-style labelled pills', async () => {
  await act(async () => root?.unmount());
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 680px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  root = createRoot(host!);
  await act(async () => root?.render(<ControlsHarness />));
  await act(async () => button('Filters').click());

  expect(host?.querySelector('.filter-control.is-mobile')).not.toBeNull();
  const panel = host?.querySelector('.category-filter-list');
  expect(panel).not.toBeNull();
  for (const label of ['All pages', 'Poems', 'Short stories', 'Photography', 'Audio']) {
    expect(panel?.textContent).toContain(label);
  }
});
