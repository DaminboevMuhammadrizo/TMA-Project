import { useEffect, useRef } from 'react';
import type { MediaItem } from '@/api/types';
import type { FeedTab } from '@/hooks/useMediaFeed';
import { MediaCard } from './MediaCard';
import { AudioRow } from './AudioRow';
import { FeedSkeleton } from './Skeletons';
import { EmptyState, ErrorState } from './EmptyState';

interface MediaGridProps {
  tab: FeedTab;
  items: MediaItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  isSearching: boolean;
  isTelegram: boolean;
  onLoadMore: () => void;
  onOpenDetail: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  openLink: (url: string) => void;
}

export function MediaGrid({
  tab,
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  isSearching,
  isTelegram,
  onLoadMore,
  onOpenDetail,
  onShare,
  onToggleFavorite,
  openLink,
}: MediaGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length, hasMore]);

  if (loading) return <FeedSkeleton tab={tab} />;

  if (error && items.length === 0) {
    return <ErrorState message={error} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={
          isSearching
            ? 'Hech narsa topilmadi'
            : tab === 'FAVORITES'
              ? 'Sevimlilar hali yoʻq'
              : 'Bu boʻlimda hozircha kontent yoʻq'
        }
        subtitle={
          isSearching
            ? 'Boshqa kalit soʻz bilan qidirib koʻring.'
            : tab === 'FAVORITES'
              ? 'Yoqtirgan audio, video, rasm yoki stikerlaringizni yurak belgisi bilan shu yerga qoʻshing.'
              : undefined
        }
      />
    );
  }

  // The Favorites tab can contain items from every category (the backend
  // doesn't filter it by type), so it renders as two sections instead of a
  // single homogeneous layout. Every other tab is homogeneous, same as before.
  const isFavorites = tab === 'FAVORITES';
  const audioItems = isFavorites ? items.filter((i) => i.category === 'AUDIO') : tab === 'AUDIO' ? items : [];
  const gridItems = isFavorites ? items.filter((i) => i.category !== 'AUDIO') : tab === 'AUDIO' ? [] : items;
  const showSectionLabels = isFavorites && audioItems.length > 0 && gridItems.length > 0;

  return (
    <div className="pb-8">
      {audioItems.length > 0 && (
        <div className="flex flex-col gap-2.5 px-3 pt-3">
          {showSectionLabels && (
            <p className="px-1 text-xs font-medium text-tg-hint uppercase tracking-wide">Audio</p>
          )}
          {audioItems.map((item) => (
            <AudioRow
              key={item.id}
              item={item}
              isTelegram={isTelegram}
              onOpenDetail={onOpenDetail}
              onShare={onShare}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      {gridItems.length > 0 && (
        <div className={showSectionLabels ? 'pt-4' : 'pt-3'}>
          {showSectionLabels && (
            <p className="px-4 pb-2 text-xs font-medium text-tg-hint uppercase tracking-wide">
              Video, rasm va stikerlar
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 px-3">
            {gridItems.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                isTelegram={isTelegram}
                onOpenDetail={onOpenDetail}
                onShare={onShare}
                onToggleFavorite={onToggleFavorite}
                openLink={openLink}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex justify-center py-4">
          <span className="w-5 h-5 rounded-full border-2 border-tg-hint border-t-transparent animate-spin" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-tg-hint py-4">Boshqa natija yoʻq</p>
      )}

      {error && items.length > 0 && (
        <p className="text-center text-xs text-tg-destructive py-2">{error}</p>
      )}
    </div>
  );
}
