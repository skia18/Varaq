import type { usePublicFeed } from './usePublicFeed';

export function FeedStatus({
  feed,
  visibleItemCount = feed.items.length,
}: {
  feed: ReturnType<typeof usePublicFeed>;
  visibleItemCount?: number;
}) {
  return (
    <div ref={feed.endRef} className="feed-status" role="status">
      {feed.isLoading ? (
        <p>Loading pages…</p>
      ) : feed.error ? (
        <>
          <p>{feed.error}</p>
          {visibleItemCount === 0 ? (
            <button type="button" className="quiet-link" onClick={feed.retry}>
              Try again
            </button>
          ) : (
            <p>Scroll down again to retry.</p>
          )}
        </>
      ) : visibleItemCount === 0 ? (
        <p>No published public pages yet.</p>
      ) : (
        <p>{feed.hasMore ? 'Scroll down for more pages.' : 'You’ve reached the end.'}</p>
      )}
    </div>
  );
}
