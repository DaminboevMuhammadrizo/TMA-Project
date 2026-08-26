import { useEffect, useMemo, useState } from 'react';
import { getTelegramWebApp, isInsideTelegram, type TelegramThemeParams } from '@/lib/telegram';
import type { MediaItem } from '@/api/types';

// Sensible defaults so the app looks intentional (not broken) when opened
// in a plain browser, i.e. window.Telegram is unavailable or unpopulated.
const FALLBACK_DARK_THEME: Required<TelegramThemeParams> = {
  bg_color: '#0f1115',
  text_color: '#f5f5f7',
  hint_color: '#8a8f98',
  link_color: '#6ab7ff',
  button_color: '#3390ec',
  button_text_color: '#ffffff',
  secondary_bg_color: '#181a20',
  header_bg_color: '#181a20',
  accent_text_color: '#6ab7ff',
  section_bg_color: '#181a20',
  section_header_text_color: '#8a8f98',
  section_separator_color: '#252831',
  subtitle_text_color: '#8a8f98',
  destructive_text_color: '#ff595a',
};

function applyThemeCssVars(theme: TelegramThemeParams) {
  const merged = { ...FALLBACK_DARK_THEME, ...stripUndefined(theme) };
  const root = document.documentElement;
  root.style.setProperty('--tg-bg-color', merged.bg_color);
  root.style.setProperty('--tg-text-color', merged.text_color);
  root.style.setProperty('--tg-hint-color', merged.hint_color);
  root.style.setProperty('--tg-link-color', merged.link_color);
  root.style.setProperty('--tg-button-color', merged.button_color);
  root.style.setProperty('--tg-button-text-color', merged.button_text_color);
  root.style.setProperty('--tg-secondary-bg-color', merged.secondary_bg_color);
  root.style.setProperty('--tg-header-bg-color', merged.header_bg_color);
  root.style.setProperty('--tg-accent-text-color', merged.accent_text_color);
  root.style.setProperty('--tg-section-bg-color', merged.section_bg_color);
  root.style.setProperty('--tg-section-separator-color', merged.section_separator_color);
  root.style.setProperty('--tg-subtitle-text-color', merged.subtitle_text_color);
  root.style.setProperty('--tg-destructive-text-color', merged.destructive_text_color);
}

function stripUndefined(theme: TelegramThemeParams): Partial<TelegramThemeParams> {
  return Object.fromEntries(Object.entries(theme).filter(([, v]) => v !== undefined));
}

export interface UseTelegramWebApp {
  /** true when running inside an actual Telegram client (populated initData). */
  isTelegram: boolean;
  colorScheme: 'light' | 'dark';
  /** Opens an external/Telegram link safely, falling back to window.open outside Telegram. */
  openLink: (url: string) => void;
  /** Best-effort share/forward of a media item (see README for limitations). */
  share: (item: MediaItem) => void;
  haptic: {
    tap: () => void;
    success: () => void;
    error: () => void;
  };
  expand: () => void;
}

/**
 * Initializes the Telegram WebApp SDK (ready/expand), mirrors Telegram's
 * theme colors onto CSS variables consumed by Tailwind, and exposes a small
 * set of guarded helpers. Safe to use outside Telegram — everything falls
 * back to sane defaults.
 */
export function useTelegramWebApp(): UseTelegramWebApp {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [isTelegram] = useState(() => isInsideTelegram());

  useEffect(() => {
    const webApp = getTelegramWebApp();

    if (!webApp) {
      // Plain browser without the CDN shim at all (e.g. offline dev). Apply
      // the fallback dark theme so the UI still looks deliberate.
      applyThemeCssVars({});
      document.documentElement.classList.add('dark');
      return;
    }

    try {
      webApp.ready();
      webApp.expand();
    } catch {
      // Some very old clients may not implement every method — never let
      // SDK quirks crash the app.
    }

    const syncTheme = () => {
      const hasRealTheme = Object.keys(webApp.themeParams || {}).length > 0;
      applyThemeCssVars(hasRealTheme ? webApp.themeParams : {});
      const scheme = webApp.colorScheme === 'light' ? 'light' : 'dark';
      setColorScheme(scheme);
      document.documentElement.classList.toggle('dark', scheme === 'dark');
    };

    syncTheme();
    webApp.onEvent?.('themeChanged', syncTheme);
    return () => webApp.offEvent?.('themeChanged', syncTheme);
  }, []);

  const helpers = useMemo<UseTelegramWebApp>(() => {
    const openLink = (url: string) => {
      const webApp = getTelegramWebApp();
      try {
        if (webApp) {
          if (/^https?:\/\/t\.me\//i.test(url)) {
            webApp.openTelegramLink(url);
          } else {
            webApp.openLink(url, { try_instant_view: false });
          }
          return;
        }
      } catch {
        // fall through to plain window.open
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    const share = (item: MediaItem) => {
      // The Telegram WebApp JS SDK does not expose a "forward this exact
      // file" API — only `switchInlineQuery` (requires an inline-mode bot
      // and a chat-selection UI) or plain link sharing. We approximate
      // native share/forward with Telegram's own share deep link
      // (t.me/share/url), which opens Telegram's chat picker with the
      // file's direct URL + caption pre-filled as a message the user sends
      // on. This is the best available approximation without a bot-side
      // inline handler; see README "Known limitations".
      const shareUrl = item.fileUrl;
      const text = item.caption?.trim() || 'Media Gallery';
      const deepLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
      openLink(deepLink);
    };

    const haptic = {
      tap: () => {
        try {
          getTelegramWebApp()?.HapticFeedback?.impactOccurred('light');
        } catch {
          /* no-op outside Telegram */
        }
      },
      success: () => {
        try {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred('success');
        } catch {
          /* no-op outside Telegram */
        }
      },
      error: () => {
        try {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred('error');
        } catch {
          /* no-op outside Telegram */
        }
      },
    };

    const expand = () => {
      try {
        getTelegramWebApp()?.expand();
      } catch {
        /* no-op outside Telegram */
      }
    };

    return { isTelegram, colorScheme, openLink, share, haptic, expand };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTelegram, colorScheme]);

  return helpers;
}
