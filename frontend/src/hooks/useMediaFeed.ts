import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getMedia, searchMedia } from '@/api/client';
import type { Category, MediaItem } from '@/api/types';

const PAGE_LIMIT = 24;

export interface UseMediaFeedResult {
  items: MediaItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Paginated feed for a category, switching transparently between
 * GET /media and GET /media/search depending on whether `query` is set.
 * Resets and refetches from page 1 whenever category or query changes.
 */
export function useMediaFeed(category: Category, query: string): UseMediaFeedResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow, stale request (from a previous category/query)
  // clobbering results of a newer one that resolved first.
  const requestToken = useRef(0);

  const trimmedQuery = query.trim();

  useEffect(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setPage(1);

    const fetcher = trimmedQuery
      ? searchMedia({ q: trimmedQuery, category, page: 1, limit: PAGE_LIMIT })
      : getMedia({ category, page: 1, limit: PAGE_LIMIT });

    fetcher
      .then((res) => {
        if (requestToken.current !== token) return;
        setItems(res.data);
        setTotalPages(res.meta.totalPages);
        setPage(res.meta.page);
      })
      .catch((err: unknown) => {
        if (requestToken.current !== token) return;
        setError(err instanceof ApiError ? err.message : 'Nomaʼlum xatolik yuz berdi.');
      })
      .finally(() => {
        if (requestToken.current !== token) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, trimmedQuery]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    const token = requestToken.current;
    const nextPage = page + 1;
    setLoadingMore(true);

    const fetcher = trimmedQuery
      ? searchMedia({ q: trimmedQuery, category, page: nextPage, limit: PAGE_LIMIT })
      : getMedia({ category, page: nextPage, limit: PAGE_LIMIT });

    fetcher
      .then((res) => {
        if (requestToken.current !== token) return;
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...res.data.filter((i) => !seen.has(i.id))];
        });
        setTotalPages(res.meta.totalPages);
        setPage(res.meta.page);
      })
      .catch((err: unknown) => {
        if (requestToken.current !== token) return;
        setError(err instanceof ApiError ? err.message : 'Nomaʼlum xatolik yuz berdi.');
      })
      .finally(() => {
        if (requestToken.current !== token) return;
        setLoadingMore(false);
      });
  }, [category, trimmedQuery, page, totalPages, loading, loadingMore]);

  return { items, loading, loadingMore, error, hasMore: page < totalPages, loadMore };
}
