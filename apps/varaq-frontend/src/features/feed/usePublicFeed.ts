import { useEffect, useRef, useState } from 'react';
import { getFeed, type FeedPiece, type PieceType } from '@/lib/api';
import { createScrollPager } from './scroll-pagination';

export function usePublicFeed({
  type,
  query,
  enabled = true,
}: {
  type?: PieceType;
  query?: string;
  enabled?: boolean;
} = {}) {
  const [items, setItems] = useState<FeedPiece[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setError(null);
    setHasMore(false);
    setIsLoading(enabled);
    if (!enabled) return () => controller.abort();
    const pager = createScrollPager<FeedPiece>({
      initialY: window.scrollY,
      fetchPage: (cursor) => getFeed({ limit: 10, cursor, type, query, signal: controller.signal }),
      onLoading: (loading) => {
        setIsLoading(loading);
        if (loading) setError(null);
      },
      onError: () => setError('Could not load the pages. Please try again.'),
      onPage: (page) => {
        setItems((current) => {
          const ids = new Set(current.map((piece) => piece.id));
          return [...current, ...page.items.filter((piece) => !ids.has(piece.id))];
        });
        setHasMore(Boolean(page.nextCursor));
      },
    });
    function onScroll() {
      void pager.onScroll(
        window.scrollY,
        endRef.current?.getBoundingClientRect().bottom ?? Infinity,
        window.innerHeight,
      );
    }
    function acceptsGesture(target: EventTarget | null) {
      if (!(target instanceof Element)) return false;
      if (target.closest('[role="dialog"], input, textarea, select, [contenteditable="true"]'))
        return false;
      const page = endRef.current?.closest('.page-content');
      return Boolean(
        page?.contains(target) || target === document.body || target === document.documentElement,
      );
    }
    function onIntent(downward: boolean) {
      void pager.onScrollIntent(
        downward,
        endRef.current?.getBoundingClientRect().bottom ?? Infinity,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
    }
    function onWheel(event: WheelEvent) {
      if (!event.defaultPrevented && !event.ctrlKey && acceptsGesture(event.target))
        onIntent(event.deltaY > 0);
    }
    let touchY: number | null = null;
    function onTouchStart(event: TouchEvent) {
      touchY =
        event.touches.length === 1 && acceptsGesture(event.target)
          ? event.touches[0].clientY
          : null;
    }
    function onTouchMove(event: TouchEvent) {
      if (touchY === null || event.touches.length !== 1 || event.defaultPrevented) return;
      const currentY = event.touches[0].clientY;
      if (Math.abs(currentY - touchY) < 12) return;
      onIntent(currentY < touchY);
      touchY = currentY;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !acceptsGesture(event.target)
      )
        return;
      if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === 'End' ||
        (event.key === ' ' && !event.shiftKey)
      ) {
        // Space on a button activates the button rather than scrolling.
        if (
          event.key === ' ' &&
          event.target instanceof Element &&
          event.target.closest('button, a')
        )
          return;
        onIntent(true);
      }
    }
    // Never observe intersection, resize or request completion to load more.
    void pager.start();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      pager.dispose();
      controller.abort();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [type, query, enabled, attempt]);

  return {
    items,
    isLoading,
    error,
    hasMore,
    endRef,
    retry: () => setAttempt((value) => value + 1),
  };
}
