/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mapped at runtime from Telegram theme params (see src/index.css).
        tg: {
          bg: 'var(--tg-bg-color)',
          'secondary-bg': 'var(--tg-secondary-bg-color)',
          text: 'var(--tg-text-color)',
          hint: 'var(--tg-hint-color)',
          link: 'var(--tg-link-color)',
          button: 'var(--tg-button-color)',
          'button-text': 'var(--tg-button-text-color)',
          'header-bg': 'var(--tg-header-bg-color)',
          accent: 'var(--tg-accent-text-color)',
          destructive: 'var(--tg-destructive-text-color)',
          'section-bg': 'var(--tg-section-bg-color)',
          'section-separator': 'var(--tg-section-separator-color)',
          subtitle: 'var(--tg-subtitle-text-color)',
        },
      },
      borderRadius: {
        card: '16px',
        sheet: '22px',
      },
      boxShadow: {
        // Soft, layered elevation instead of a single hard-edged shadow —
        // reads as "polished" rather than "boxed in".
        card: '0 1px 2px rgba(0,0,0,0.06), 0 6px 16px -8px rgba(0,0,0,0.18)',
        sheet: '0 -12px 40px -12px rgba(0,0,0,0.35)',
      },
      animation: {
        'slide-up': 'slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.15s ease-out',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
