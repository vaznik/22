# Бесплатный деплой под Windows: Render + Cloudflare Pages + Supabase + Upstash

Ниже — максимально прямой «копи‑паст» план, чтобы поднять **backend + bot** на Render, **webapp** на Cloudflare Pages, **Postgres** на Supabase и **Redis** на Upstash.

> Важно: Telegram Mini Apps требуют HTTPS для боевого запуска. Локально вы можете гонять UI в браузере (без Telegram) — проект это поддерживает через `/dev/initData`.

---

## 0) Что нужно заранее
- Аккаунты: GitHub, Render, Cloudflare, Supabase, Upstash.
- Node.js 20+ (на проде/CI), локально — тоже.
- В BotFather:
  - создать бота и получить `TELEGRAM_BOT_TOKEN`
  - создать Mini App (Web App) и получить **shortname** (нужен для рефералки через `startapp`)

---

## 1) GitHub
1. Создайте репозиторий на GitHub.
2. Залейте туда этот монорепо (из архива):
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git push -u origin main
   ```

---

## 2) Supabase (Postgres)
1. Create project в Supabase.
2. Settings → Database → Connection string → скопируйте **URI**.
3. В `DATABASE_URL` добавьте `?sslmode=require` если его нет.

Пример:
`postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres?sslmode=require`

---

## 3) Upstash (Redis)
1. Создайте Redis database (Free).
2. Скопируйте `REDIS_URL` (обычно начинается с `rediss://...`).
3. На Render выставьте:
   - `REDIS_URL=<...>`
   - `REDIS_TLS=1`

---

## 4) Render: Backend (Fastify + Prisma + BullMQ)
1. Render → **New** → **Web Service** → подключите GitHub репозиторий.
2. Name: `tgcasino-backend`
3. Runtime: Node
4. Build Command:
   ```bash
   corepack enable && pnpm i --frozen-lockfile=false && pnpm --filter backend db:generate && pnpm --filter backend build
   ```
5. Start Command:
   ```bash
   pnpm --filter backend db:migrate && pnpm --filter backend start
   ```
6. Environment Variables (примерный минимум):
   - `NODE_ENV=production`
   - `DATABASE_URL=<supabase url>`
   - `REDIS_URL=<upstash url>`
   - `REDIS_TLS=1`
   - `CORS_ORIGINS=https://*.pages.dev,https://<your-pages-domain>`
   - `TELEGRAM_BOT_TOKEN_FOR_INITDATA=<ваш TELEGRAM_BOT_TOKEN>`
   - `DEVICE_FINGERPRINT_SALT=<рандомная длинная строка>`
   - `TON_RECEIVER_ADDRESS=<ваш TON адрес (EQ...)>`
   - `TONCENTER_API_KEY=<ключ toncenter (optional)>`
   - `TONAPI_KEY=<ключ TonAPI (желательно, для decode BOC)>`

7. После деплоя скопируйте публичный URL backend’а:
   - `https://tgcasino-backend.onrender.com` (пример)

---

## 5) Render: Bot (Telegraf + Stars payments)
1. Render → **New** → **Web Service** → тот же GitHub repo.
2. Name: `tgcasino-bot`
3. Build Command:
   ```bash
   corepack enable && pnpm i --frozen-lockfile=false && pnpm --filter bot build
   ```
4. Start Command:
   ```bash
   pnpm --filter bot start
   ```
5. Env vars:
   - `NODE_ENV=production`
   - `TELEGRAM_BOT_TOKEN=<bot token>`
   - `TELEGRAM_STARS_PROVIDER_TOKEN=<stars provider token из BotFather>`
   - `TELEGRAM_WEBHOOK_SECRET=<рандомная длинная строка>`
   - `TELEGRAM_WEBHOOK_PATH=/tg/webhook`
   - `BACKEND_PUBLIC_URL=<Render backend URL>`
   - `PUBLIC_WEBAPP_URL=<Cloudflare Pages URL (позже вставите)>`

6. Deploy. Скопируйте URL бота на Render (пример):
   - `https://tgcasino-bot.onrender.com`

---

## 6) Cloudflare Pages: Webapp (Next.js static export)
1. Cloudflare → Pages → Create a project → Connect to GitHub repo.
2. Framework preset: **None** (мы сами задаём команды).
3. Build command:
   ```bash
   corepack enable && pnpm i --frozen-lockfile=false && pnpm --filter webapp build
   ```
4. Output directory:
   ```
   packages/webapp/out
   ```
5. Environment variables (в Pages → Settings → Environment variables):
   - `NEXT_PUBLIC_BACKEND_URL=<Render backend URL>`
   - `NEXT_PUBLIC_BOT_USERNAME=<username бота без @>`
   - `NEXT_PUBLIC_WEBAPP_SHORTNAME=<shortname mini app из BotFather>`
   - `NEXT_PUBLIC_TON_NETWORK=mainnet`
   - `NEXT_PUBLIC_TON_RECEIVER_ADDRESS=<ваш TON адрес>`
   - `NEXT_PUBLIC_TONCONNECT_MANIFEST_URL=https://<your-pages-domain>/tonconnect-manifest.json`
   - `NEXT_PUBLIC_APP_URL=https://<your-pages-domain>`  (для автогенерации tonconnect-manifest)
   - `NEXT_PUBLIC_APP_NAME=Casino Rooms`

6. Deploy. Получите `https://<project>.pages.dev` или свой домен.

---

## 7) Вернитесь в Render Bot и обновите PUBLIC_WEBAPP_URL
В сервисе `tgcasino-bot` → Environment:
- `PUBLIC_WEBAPP_URL=https://<your-pages-domain>`

Redeploy.

---

## 8) BotFather: Mini App + Menu Button
1. `/mybots` → выберите бота → **Bot Settings** → **Menu Button**:
   - URL = `https://<your-pages-domain>`
2. Mini App / Web App:
   - создайте Web App и задайте **shortname** (нужно для рефералки)
   - URL = `https://<your-pages-domain>`

---

## 9) Telegram Webhook (обязательный шаг)
Выполните из PowerShell (или Git Bash) команду:

```powershell
$token = "<TELEGRAM_BOT_TOKEN>"
$url = "https://<tgcasino-bot.onrender.com>/tg/webhook"
$secret = "<TELEGRAM_WEBHOOK_SECRET>"

curl -X POST "https://api.telegram.org/bot$token/setWebhook" `
  -d "url=$url" `
  -d "secret_token=$secret"
```

Проверка:
```powershell
curl "https://api.telegram.org/bot$token/getWebhookInfo"
```

---

## 10) Что должно заработать
- Открываете Mini App через Menu Button → Lobby показывает комнаты.
- Создание user-room.
- Join → списание ставки (ledger-only) → settle → история.
- Deposit:
  - Stars: через `/deposit` в боте (инвойс)
  - TON: через TonConnect → backend подтверждает (TonAPI/Toncenter) → кредитует

---

## 11) Рефералка (правильный линк)
В UI генерируется ссылка:
`https://t.me/<BOT_USERNAME>/<WEBAPP_SHORTNAME>?startapp=ref_<tgUserId>`

Именно `startapp` даёт `start_param` в initData, и backend создаёт referral (с лимитами на девайс).

