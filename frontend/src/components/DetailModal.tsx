import { useEffect } from 'react';
import type { MediaItem } from '@/api/types';
import { formatDate, formatDuration, formatFileSize, formatViews } from '@/utils/format';
import { AudioPlayer } from './AudioPlayer';
import { FavoriteButton } from './FavoriteButton';
import { CloseIcon, EyeIcon, LinkIcon, ReplyIcon, ShareIcon, StickerIcon } from './icons';

interface DetailModalProps {
  item: MediaItem;
  isTelegram: boolean;
  onClose: () => void;
  onShare: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  openLink: (url: string) => void;
}

function isAnimatedSticker(item: MediaItem): boolean {
  return (
    item.mediaType === 'STICKER' &&
    (item.mimeType === 'application/x-tgsticker' || Boolean(item.fileName?.endsWith('.tgs')))
  );
}

function MediaPreview({ item }: { item: MediaItem }) {
  switch (item.mediaType) {
    case 'AUDIO':
    case 'VOICE':
      return (
        <div className="p-4 rounded-card bg-tg-section-bg">
          <AudioPlayer item={item} />
        </div>
      );
    case 'VIDEO':
      return (
        <video
          src={item.fileUrl}
          poster={item.thumbUrl ?? undefined}
          controls
          playsInline
          className="w-full max-h-[50vh] rounded-card bg-black"
        />
      );
    case 'VIDEO_NOTE':
      return (
        <video
          src={item.fileUrl}
          poster={item.thumbUrl ?? undefined}
          controls
          playsInline
          className="w-56 h-56 rounded-full object-cover bg-black mx-auto"
        />
      );
    case 'ANIMATION':
      return (
        <video
          src={item.fileUrl}
          poster={item.thumbUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          className="w-full max-h-[50vh] rounded-card bg-black object-contain"
        />
      );
    case 'STICKER':
      if (isAnimatedSticker(item) && !item.thumbUrl) {
        return (
          <div className="w-full h-48 flex flex-col items-center justify-center gap-2 rounded-card bg-tg-section-bg text-tg-hint">
            <StickerIcon className="w-10 h-10" />
            <span className="text-xs">
              Animatsiyali stiker (.tgs) — bu ko‘rinish uchun statik oldindan ko‘rish mavjud emas.
            </span>
          </div>
        );
      }
      return (
        <img
          src={item.thumbUrl ?? item.fileUrl}
          alt={item.caption ?? 'sticker'}
          className="w-full max-h-[50vh] object-contain rounded-card"
        />
      );
    case 'PHOTO':
    default:
      return (
        <img
          src={item.fileUrl}
          alt={item.caption ?? 'photo'}
          className="w-full max-h-[50vh] object-contain rounded-card bg-tg-section-bg"
        />
      );
  }
}

export function DetailModal({ item, isTelegram, onClose, onShare, onToggleFavorite, openLink }: DetailModalProps) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-sheet sm:rounded-sheet bg-tg-bg text-tg-text shadow-sheet animate-slide-up safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex justify-center pt-2 pb-1 bg-tg-bg z-10 sm:hidden">
          <div className="w-9 h-1 rounded-full bg-tg-section-separator" />
        </div>

        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-tg-hint">{formatDate(item.createdAt)}</span>
          <div className="flex items-center gap-2">
            <FavoriteButton item={item} isTelegram={isTelegram} onToggle={onToggleFavorite} variant="plain" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-tg-section-bg text-tg-hint"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4">
          <MediaPreview item={item} />
        </div>

        <div className="p-4 flex flex-col gap-3.5">
          {item.replyToText && (
            <div className="rounded-card bg-tg-section-bg p-3.5 border-l-2 border-tg-button">
              <div className="flex items-center gap-1.5 text-xs font-medium text-tg-accent mb-1">
                <ReplyIcon className="w-3.5 h-3.5" />
                Javob berilgan xabar:
              </div>
              <p className="text-sm text-tg-hint whitespace-pre-wrap">{item.replyToText}</p>
            </div>
          )}

          {item.caption && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.caption}</p>
          )}

          {item.links.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {item.links.map((link) => (
                <button
                  key={link}
                  type="button"
                  onClick={() => openLink(link)}
                  className="flex items-center gap-2 text-sm text-tg-link text-left"
                >
                  <LinkIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate underline decoration-dotted">{link}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tg-hint pt-1">
            <span className="flex items-center gap-1">
              <EyeIcon className="w-3.5 h-3.5" />
              {formatViews(item.viewsCount)} ko‘rishlar
            </span>
            {Boolean(item.durationSec) && <span>{formatDuration(item.durationSec)}</span>}
            {Boolean(item.fileSize) && <span>{formatFileSize(item.fileSize)}</span>}
            {item.width && item.height && (
              <span>
                {item.width}×{item.height}
              </span>
            )}
            {item.stickerSetName && <span>{item.stickerSetName}</span>}
          </div>

          <button
            type="button"
            onClick={() => onShare(item)}
            className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-card bg-tg-button text-tg-button-text text-sm font-medium active:scale-[0.98] transition-transform"
          >
            <ShareIcon className="w-4 h-4" />
            Ulashish
          </button>
        </div>
      </div>
    </div>
  );
}
