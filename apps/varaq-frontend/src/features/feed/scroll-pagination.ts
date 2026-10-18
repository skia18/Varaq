export function shouldLoadOnScroll(
  previousY: number,
  currentY: number,
  bottom: number,
  viewport: number,
) {
  return currentY > previousY && bottom <= viewport + 300;
}

// Framework-independent so pagination triggers and request races can be tested.
export function createScrollPager<T>({
  fetchPage,
  onPage,
  onLoading,
  onError,
  initialY,
}: {
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>;
  onPage: (page: { items: T[]; nextCursor: string | null }) => void;
  onLoading: (loading: boolean) => void;
  onError: () => void;
  initialY: number;
}) {
  let active = true;
  let pending = false;
  let started = false;
  let cursor: string | null = null;
  let previousY = initialY;
  async function load(initial: boolean) {
    if (!active || pending || (!initial && !cursor)) return;
    pending = true;
    onLoading(true);
    try {
      const page = await fetchPage(cursor);
      if (!active) return;
      cursor = page.nextCursor;
      onPage(page);
    } catch {
      if (active) onError();
    } finally {
      pending = false;
      if (active) onLoading(false);
    }
  }
  return {
    start() {
      if (!started) {
        started = true;
        return load(true);
      }
    },
    onScroll(currentY: number, bottom: number, viewport: number) {
      const shouldLoad = shouldLoadOnScroll(previousY, currentY, bottom, viewport);
      previousY = currentY;
      if (shouldLoad) return load(false);
    },
    onScrollIntent(downward: boolean, bottom: number, viewport: number, documentHeight: number) {
      // Fallback only when the document cannot generate a real scroll event.
      if (downward && documentHeight <= viewport + 1 && bottom <= viewport + 300)
        return load(false);
    },
    dispose() {
      active = false;
    },
  };
}
