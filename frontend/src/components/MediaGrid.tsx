import { useEffect, useRef } from 'react';
import type { Category, MediaItem } from '@/api/types';
import { MediaCard } from './MediaCard';
import { AudioRow } from './AudioRow';
import { FeedSkeleton } from './Skeletons';
import { EmptyState, ErrorState } from './EmptyState';

interface MediaGridProps {
  category: Category;
  items: MediaItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  isSearching: boolean;
  onLoadMore: () => void;
  onOpenDetail: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
  openLink: (url: string) => void;
}

export function MediaGrid({
  category,
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  isSearching,
  onLoadMore,
  onOpenDetail,
  onShare,
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

  if (loading) return <FeedSkeleton category={category} />;

  if (error && items.length === 0) {
    return <ErrorState message={error} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={isSearching ? 'Hech narsa topilmadi' : 'Bu bo‘limda hozircha kontent yo‘q'}
        subtitle={isSearching ? 'Boshqa kalit so‘z bilan qidirib ko‘ring.' : undefined}
      />
    );
  }

  const isAudio = category === 'AUDIO';

  return (
    <div className="pb-6">
      {isAudio ? (
        <div className="flex flex-col gap-2 px-2">
          {items.map((item) => (
            <AudioRow key={item.id} item={item} onOpenDetail={onOpenDetail} onShare={onShare} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 px-2">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onOpenDetail={onOpenDetail}
              onShare={onShare}
              openLink={openLink}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex justify-center py-4">
          <span className="w-5 h-5 rounded-full border-2 border-tg-hint border-t-transparent animate-spin" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-tg-hint py-4">Boshqa natija yo‘q</p>
      )}

      {error && items.length > 0 && (
        <p className="text-center text-xs text-tg-destructive py-2">{error}</p>
      )}
    </div>
  );
}
