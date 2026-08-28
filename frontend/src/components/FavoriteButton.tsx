import type { MediaItem } from '@/api/types';
import { HeartIcon } from './icons';

type Variant = 'overlay' | 'plain' | 'ghost';

interface FavoriteButtonProps {
  item: MediaItem;
  /** Outside Telegram, initData is empty and favorites calls 401 — the
   *  button still renders but is disabled with an explanatory tooltip
   *  instead of firing requests that are guaranteed to fail. */
  isTelegram: boolean;
  onToggle: (item: MediaItem) => void;
  /** overlay: on top of a thumbnail (dark chip). plain: on a card background
   *  (matches the close/share chip style). ghost: chromeless, for rows that
   *  already sit on a themed background (e.g. AudioRow). */
  variant?: Variant;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, { base: string; idle: string; active: string }> = {
  overlay: { base: 'w-7 h-7 backdrop-blur-sm bg-black/45', idle: 'text-white', active: 'text-tg-destructive' },
  plain: { base: 'w-8 h-8 bg-tg-section-bg', idle: 'text-tg-hint', active: 'text-tg-destructive' },
  ghost: { base: 'w-8 h-8', idle: 'text-tg-hint', active: 'text-tg-destructive' },
};

/** Heart toggle used on MediaCard, AudioRow and DetailModal — always calls
 *  back into the caller, which owns the optimistic-update/rollback logic. */
export function FavoriteButton({ item, isTelegram, onToggle, variant = 'overlay', className = '' }: FavoriteButtonProps) {
  const v = VARIANT_CLASSES[variant];
  return (
    <button
      type="button"
      aria-label={item.isFavorited ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo‘shish'}
      aria-pressed={item.isFavorited}
      title={isTelegram ? undefined : 'Sevimlilar faqat Telegram ilovasida mavjud'}
      disabled={!isTelegram}
      onClick={(e) => {
        e.stopPropagation();
        if (!isTelegram) return;
        onToggle(item);
      }}
      className={`rounded-full flex items-center justify-center active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${v.base} ${
        item.isFavorited ? v.active : v.idle
      } ${className}`}
    >
      <HeartIcon filled={item.isFavorited} className={variant === 'overlay' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    </button>
  );
}
