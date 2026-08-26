import { ImageOffIcon } from './icons';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center text-tg-hint">
      <ImageOffIcon className="w-10 h-10 opacity-60" />
      <p className="text-sm font-medium text-tg-text">{title}</p>
      {subtitle && <p className="text-xs max-w-xs">{subtitle}</p>}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
      <p className="text-sm font-medium text-tg-destructive">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-full bg-tg-button text-tg-button-text text-sm font-medium active:scale-95 transition-transform"
        >
          Qayta urinish
        </button>
      )}
    </div>
  );
}
