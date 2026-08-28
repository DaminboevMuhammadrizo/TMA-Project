import { useCallback, useRef, useState } from 'react';
import { addFavorite, removeFavorite } from '@/api/client';
import type { MediaItem } from '@/api/types';
import { useMediaFeed, type FeedTab } from '@/hooks/useMediaFeed';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { TabBar } from '@/components/TabBar';
import { SearchBar } from '@/components/SearchBar';
import { MediaGrid } from '@/components/MediaGrid';
import { DetailModal } from '@/components/DetailModal';

export default function App() {
  const [tab, setTab] = useState<FeedTab>('AUDIO');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const { openLink, share, haptic, isTelegram } = useTelegramWebApp();
  const feed = useMediaFeed(tab, query);

  const handleTabChange = useCallback((next: FeedTab) => {
    setTab(next);
    setQuery('');
    haptic.tap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDetail = useCallback(
    (item: MediaItem) => {
      setSelectedItem(item);
      haptic.tap();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleShare = useCallback(
    (item: MediaItem) => {
      haptic.tap();
      share(item);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Guards against double-firing while a toggle for the same item is still
  // in flight (e.g. an eager double-tap) — favoriting is idempotent
  // server-side, but there's no reason to fire the request twice.
  const pendingFavoriteIds = useRef<Set<number>>(new Set());

  const handleToggleFavorite = useCallback(
    (item: MediaItem) => {
      if (pendingFavoriteIds.current.has(item.id)) return;
      pendingFavoriteIds.current.add(item.id);

      const next = !item.isFavorited;
      // Optimistic flip, everywhere the item might currently be rendered.
      feed.updateItem(item.id, { isFavorited: next });
      setSelectedItem((cur) => (cur && cur.id === item.id ? { ...cur, isFavorited: next } : cur));
      haptic.tap();

      const request = next ? addFavorite(item.id) : removeFavorite(item.id);
      request
        .catch(() => {
          // Roll back on failure (e.g. 401 outside Telegram, network error).
          feed.updateItem(item.id, { isFavorited: !next });
          setSelectedItem((cur) => (cur && cur.id === item.id ? { ...cur, isFavorited: !next } : cur));
          haptic.error();
        })
        .finally(() => {
          pendingFavoriteIds.current.delete(item.id);
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  // On the Favorites tab, an item optimistically unfavorited should drop out
  // of view immediately rather than wait for a refetch.
  const displayItems = tab === 'FAVORITES' ? feed.items.filter((i) => i.isFavorited) : feed.items;

  return (
    <div className="min-h-screen flex flex-col bg-tg-bg text-tg-text">
      <header className="sticky top-0 z-20 safe-top bg-tg-header-bg/95 backdrop-blur-md border-b border-tg-section-separator/70">
        <div className="mx-auto w-full max-w-4xl pt-3">
          <h1 className="px-4 pb-2.5 text-[19px] font-semibold tracking-tight">Media Galereya</h1>
          <TabBar active={tab} onChange={handleTabChange} />
          {tab !== 'FAVORITES' && <SearchBar value={query} onChange={setQuery} />}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl">
          <MediaGrid
            tab={tab}
            items={displayItems}
            loading={feed.loading}
            loadingMore={feed.loadingMore}
            error={feed.error}
            hasMore={feed.hasMore}
            isSearching={query.trim().length > 0}
            isTelegram={isTelegram}
            onLoadMore={feed.loadMore}
            onOpenDetail={handleOpenDetail}
            onShare={handleShare}
            onToggleFavorite={handleToggleFavorite}
            openLink={openLink}
          />
        </div>
      </main>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          isTelegram={isTelegram}
          onClose={() => setSelectedItem(null)}
          onShare={handleShare}
          onToggleFavorite={handleToggleFavorite}
          openLink={openLink}
        />
      )}
    </div>
  );
}
