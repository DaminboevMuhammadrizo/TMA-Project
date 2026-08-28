# API Contract — Telegram Media Gallery

Shared contract between backend (NestJS) and frontend (React TMA). Both sides
must conform to this exactly — it is the only thing keeping them in sync
since they are built independently.

## Enums

```
Category:  AUDIO | VIDEO | IMAGE_STICKER
MediaType: AUDIO | VOICE | VIDEO | VIDEO_NOTE | PHOTO | ANIMATION | STICKER
```

Category is derived from MediaType:
- AUDIO, VOICE            -> AUDIO
- VIDEO, VIDEO_NOTE, ANIMATION -> VIDEO
- PHOTO, STICKER          -> IMAGE_STICKER

## Prisma model (channel_media)

```
id                  Int       @id @default(autoincrement())
messageId           BigInt    @unique @map("message_id")
category             Category
mediaType             MediaType @map("media_type")
fileId               String    @map("file_id")
fileUniqueId         String    @unique @map("file_unique_id")
caption              String?
links                String[]  @default([])
replyToMessageId     BigInt?   @map("reply_to_message_id")
replyToText          String?   @map("reply_to_text")
viewsCount           Int       @default(0) @map("views_count")
mimeType             String?   @map("mime_type")
fileSize             Int?      @map("file_size")
durationSec          Int?      @map("duration_sec")
width                Int?
height               Int?
fileName             String?   @map("file_name")
thumbFileUniqueId    String?   @map("thumb_file_unique_id")
stickerSetName       String?   @map("sticker_set_name")
createdAt            DateTime  @map("created_at")   // original Telegram post date
syncedAt             DateTime  @default(now()) @map("synced_at")

@@map("channel_media")
```

## REST Endpoints (base path `/api`)

### GET /api/media
Query params:
- `category` optional: AUDIO | VIDEO | IMAGE_STICKER
- `mediaType` optional: one of MediaType
- `page` optional, default 1
- `limit` optional, default 24, max 100

Response 200:
```json
{
  "data": [ MediaItem, ... ],
  "meta": { "page": 1, "limit": 24, "total": 123, "totalPages": 6 }
}
```

### GET /api/media/search
Query params:
- `q` required, min 1 char — matches caption, links, replyToText (case-insensitive)
- `category` optional
- `page`, `limit` — same as above

Response: same shape as GET /api/media.

### GET /api/media/:id
Response 200: `MediaItem` (with full reply/links detail). 404 if not found.

### GET /api/media/file/:fileUniqueId
Streams/proxies the actual file bytes from Telegram (via Bot API `getFile` +
download), so the frontend can use it directly as `src`. Sets correct
`Content-Type`. Cached with `Cache-Control: public, max-age=31536000,
immutable` since Telegram file content for a given file_unique_id never
changes. 404 if unknown fileUniqueId.

### GET /api/media/thumb/:fileUniqueId
Same as above but for the thumbnail (used for grid rendering of
video/animation/document previews). Falls back to 404 if no thumb exists —
frontend should fall back to the full file URL in that case (e.g. for PHOTO).

**Path convention**: `fileUrl`/`thumbUrl` in the JSON response are relative
to the API root WITHOUT the `/api` prefix — i.e. `/media/file/:id`, NOT
`/api/media/file/:id` (see `MediaItem` below and "Notes for frontend"). The
frontend prepends `VITE_API_BASE_URL`, which already includes `/api`, so
including `/api` in both places would double it up
(`.../api/api/media/file/...`). Controller route paths themselves are still
mounted under the global `/api` prefix as normal (Nest's `app.setGlobalPrefix('api')`
handles that) — only the *string value* returned in the JSON body omits it.

### POST /api/sync/full
Admin-only (header `x-admin-token: <ADMIN_TOKEN>`). Kicks off/resumes the
full historical sync via GramJS. Response `202 { "status": "started" }` or
`{ "status": "already_running" }`.

### GET /api/sync/status
Admin-only. Returns `{ "running": bool, "lastMessageIdSynced": number|null,
"totalSynced": number, "lastError": string|null }`.

## MediaItem (JSON shape returned by the API)

```ts
interface MediaItem {
  id: number;
  messageId: number;
  category: 'AUDIO' | 'VIDEO' | 'IMAGE_STICKER';
  mediaType: 'AUDIO' | 'VOICE' | 'VIDEO' | 'VIDEO_NOTE' | 'PHOTO' | 'ANIMATION' | 'STICKER';
  fileId: string;
  fileUniqueId: string;
  fileUrl: string;          // = `/media/file/${fileUniqueId}` (NO /api prefix — see path convention note above)
  thumbUrl: string | null;  // = `/media/thumb/${fileUniqueId}` or null (NO /api prefix)
  caption: string | null;
  links: string[];
  replyToMessageId: number | null;
  replyToText: string | null;
  viewsCount: number;
  mimeType: string | null;
  fileSize: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fileName: string | null;
  stickerSetName: string | null;
  createdAt: string; // ISO 8601
}
```

## v2 additions — favorites, auth, migration, caching

### Telegram WebApp auth (`x-telegram-init-data` header)

Any endpoint that needs to know *which* Telegram user is calling reads the
raw `window.Telegram.WebApp.initData` string, sent verbatim by the frontend
as the `x-telegram-init-data` header on every request that needs it
(favorites endpoints always; `GET /api/media*` optionally, to enrich results
with `isFavorited`).

Backend validation (standard Telegram algorithm — see
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
1. Parse the header as a query string into key/value pairs.
2. Remove `hash`, sort the remaining keys alphabetically, join as
   `key=value` lines joined by `\n` → `data_check_string`.
3. `secret_key = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN)`
4. `computed_hash = HMAC_SHA256(key=secret_key, data=data_check_string)` (hex)
5. Reject (401) if `computed_hash !== hash`, or if `auth_date` is older than
   24h (replay protection).
6. The Telegram user's numeric id comes from the JSON-encoded `user` field
   once validated: `JSON.parse(params.get('user')).id`.

Endpoints that require this header return `401` if it's missing or invalid.
Endpoints where it's optional (`GET /api/media*`) simply omit the
`isFavorited` enrichment (defaults to `false`) if absent/invalid — they must
NOT reject the request.

### MediaItem — new field

```ts
interface MediaItem {
  // ...all fields as above, plus:
  isFavorited: boolean; // false if x-telegram-init-data absent/invalid
}
```

### GET /api/favorites
Requires `x-telegram-init-data`. Query params: `page`, `limit` (same
defaults as `GET /api/media`). Response: same paginated shape as
`GET /api/media`, containing only that user's favorited items
(`isFavorited: true` on all of them), newest-favorited first.

### POST /api/favorites/:mediaId
Requires `x-telegram-init-data`. Adds `mediaId` (the `MediaItem.id`, not
`fileUniqueId`) to the caller's favorites. Idempotent (favoriting twice is a
no-op, not an error). Response `204`. `404` if `mediaId` doesn't exist.

### DELETE /api/favorites/:mediaId
Requires `x-telegram-init-data`. Removes the favorite. Idempotent. Response
`204`.

### Prisma model — Favorite

```
model Favorite {
  id             Int      @id @default(autoincrement())
  telegramUserId BigInt   @map("telegram_user_id")
  mediaId        Int      @map("media_id")
  media          ChannelMedia @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now()) @map("created_at")

  @@unique([telegramUserId, mediaId])
  @@map("favorites")
}
```

### POST /api/sync/migrate-to-bot
Admin-only (`x-admin-token`). One-time migration: for every `channel_media`
row whose `fileId` starts with `gramjs:` (backfilled media with no permanent
Bot-API file_id), downloads the bytes once via GramJS and re-uploads them
through the bot to a private storage chat (`STORAGE_CHAT_ID` env var — the
admin's own Telegram user id, i.e. their private chat with the bot), then
overwrites `fileId`/`fileUniqueId`/`thumbFileUniqueId` with the real,
permanent Bot-API values from the upload response. Resumable (only touches
rows still prefixed `gramjs:`). Response `202 { "status": "started" }` /
`{ "status": "already_running" }`. Purpose: after this completes, GramJS is
no longer needed to *serve* any media (only relevant if you ever want to
backfill an even-older range again), so `ENABLE_GRAMJS=false` becomes safe.

### GET /api/sync/migrate-status
Admin-only. Returns `{ "running": bool, "migrated": number, "remaining":
number, "lastError": string|null }`.

### Redis caching (backend-internal, not frontend-facing)
`GET /api/media`, `/api/media/search`, `/api/media/:id` responses are cached
in Redis keyed by their full query params, TTL ~10 minutes (list/search) /
~1 hour (single item by id — rarely changes). Cache is best-effort: a Redis
outage must degrade to hitting Postgres directly, never break the request.
Favorites responses are NOT cached (per-user, cheap query, must stay fresh
after a POST/DELETE).

## Environment variables

Backend `.env`:
```
DATABASE_URL=postgresql://user:pass@host:5432/tma_gallery
ENABLE_GRAMJS=true          # set "false" after the one-time historical backfill to stop GramJS connecting on startup
TELEGRAM_API_ID=            # from my.telegram.org, for GramJS
TELEGRAM_API_HASH=
TELEGRAM_SESSION=           # GramJS StringSession, obtained via one-time login script
TELEGRAM_CHANNEL=           # @channelusername or numeric id
BOT_TOKEN=                  # from @BotFather, for grammY realtime listener + file proxy
MINI_APP_URL=                # https://your-domain, shown as the "Open App" button on /start (must be HTTPS)
STORAGE_CHAT_ID=             # your own numeric Telegram user id (get it from @userinfobot) — used as the target chat when POST /api/sync/migrate-to-bot re-uploads backfilled media through the bot
REDIS_URL=redis://redis:6379 # dedicated Redis container (see docker-compose.prod.yml), NOT the VPS's other prohome_redis
ADMIN_TOKEN=                # shared secret for /api/sync/* endpoints
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

Frontend `.env`:
```
VITE_API_BASE_URL=http://localhost:3000/api
```

## Notes for frontend

- Build `fileUrl`/`thumbUrl` as `${VITE_API_BASE_URL}${item.fileUrl}` — the
  API returns paths relative to the API root, not the origin.
- `viewsCount`, `durationSec` etc. can be `null`/`0` — always guard.
- Pagination is 1-indexed.
- Send `window.Telegram.WebApp.initData` as the `x-telegram-init-data`
  header on every API call (list/search/detail AND favorites) — outside
  Telegram this will be an empty string, which the backend treats as
  "anonymous" (no `isFavorited` enrichment, favorites endpoints 401).
- Use native `loading="lazy"` plus an `IntersectionObserver`-driven
  skeleton for grid images/thumbs — with ~1900 items, everything must not
  attempt to load at once.
