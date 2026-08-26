import type { MediaItem } from '@/api/types';
import { AudioPlayer } from './AudioPlayer';
import { ShareIcon } from './icons';

interface AudioRowProps {
  item: MediaItem;
  onOpenDetail: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
}

function audioTitle(item: MediaItem): string {
  if (item.fileName) return item.fileName;
  if (item.caption) return item.caption.slice(0, 80);
  return item.mediaType === 'VOICE' ? 'Ovozli xabar' : 'Audio';
}

/** Row card used in the Audiolar tab — compact player + caption + share. */
export function AudioRow({ item, onOpenDetail, onShare }: AudioRowProps) {
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-card bg-tg-section-bg cursor-pointer"
      onClick={() => onOpenDetail(item)}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-tg-text truncate">{audioTitle(item)}</p>
          {item.caption && item.fileName && (
            <p className="text-xs text-tg-hint truncate">{item.caption}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Ulashish"
          onClick={(e) => {
            e.stopPropagation();
            onShare(item);
          }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-tg-hint active:scale-90 transition-transform"
        >
          <ShareIcon className="w-4 h-4" />
        </button>
      </div>
      <AudioPlayer item={item} />
    </div>
  );
}
