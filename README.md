# Telegram Media Gallery (TMA)

Belgilangan Telegram kanaldagi multimedialarni (audio, video, rasm, GIF,
stiker) avtomatik skanerlab PostgreSQL'ga saqlaydi va Telegram Mini App
orqali zamonaviy galereya ko'rinishida taqdim etadi.

## Struktura

```
backend/               NestJS + Prisma + PostgreSQL + GramJS/grammY sync engine + REST API
frontend/              React + Vite + Tailwind + Telegram WebApp SDK Mini App
docs/                  API_CONTRACT.md — backend/frontend o'rtasidagi shartnoma
.github/workflows/     deploy.yml — CI/CD (SSH orqali VPS'ga clone+build+deploy)
docker-compose.yml     local dev uchun (o'z Postgres'i bilan)
docker-compose.prod.yml  production uchun (tayyor image'larni pull qiladi, mavjud VPS Postgres'iga ulanadi)
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

## CI/CD — GitHub Actions orqali VPS'ga avtomatik deploy

`main` branch'ga push qilinganda `.github/workflows/deploy.yml` avtomatik ishlaydi (loyihaning boshqa `ProHome` layihalaridagi deploy uslubiga mos): SSH orqali VPS'ga ulanadi, repo'ni `/var/www/tma-gallery`ga clone/pull qiladi (yoki yangilaydi), `backend/.env`ni secret'dan yozadi, `docker compose -f docker-compose.prod.yml build --no-cache` bilan image'larni to'g'ridan-to'g'ri **serverning o'zida** quradi, **Prisma migratsiyalarni ishga tushiradi** (`prisma migrate deploy`), va konteynerlarni qayta ko'taradi (`up -d`).

### Kerakli GitHub Secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Qiymati |
|---|---|
| `SERVER_HOST` | VPS IP manzili |
| `SERVER_USER` | SSH user, masalan `root` |
| `SERVER_SSH_KEY` | SSH private key (to'liq matni) |
| `SERVER_PORT` | SSH port (boshqa loyihalaringizda `2299` ishlatilgan bo'lsa, xuddi shu qiymat) |
| `GH_TOKEN` | GitHub Personal Access Token (`repo` scope) — private repo'ni serverga clone/pull qilish uchun |
| `BACKEND_ENV_FILE` | backend `.env` faylining to'liq matni (pastga qarang) |
| `VITE_API_BASE_URL` | masalan `http://<VPS_IP>:3010/api` (frontend build-vaqtida kerak) |

`BACKEND_ENV_FILE` sifatida quyidagi shablonni to'ldirib qo'ying (bitta secret ichida butun `.env` matni):
```
DATABASE_URL=postgresql://tma_user:<PAROL>@host.docker.internal:5432/tma_gallery
ENABLE_GRAMJS=true
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION=...
TELEGRAM_CHANNEL=...
BOT_TOKEN=...
ADMIN_TOKEN=...
PORT=3000
CORS_ORIGIN=http://<VPS_IP>:8082
```

### VPS'da bir martalik tayyorgarlik (mavjud `prohome_postgres`ni qayta ishlatish)

Loyihamiz uchun alohida, izolyatsiyalangan user va database yarating (boshqa loyihaga tegmaydi):
```bash
docker exec -it prohome_postgres psql -U postgres -c "CREATE USER tma_user WITH PASSWORD '<KUCHLI_PAROL>';"
docker exec -it prohome_postgres psql -U postgres -c "CREATE DATABASE tma_gallery OWNER tma_user;"
```
Backend konteyneri bu Postgres'ga `host.docker.internal:5432` orqali ulanadi (`docker-compose.prod.yml`da `extra_hosts` sozlangan) — chunki `prohome_postgres` allaqachon `0.0.0.0:5432`ga chiqarilgan, alohida Postgres konteyner ko'tarish shart emas.

**Portlar**: VPS'da `3000` (`prohome_app`) va `5173` (`kotibam`) band bo'lgani uchun bu loyiha `3010` (backend) va `8082` (frontend) portlarini ishlatadi — xohlasangiz `docker-compose.prod.yml`da o'zgartirishingiz mumkin.

### Tarixiy backfill'dan keyin GramJS'ni o'chirish

Backfill (`POST /api/sync/full`) tugagach:
1. `BACKEND_ENV_FILE` secret'ida `ENABLE_GRAMJS=false` qiling.
2. Xohlasangiz, Telegram'da (Sozlamalar → Qurilmalar) shu session'ni ham bekor qiling.
3. `main`ga istalgan kichik commit push qiling (workflow shunda qayta ishga tushadi) — backend qayta deploy bo'ladi, GramJS endi ulanmaydi, faqat bot yangi postlarni kuzatib boradi.

## Domen + HTTPS (Telegram Mini App shart qiladi)

Telegram Mini App faqat HTTPS orqali ochiladi — shuning uchun frontend'ni oddiy `http://<VPS_IP>:8082` emas, domen orqali HTTPS bilan ochish kerak. `deploy/nginx/tma.zamon-agency.uz.conf` — VPS'dagi host-level Nginx uchun tayyor konfiguratsiya (`/api/*`ni backend'ga, qolganini frontend'ga yo'naltiradi).

**VPS'da bir martalik sozlash** (SSH orqali kirib):
```bash
# Agar host-level Nginx hali o'rnatilmagan bo'lsa:
apt update && apt install -y nginx certbot python3-certbot-nginx

# Config faylni joylashtiring (repo /var/www/tma-gallery'ga clone qilingan bo'lsa, shundan nusxalash mumkin):
cp /var/www/tma-gallery/deploy/nginx/tma.zamon-agency.uz.conf /etc/nginx/sites-available/tma.zamon-agency.uz.conf
ln -s /etc/nginx/sites-available/tma.zamon-agency.uz.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL sertifikat oling (avtomatik HTTPS'ga sozlaydi, http->https redirect qo'shadi):
certbot --nginx -d tma.zamon-agency.uz
```

**Keyin GitHub Secrets'ni yangilang** (chunki `VITE_API_BASE_URL` build-vaqtida "qotib qoladi", va `CORS_ORIGIN` backend'da domenni tan olishi kerak):
- `VITE_API_BASE_URL` → `https://tma.zamon-agency.uz/api`
- `BACKEND_ENV_FILE` ichidagi `CORS_ORIGIN` qatorini → `https://tma.zamon-agency.uz`

Shundan so'ng `main`ga kichik commit push qiling — frontend yangi API manzili bilan qayta build bo'ladi, backend esa yangi domendan kelgan so'rovlarni CORS orqali qabul qiladi.

## Ma'lum cheklovlar

- **Share/forward**: Telegram WebApp JS SDK'da faylni aynan forward qiluvchi native API yo'q — eng yaqin alternativa (`t.me/share/url` chat tanlagich) ishlatilgan.
- **Animatsiyali stikerlar (.tgs)**: Lottie formatida, oddiy `&lt;img&gt;` bilan ko'rsatib bo'lmaydi — thumbnail statik rasm sifatida ko'rsatiladi.
- `telegram` (GramJS) npm paketi deprecated deb belgilangan (fork: `teleproto`) — hozircha ishlayapti, lekin kelajakda almashtirish kerak bo'lishi mumkin.
