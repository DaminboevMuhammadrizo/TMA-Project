# TMA Frontend — Telegram Media Gallery

React + Vite + TypeScript + Tailwind frontend for the Telegram Mini App media
gallery. Talks to the NestJS backend described in `../docs/API_CONTRACT.md`.

## Setup

```bash
npm install
cp .env.example .env
# edit .env if the backend isn't at http://localhost:3000/api
npm run dev
```

Opens at `http://localhost:5173`. It works fine in a plain desktop browser —
`window.Telegram` is guarded everywhere, so outside Telegram the app falls
back to a default dark theme and no-ops on Telegram-only actions (haptics,
native link opening falls back to `window.open`).

`npm run build` type-checks (`tsc -b`) and produces a static bundle in `dist/`.
Note: `VITE_API_BASE_URL` is a Vite build-time env var — it's baked into the
JS bundle, not read at container runtime. Rebuild (or pass it as a Docker
build-arg, see `Dockerfile`) if it changes.

## Docker

```bash
docker build -t tma-frontend --build-arg VITE_API_BASE_URL=https://api.example.com/api .
docker run -p 8080:80 tma-frontend
```

Multi-stage build: `npm run build` then serves `dist/` via nginx, with SPA
fallback routing (`nginx.conf`) so client-side state survives a refresh.

## Registering as a Telegram Mini App (BotFather)

Once the app is deployed to a public HTTPS URL:

1. Message [@BotFather](https://t.me/BotFather) → `/newapp` (or `/myapps` →
   your bot → "Edit Web App URL" if it already exists).
2. Pick the bot this gallery belongs to.
3. Paste the deployed frontend URL (must be HTTPS).
4. Optionally set a Mini App name, description, and icon.
5. Add a menu button or inline "Open Gallery" button in your bot pointing at
   the same URL (`/setmenubutton` for the persistent menu button, or a
   `web_app` inline keyboard button from the bot's own code).

This is deploy-stage configuration done in Telegram itself, not something
this repo needs to implement.

## Known limitations

- **Share/forward**: the Telegram WebApp JS SDK has no API to forward the
  exact original file. The Share button opens Telegram's own
  `t.me/share/url` chat picker pre-filled with the file's direct URL and
  caption, which the user then sends on — a close approximation, not a true
  "forward this message" action.
- **Animated stickers (`.tgs`)**: `.tgs` is gzipped Lottie JSON; a plain
  `<img>`/`<video>` can't render it. Cards and the detail view fall back to
  the sticker's `thumbUrl` (a static preview Telegram generates for most
  stickers) or, if none exists, a placeholder icon — no Lottie player is
  bundled.
