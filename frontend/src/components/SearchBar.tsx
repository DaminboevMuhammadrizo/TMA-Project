import { useEffect, useState } from 'react';
import { SearchIcon, CloseIcon } from './icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Debounced search input — commits to `onChange` 350ms after typing stops. */
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="relative px-3 pb-2">
      <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-tg-hint pointer-events-none" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? 'Qidirish...'}
        className="w-full pl-9 pr-9 py-2 rounded-full bg-tg-section-bg text-tg-text placeholder:text-tg-hint text-sm outline-none focus:ring-2 focus:ring-tg-button"
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft('')}
          aria-label="Tozalash"
          className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-tg-hint"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
