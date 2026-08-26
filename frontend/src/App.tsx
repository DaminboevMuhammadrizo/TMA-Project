import { useCallback, useState } from 'react';
import type { Category, MediaItem } from '@/api/types';
import { useMediaFeed } from '@/hooks/useMediaFeed';
import { useTelegramWebApp } from '@/hooks/useTelegramWebApp';
import { TabBar } from '@/components/TabBar';
import { SearchBar } from '@/components/SearchBar';
import { MediaGrid } from '@/components/MediaGrid';
import { DetailModal } from '@/components/DetailModal';

export default function App() {
  const [category, setCategory] = useState<Category>('AUDIO');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const { openLink, share, haptic } = useTelegramWebApp();
  const feed = useMediaFeed(category, query);

  const handleTabChange = useCallback((next: Category) => {
    setCategory(next);
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

  return (
    <div className="min-h-screen flex flex-col bg-tg-bg text-tg-text">
      <header className="sticky top-0 z-20 safe-top bg-tg-header-bg pt-2 border-b border-tg-section-separator">
        <h1 className="px-4 pb-2 text-lg font-semibold">Media Galereya</h1>
        <TabBar active={category} onChange={handleTabChange} />
        <SearchBar value={query} onChange={setQuery} />
      </header>

      <main className="flex-1">
        <MediaGrid
          category={category}
          items={feed.items}
          loading={feed.loading}
          loadingMore={feed.loadingMore}
          error={feed.error}
          hasMore={feed.hasMore}
          isSearching={query.trim().length > 0}
          onLoadMore={feed.loadMore}
          onOpenDetail={handleOpenDetail}
          onShare={handleShare}
          openLink={openLink}
        />
      </main>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onShare={handleShare}
          openLink={openLink}
        />
      )}
    </div>
  );
}
