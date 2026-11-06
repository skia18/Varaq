import { useEffect, useState } from 'react';

import { getTrails, type TrailSummary } from '@/lib/api';

export function useTrailStarts(enabled: boolean) {
  const [items, setItems] = useState<TrailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    void getTrails()
      .then(({ items: nextItems }) => {
        if (active) setItems(nextItems);
      })
      .catch(() => {
        if (active) setError('The Trails could not be gathered right now.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attempt, enabled]);

  return {
    items,
    isLoading,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
