# Telegram Mini App Casino Rooms (Monorepo)

Monorepo: **backend (Fastify)** + **bot (Telegraf)** + **webapp (Next.js)** + **shared** (types/validation/fairness)

- Payments:
  - **Telegram Stars (XTR)** via Bot Payments API (invoice → pre_checkout_query → successful_payment).
  - **TON** via TonConnect on frontend + backend verifies tx via TonAPI / toncenter.
  - Gift-mode: deposit via Stars (user converts Gifts → Stars themselves).

- Security:
  - Strict Telegram WebApp `initData` verification on backend
  - commit-reveal provably fair
  - ledger-only balance model
  - idempotency for payments/webhooks
  - Redis locks for join/start/settle
  - rate limiting
  - soft anti-multiaccount (device fingerprint + cooldown + referral limits)
  - refund for cancelled rooms

## Quick start (Windows)
See `docs/windows-local.md` and `docs/deploy.md`.

## Workspaces
- packages/shared
- packages/backend
- packages/bot
- packages/webapp


## TonConnect note
TonConnect provider is mounted via a Client Component (`packages/webapp/app/providers.tsx`) to avoid RSC issues in Next.js App Router.
