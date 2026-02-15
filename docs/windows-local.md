# Локальный запуск под Windows (Docker + pnpm)

## 0) Требования
- Windows 10/11
- Node.js 20+
- Docker Desktop
- Git
- PowerShell (или Windows Terminal)

## 1) Установка
1) Распакуйте архив в папку, например `C:\tgcasino`.
2) В корне проекта:
```powershell
corepack enable
pnpm i
```

## 2) .env
Скопируйте:
```powershell
copy .env.example .env
```

Минимально заполните:
- `TELEGRAM_BOT_TOKEN` (бот токен)
- `TELEGRAM_BOT_TOKEN_FOR_INITDATA` (тот же токен)
- `DEVICE_FINGERPRINT_SALT` (рандомная строка)
- `DATABASE_URL` (локальный докер — уже в примере)
- `REDIS_URL` (локальный докер — уже в примере)
- `NEXT_PUBLIC_BACKEND_URL=http://localhost:8080`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`

> Stars / TON можно не трогать для UI-теста в браузере. Для полного теста депозита — заполните `TELEGRAM_STARS_PROVIDER_TOKEN`, `TON_RECEIVER_ADDRESS`, `TONAPI_KEY/TONCENTER_API_KEY`.

## 3) Postgres + Redis (локально)
```powershell
docker compose up -d
```

## 4) Prisma миграции
```powershell
pnpm --filter backend db:generate
pnpm --filter backend db:migrate
```

## 5) Запуск (3 процесса)
Вариант А (всё сразу):
```powershell
pnpm dev
```

Вариант Б (в разных терминалах):
```powershell
pnpm --filter backend dev
pnpm --filter webapp dev
pnpm --filter bot dev
```

## 6) Открыть UI
- Webapp: http://localhost:3000
- Backend: http://localhost:8080/health

### Важно про Telegram initData локально
Если вы открываете Webapp **в обычном браузере**, Telegram initData отсутствует.
Поэтому backend в dev режиме отдаёт `/dev/initData`, а webapp автоматически подтягивает его и подставляет в заголовок `x-telegram-init-data`.

В проде этот endpoint отключён.

