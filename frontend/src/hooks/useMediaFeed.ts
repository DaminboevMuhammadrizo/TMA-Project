import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getFavorites, getMedia, searchMedia } from '@/api/client';
import type { Category, MediaItem } from '@/api/types';

const PAGE_LIMIT = 24;

/** A tab in the UI: one of the real categories, or the client-only Favorites view. */
export type FeedTab = Category | 'FAVORITES';

export interface UseMediaFeedResult {
  items: MediaItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  /** Patches a single item in place — used for optimistic favorite toggles. */
  updateItem: (id: number, patch: Partial<MediaItem>) => void;
}

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Sevimlilarni ko‘rish uchun ilovani Telegram ichida oching.';
    return err.message;
  }
  return 'Nomaʼlum xatolik yuz berdi.';
}

/**
 * Paginated feed for a tab, switching transparently between GET /media,
 * GET /media/search and GET /favorites depending on `tab`/`query`. Resets
 * and refetches from page 1 whenever the tab or query changes.
 */
export function useMediaFeed(tab: FeedTab, query: string): UseMediaFeedResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow, stale request (from a previous tab/query)
  // clobbering results of a newer one that resolved first.
  const requestToken = useRef(0);

  const isFavorites = tab === 'FAVORITES';
  const trimmedQuery = isFavorites ? '' : query.trim();

  const fetchPage = useCallback(
    (pageNum: number) => {
      if (isFavorites) return getFavorites({ page: pageNum, limit: PAGE_LIMIT });
      const category = tab as Category;
      return trimmedQuery
        ? searchMedia({ q: trimmedQuery, category, page: pageNum, limit: PAGE_LIMIT })
        : getMedia({ category, page: pageNum, limit: PAGE_LIMIT });
    },
    [isFavorites, tab, trimmedQuery],
  );

  useEffect(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setPage(1);

    fetchPage(1)
      .then((res) => {
        if (requestToken.current !== token) return;
        setItems(res.data);
        setTotalPages(res.meta.totalPages);
        setPage(res.meta.page);
      })
      .catch((err: unknown) => {
        if (requestToken.current !== token) return;
        setError(friendlyError(err));
      })
      .finally(() => {
        if (requestToken.current !== token) return;
        setLoading(false);
      });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    const token = requestToken.current;
    const nextPage = page + 1;
    setLoadingMore(true);

    fetchPage(nextPage)
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
        setError(friendlyError(err));
      })
      .finally(() => {
        if (requestToken.current !== token) return;
        setLoadingMore(false);
      });
  }, [fetchPage, page, totalPages, loading, loadingMore]);

  const updateItem = useCallback((id: number, patch: Partial<MediaItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  return { items, loading, loadingMore, error, hasMore: page < totalPages, loadMore, updateItem };
}
