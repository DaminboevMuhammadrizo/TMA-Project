# Telegram Media Gallery (TMA)

Belgilangan Telegram kanaldagi multimedialarni (audio, video, rasm, GIF,
stiker) avtomatik skanerlab PostgreSQL'ga saqlaydi va Telegram Mini App
orqali zamonaviy galereya ko'rinishida taqdim etadi.

## Struktura

```
backend/    NestJS + Prisma + PostgreSQL + GramJS/grammY sync engine + REST API
frontend/   React + Vite + Tailwind + Telegram WebApp SDK Mini App
docs/       API_CONTRACT.md — backend/frontend o'rtasidagi shartnoma
docker-compose.yml
```

## Tezkor boshlash (local dev)

1. Postgres'ni ko'tarish: `docker compose up -d postgres`
2. Backend: `cd backend && cp .env.example .env` (qiymatlarni to'ldiring) `&& npm install && npx prisma migrate dev && npm run start:dev`
3. GramJS uchun bir martalik login: `cd backend && npm run gramjs:login` — StringSession'ni `.env`'ga yozib qo'yadi.
4. Frontend: `cd frontend && cp .env.example .env && npm install && npm run dev`

Batafsil: har bir papkadagi README.md.

## Roadmap holati

- [x] 1-Bosqich: Backend skeleton (NestJS, Prisma schema, DB)
- [x] 2-Bosqich: Parser (GramJS initial sync + grammY realtime)
- [x] 3-Bosqich: REST API (pagination, filtering, search, file proxy)
- [x] 4-Bosqich: Frontend (Mini App UI, pleyerlar, hover/modal, share)
- [ ] 5-Bosqich: Production deploy (VPS'da real credential'lar bilan) — quyidagi "Keyingi qadamlar"ga qarang

## Keyingi qadamlar (5-Bosqich uchun sizdan kerak bo'ladigan narsalar)

1. **Bot yaratish**: @BotFather orqali yangi bot yarating → `BOT_TOKEN` oling, botni kanalga **admin** qilib qo'shing.
2. **Telegram API ID/Hash**: my.telegram.org saytida ilova ro'yxatdan o'tkazing → `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`.
3. `backend/.env.example`'ni `.env`ga nusxalab, yuqoridagilar + `TELEGRAM_CHANNEL`, `ADMIN_TOKEN`, VPS'dagi Docker Postgres uchun `DATABASE_URL`ni to'ldiring.
4. `npm run gramjs:login` — interaktiv, real telefon raqami va SMS-kod talab qiladi — natijadagi StringSession'ni `.env`ga `TELEGRAM_SESSION` sifatida qo'shing.
5. `npx prisma migrate dev --name init` — bazani migratsiya qiling.
6. Backendni ishga tushiring, so'ng `POST /api/sync/full` (`x-admin-token` header bilan) chaqirib to'liq tarixiy sinxronizatsiyani boshlang.
7. Frontendda `VITE_API_BASE_URL`ni production backend manziliga o'rnating (build vaqtida "qotib qoladi" — o'zgartirsangiz qayta build kerak).
8. BotFather'da `/newapp` yoki `/myapps` → Mini App URL'ni deploy qilingan frontend manziliga o'rnating.

## Ma'lum cheklovlar

- **Share/forward**: Telegram WebApp JS SDK'da faylni aynan forward qiluvchi native API yo'q — eng yaqin alternativa (`t.me/share/url` chat tanlagich) ishlatilgan.
- **Animatsiyali stikerlar (.tgs)**: Lottie formatida, oddiy `&lt;img&gt;` bilan ko'rsatib bo'lmaydi — thumbnail statik rasm sifatida ko'rsatiladi.
- `telegram` (GramJS) npm paketi deprecated deb belgilangan (fork: `teleproto`) — hozircha ishlayapti, lekin kelajakda almashtirish kerak bo'lishi mumkin.
