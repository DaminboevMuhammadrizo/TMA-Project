/**
 * Thin, guarded wrapper around `window.Telegram.WebApp`.
 *
 * We hand-roll this instead of depending on `@twa-dev/sdk` because that
 * package reads `window.Telegram.WebApp` at *module import time*
 * (`exports.WebApp = window.Telegram.WebApp`) and throws immediately if
 * `window.Telegram` doesn't exist yet — which happens whenever the
 * telegram-web-app.js CDN script hasn't loaded (offline dev, ad blockers,
 * slow network) or the page is opened outside Telegram before the script
 * resolves. That would take down the whole app before React even mounts.
 * Reading `window.Telegram?.WebApp` lazily, on demand, avoids that entirely
 * and keeps `npm run dev` in a plain browser fully functional.
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  section_separator_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready(): void;
  expand(): void;
  close(): void;
  onEvent(eventType: string, callback: () => void): void;
  offEvent(eventType: string, callback: () => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  switchInlineQuery?: (query: string, chooseChatTypes?: string[]) => void;
  showAlert?: (message: string, callback?: () => void) => void;
  HapticFeedback?: TelegramHapticFeedback;
  isVersionAtLeast?: (version: string) => boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/** Returns the live WebApp object, or null when not running inside Telegram. */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isInsideTelegram(): boolean {
  const webApp = getTelegramWebApp();
  // Outside Telegram the shim script still defines WebApp, but initData is
  // always empty; inside Telegram it's a populated, signed query string.
  return Boolean(webApp && webApp.initData && webApp.initData.length > 0);
}
