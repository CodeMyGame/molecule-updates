import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseInfiniteScrollOptions {
  pageSize?: number;
  initialCount?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export function useInfiniteScroll<T>(
  items: T[],
  options: UseInfiniteScrollOptions = {}
) {
  const {
    pageSize = 30,
    initialCount = 30,
    rootMargin = '200px',
    enabled = true,
  } = options;

  const [displayCount, setDisplayCount] = useState(initialCount);

  // Reset display count when items change (e.g. search / filter applied)
  useEffect(() => {
    setDisplayCount(initialCount);
  }, [items, initialCount]);

  const hasMore = enabled && displayCount < items.length;

  const loadMore = useCallback(() => {
    if (!enabled) return;
    setDisplayCount((prev) => Math.min(prev + pageSize, items.length));
  }, [enabled, pageSize, items.length]);

  const reset = useCallback(() => {
    setDisplayCount(initialCount);
  }, [initialCount]);

  const observerTarget = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !hasMore) return;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayCount((prev) => Math.min(prev + pageSize, items.length));
        }
      },
      {
        root: null,
        rootMargin,
        threshold: 0.05,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [enabled, hasMore, pageSize, items.length, rootMargin]);

  const visibleItems = enabled ? items.slice(0, displayCount) : items;

  return {
    visibleItems,
    hasMore,
    loadMore,
    reset,
    totalCount: items.length,
    displayCount: enabled ? Math.min(displayCount, items.length) : items.length,
    observerTarget,
  };
}
