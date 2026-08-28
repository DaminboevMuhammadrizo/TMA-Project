# TMA Backend

NestJS + Prisma (PostgreSQL) backend for the Telegram Media Gallery. Implements
the REST API described in `../docs/API_CONTRACT.md` and two Telegram sync
paths that keep `channel_media` up to date.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Configure environment**
   ```
   cp .env.example .env
   ```
   Fill in `DATABASE_URL`, `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` (from
   https://my.telegram.org), `TELEGRAM_CHANNEL`, `BOT_TOKEN` (from
   @BotFather), and `ADMIN_TOKEN` (any random secret you choose). Leave
   `TELEGRAM_SESSION` blank for now — the next step generates it.

   Two more env vars support the v2 features (favorites/caching/migration):
   - `REDIS_URL` — points at the dedicated `redis` container (see
     `docker-compose.yml`/`docker-compose.prod.yml`). Response caching is
     best-effort: if this is unset or Redis is unreachable, the backend logs
     one warning and falls back to hitting Postgres directly — it never
     breaks a request.
   - `STORAGE_CHAT_ID` — your own numeric Telegram user id, used as the
     target chat when `POST /api/sync/migrate-to-bot` re-uploads
     GramJS-backfilled media through the bot to mint permanent Bot-API
     file_ids. Message **@userinfobot** on Telegram to get it (only needed
     if/when you run that migration).

3. **Run the database migration**
   ```
   npx prisma migrate dev --name init
   ```

4. **One-time GramJS login** (generates `TELEGRAM_SESSION`)
   ```
   npm run gramjs:login
   ```
   This prompts for your phone number and the login code Telegram sends you
   (and your 2FA password if you have one set), then prints a StringSession.
   Paste it into `.env` as `TELEGRAM_SESSION`. This is a one-time, manual,
   interactive step — MTProto login cannot be scripted end-to-end, and it
   only needs to be done once per session string (it stays valid until you
   revoke it).

5. **Add the bot to the channel** as an admin (needed so it receives
   `channel_post` updates and can read files), and make sure the Telegram
   *account* you logged in with in step 4 has also seen the channel (e.g. is
   a member/subscriber) so GramJS can resolve it via `TELEGRAM_CHANNEL`.

6. **Run the dev server**
   ```
   npm run start:dev
   ```

7. **Kick off the historical backfill** once the server is running:
   ```
   curl -X POST http://localhost:3000/api/sync/full -H "x-admin-token: <ADMIN_TOKEN>"
   ```
   Poll progress with:
   ```
   curl http://localhost:3000/api/sync/status -H "x-admin-token: <ADMIN_TOKEN>"
   ```
   The backfill is resumable — if it's interrupted, POSTing `/api/sync/full`
   again picks up from `MAX(message_id)` already stored instead of restarting.

## Why two Telegram clients?

The Bot API (grammY) only ever sees messages from the moment the bot is
added to a chat/channel onward — it has no method to page through a
channel's full message history. To backfill everything posted *before* the
bot joined, we need a real user-account MTProto connection (GramJS), which
can page through the entire channel history via `iterMessages` regardless of
when it started. So:

- **GramJS** (`src/sync/gramjs.service.ts`) does the one-time (resumable)
  full historical backfill, walking the channel from the last synced
  `message_id` forward.
- **grammY** (`src/sync/bot.service.ts`) does realtime sync — it long-polls
  for new `channel_post` updates the instant they're posted — and also
  provides the Bot API `getFile` call used to resolve/download files for the
  public file/thumb proxy endpoints.

Both paths normalize whatever they see into the same internal shape
(`NormalizedTelegramMedia`) and go through one shared upsert
(`MediaSyncService`), keyed on `fileUniqueId`, so there's a single place that
owns "what a row in `channel_media` looks like" regardless of which client
observed the message.

### A note on `fileId` / thumbnail identifiers for backfilled media

Bot-API `file_id`/`file_unique_id` values are minted by Telegram per-bot and
are only handed out for messages the bot has actually seen (new updates).
GramJS (MTProto) has no equivalent "give me a Bot API file_id" call, so
media discovered via backfill has no real Bot API file_id to store.

To keep the file/thumb proxy endpoints working uniformly for both sources
without deviating from the documented schema or endpoints, backfilled rows
store a `gramjs:<messageId>` (and `gramjs:<messageId>:thumb`) reference in
the `fileId`/`thumbFileUniqueId` columns instead of a real Bot API id. The
media file/thumb proxy (`src/media/media-file.service.ts`) checks for this
prefix: if present, it re-fetches the message via the live GramJS client and
downloads the bytes directly (MTProto file download); otherwise it treats
the value as a real Bot API `file_id` and proxies through `getFile` +
Telegram's file server as usual. This is purely an internal implementation
detail — the public schema shape, endpoint paths, and JSON response shapes
are unchanged from `API_CONTRACT.md`.

Live-downloading every `gramjs:`-backed thumbnail/file on every request
doesn't scale (Telegram's own flood limits kick in once a gallery page
requests ~20-30 thumbnails at once) — `POST /api/sync/migrate-to-bot`
(`src/sync/migration.service.ts`) is the one-time fix: it walks every row
still prefixed `gramjs:`, downloads it once via GramJS, re-uploads it
through the bot to `STORAGE_CHAT_ID`, and overwrites `fileId`/
`fileUniqueId`/`thumbFileUniqueId` with the real, permanent Bot-API values
from the upload response — after which that row is served the same fast
way as realtime-synced media, no GramJS involved. It's resumable (only ever
selects rows still prefixed `gramjs:`) and self-rate-limits between rows.
Once it's fully caught up, `ENABLE_GRAMJS=false` is safe to set.

## Project layout

```
src/
  main.ts                 bootstrap, global prefix /api, CORS, ValidationPipe, BigInt fix
  app.module.ts            also wires TelegramAuthMiddleware globally (see below)
  prisma/                 PrismaService/PrismaModule (global)
  redis/                  RedisService/RedisModule (global) — best-effort cache, see media.service.ts
  common/                 guards, interceptor, telegram-auth.util.ts, category/link-extraction utils
  media/                  GET /api/media, /search, /:id, /file/:fileUniqueId, /thumb/:fileUniqueId
  favorites/              GET/POST/DELETE /api/favorites — requires x-telegram-init-data
  sync/                   MediaSyncService, GramjsService, BotService, MigrationService,
                          POST /api/sync/full, GET /api/sync/status,
                          POST /api/sync/migrate-to-bot, GET /api/sync/migrate-status
scripts/
  gramjs-login.ts         one-time interactive MTProto login (npm run gramjs:login)
prisma/
  schema.prisma
```

## Telegram WebApp auth (`x-telegram-init-data`)

`TelegramAuthMiddleware` (registered globally in `app.module.ts`) validates
the `x-telegram-init-data` header — if present — on every request, per the
algorithm in `docs/API_CONTRACT.md` ("Telegram WebApp auth"), and stashes
the result (a `bigint` user id, or `null`) on the request object:

- `@TelegramUser()` (`src/common/decorators/telegram-user.decorator.ts`) —
  reads the stashed value, never throws. Used on the media endpoints, where
  auth is optional and only affects the `isFavorited` field.
- `TelegramAuthGuard` (`src/common/guards/telegram-auth.guard.ts`) — 401s if
  the stashed value is `null`. Used on the favorites endpoints, where auth
  is required.

The validation itself (`src/common/telegram-auth.util.ts`) is a pure
function with no NestJS dependency, so it's easy to unit test in isolation.

## Response caching (Redis)

`MediaService` caches `GET /api/media`, `/api/media/search`, and
`/api/media/:id` in Redis (`src/redis/redis.service.ts`), keyed by their
query params — TTL ~10 minutes for list/search, ~1 hour for a single item.
Only the *base* media fields are cached (never `isFavorited`, which is
per-user); the favorited flag is merged in after every cache read/miss via
one batched `Favorite` lookup for the ids on the page. Favorites endpoints
themselves are never cached (see `favorites.service.ts`). Every Redis call
is wrapped so a connection failure logs one warning and falls straight
through to Postgres — caching is purely a performance optimization, never a
hard dependency.

## What a human still needs to do

- Create a Telegram bot via @BotFather and get `BOT_TOKEN`.
- Register an app at https://my.telegram.org to get `TELEGRAM_API_ID` /
  `TELEGRAM_API_HASH`.
- Add the bot as an **admin** of the target channel (required for it to
  receive `channel_post` updates and read files).
- Run `npm run gramjs:login` interactively (needs a real phone number +
  the OTP Telegram sends) to produce `TELEGRAM_SESSION`.
- Provision a real PostgreSQL database and set `DATABASE_URL`.
- Choose an `ADMIN_TOKEN` secret and share it with whoever triggers
  `/api/sync/full` (e.g. a deploy hook or you, manually, once).
- Run `npx prisma migrate deploy` (or `migrate dev` locally) against that
  database before first boot.
- Get `STORAGE_CHAT_ID` from @userinfobot and set it, then once
  (post-deploy) call `POST /api/sync/migrate-to-bot` with `x-admin-token`
  to migrate GramJS-backfilled rows to permanent Bot-API file_ids. Poll
  `GET /api/sync/migrate-status` the same way as `/api/sync/status`.
- Provision the `redis` container (already in both `docker-compose.yml` and
  `docker-compose.prod.yml`) and set `REDIS_URL` — optional but recommended,
  the backend runs fine without it, just uncached.
