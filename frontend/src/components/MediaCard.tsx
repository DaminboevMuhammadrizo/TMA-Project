import { useState } from 'react';
import type { MediaItem } from '@/api/types';
import { formatDuration, formatViews } from '@/utils/format';
import { usePointerFine } from '@/utils/device';
import { EyeIcon, LinkIcon, PlayIcon, ReplyIcon, ShareIcon, StickerIcon } from './icons';

interface MediaCardProps {
  item: MediaItem;
  onOpenDetail: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
  openLink: (url: string) => void;
}

function isAnimatedSticker(item: MediaItem): boolean {
  return (
    item.mediaType === 'STICKER' &&
    (item.mimeType === 'application/x-tgsticker' || Boolean(item.fileName?.endsWith('.tgs')))
  );
}

/** Grid cell for VIDEO / VIDEO_NOTE / ANIMATION / PHOTO / STICKER items. */
export function MediaCard({ item, onOpenDetail, onShare, openLink }: MediaCardProps) {
  const isPointerFine = usePointerFine();
  const [imgError, setImgError] = useState(false);
  const isCircular = item.mediaType === 'VIDEO_NOTE';
  const hasOverlayContent = Boolean(item.caption || item.links.length > 0 || item.replyToText);

  const staticSrc = item.thumbUrl ?? item.fileUrl;
  const showBrokenStickerFallback = isAnimatedSticker(item) && (imgError || !item.thumbUrl);

  return (
    <div
      className={`group relative aspect-square overflow-hidden bg-tg-section-bg cursor-pointer select-none ${
        isCircular ? 'rounded-full' : 'rounded-card'
      }`}
      onClick={() => onOpenDetail(item)}
    >
      {/* Media */}
      {item.mediaType === 'ANIMATION' ? (
        <video
          src={item.fileUrl}
          poster={item.thumbUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      ) : showBrokenStickerFallback ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-tg-hint">
          <StickerIcon className="w-8 h-8" />
          <span className="text-[10px] px-2 text-center leading-tight">Animatsiyali stiker</span>
        </div>
      ) : (
        <img
          src={staticSrc}
          onError={() => setImgError(true)}
          loading="lazy"
          alt={item.caption ?? item.fileName ?? item.mediaType}
          className="w-full h-full object-cover"
        />
      )}

      {/* Play affordance for actual videos */}
      {item.mediaType === 'VIDEO' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/45 flex items-center justify-center text-white backdrop-blur-sm">
            <PlayIcon className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      )}

      {/* Duration / views badge */}
      {(item.durationSec || item.viewsCount > 0) && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-black/55 text-white text-[10px] leading-none">
          {Boolean(item.durationSec) && <span className="tabular-nums">{formatDuration(item.durationSec)}</span>}
          {item.viewsCount > 0 && (
            <span className="flex items-center gap-0.5">
              <EyeIcon className="w-2.5 h-2.5" />
              {formatViews(item.viewsCount)}
            </span>
          )}
        </div>
      )}

      {/* Share button */}
      <button
        type="button"
        aria-label="Ulashish"
        onClick={(e) => {
          e.stopPropagation();
          onShare(item);
        }}
        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-sm active:scale-90 transition-transform"
      >
        <ShareIcon className="w-3.5 h-3.5" />
      </button>

      {/* Desktop hover overlay — only wired up on fine-pointer devices so
          touch taps never get stuck showing a hover state. */}
      {isPointerFine && hasOverlayContent && (
        <div className="absolute inset-x-0 bottom-0 max-h-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gradient-to-t from-black/85 via-black/60 to-transparent text-white p-2.5 pt-6 text-xs flex flex-col gap-1">
          {item.replyToText && (
            <div className="flex items-start gap-1 opacity-80 line-clamp-1">
              <ReplyIcon className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="line-clamp-1">{item.replyToText}</span>
            </div>
          )}
          {item.caption && <p className="line-clamp-3">{item.caption}</p>}
          {item.links.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              {item.links.slice(0, 2).map((link) => (
                <button
                  key={link}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLink(link);
                  }}
                  className="flex items-center gap-1 text-tg-link underline decoration-dotted truncate text-left"
                >
                  <LinkIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{link}</span>
                </button>
              ))}
              {item.links.length > 2 && <span className="opacity-70">+{item.links.length - 2} ta havola</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
