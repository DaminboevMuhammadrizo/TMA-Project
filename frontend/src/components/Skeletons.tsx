import type { FeedTab } from '@/hooks/useMediaFeed';

/** Shared shimmer block — also reused by MediaCard as the pre-load
 *  placeholder before a thumbnail scrolls into view. */
export function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-tg-section-separator opacity-60 ${className}`} />;
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className="aspect-square rounded-card" />
      ))}
    </div>
  );
}

export function AudioListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-card bg-tg-section-bg">
          <Shimmer className="w-11 h-11 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Shimmer className="h-2 rounded w-2/3" />
            <Shimmer className="h-2 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedSkeleton({ tab }: { tab: FeedTab }) {
  return tab === 'AUDIO' ? <AudioListSkeleton /> : <GridSkeleton />;
}
