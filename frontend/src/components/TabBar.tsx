import type { Category } from '@/api/types';

export const TABS: { value: Category; label: string }[] = [
  { value: 'AUDIO', label: 'Audiolar' },
  { value: 'VIDEO', label: 'Videolar' },
  { value: 'IMAGE_STICKER', label: 'Rasmlar & Stikerlar' },
];

interface TabBarProps {
  active: Category;
  onChange: (category: Category) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-section-bg text-tg-hint'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
