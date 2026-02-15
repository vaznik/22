import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authFromInitData } from './services/telegramAuth';
import { CreateRoomSchema, JoinRoomSchema, SetSettingsSchema, signInitData } from '@tgcasino/shared';
import { createUserRoom, listRooms, joinRoom, roomDetails, history, refundRoom, ensureSystemRooms } from './services/roomService';
import { prisma } from './prisma';
import { env } from './env';
import { accountBalanceNano, fromNano, toNano } from './services/ledger';
import { confirmStarsPayment } from './services/paymentsStars';
import { verifyTonDeposit } from './services/tonVerify';
import { lockStake, unlockStake, stakingState, accrueRewards } from './services/stakingService';

const AuthHeaderSchema = z.object({
  'x-telegram-init-data': z.string().min(10),
  'x-device-id': z.string().min(8).optional(),
});

async function requireAuth(req: any) {
  const h = AuthHeaderSchema.parse(req.headers);
  return authFromInitData(h['x-telegram-init-data'], h['x-device-id']);
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true }));

  // Dev helper: generate a valid initData string for local browser testing (outside Telegram).
  // Enabled only when NODE_ENV !== 'production'.
  if (env.nodeEnv !== 'production') {
    app.get('/dev/initData', async (req: any) => {
      const q = req.query ?? {};
      const id = Number(q.id ?? 999000111);
      const username = String(q.username ?? 'local_user');
      const firstName = String(q.first_name ?? 'Local');
      const lastName = String(q.last_name ?? 'Tester');
      const language = String(q.lang ?? 'en');
      const startParam = String(q.start_param ?? '');

      const initData = signInitData(
        {
          auth_date: String(Math.floor(Date.now() / 1000)),
          query_id: 'dev_' + Math.random().toString(16).slice(2),
          user: JSON.stringify({
            id,
            username,
            first_name: firstName,
            last_name: lastName,
            language_code: language,
          }),
          ...(startParam ? { start_param: startParam } : {}),
        },
        env.telegramBotTokenForInitData,
      );

      return { ok: true, initData };
    });
  }


  app.get('/bootstrap', async () => {
    await ensureSystemRooms();
    return { ok: true };
  });

  app.get('/me', async (req) => {
    const auth = await requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    return { ok: true, user };
  });

  app.get('/balance', async (req) => {
    const auth = await requireAuth(req);
    const xtr = await accountBalanceNano(auth.userId, 'XTR');
    const ton = await accountBalanceNano(auth.userId, 'TON');
    return { ok: true, balances: { XTR: fromNano(xtr), TON: fromNano(ton) } };
  });

  app.get('/rooms', async (req: any) => {
    const auth = await requireAuth(req);
    void auth;
    const q = req.query ?? {};
    const currency = q.currency as any;
    const game = q.game as any;
    const kind = q.kind as any;
    const rooms = await listRooms({ currency, game, kind });
    return { ok: true, rooms };
  });

  app.post('/rooms', async (req: any) => {
    const auth = await requireAuth(req);
    const body = CreateRoomSchema.parse(req.body);
    const id = await createUserRoom({
      userId: auth.userId,
      currency: body.currency as any,
      game: body.game as any,
      stakeAmount: body.stakeAmount,
      maxPlayers: body.maxPlayers,
      startMode: body.startMode,
      startDelaySeconds: body.startDelaySeconds,
    });
    return { ok: true, roomId: id };
  });

  app.get('/rooms/:id', async (req: any) => {
    const auth = await requireAuth(req);
    void auth;
    const id = req.params.id;
    const details = await roomDetails(id);
    return { ok: true, room: details };
  });

  app.post('/rooms/:id/join', async (req: any) => {
    const auth = await requireAuth(req);
    const body = JoinRoomSchema.parse({ ...req.body, roomId: req.params.id });
    await joinRoom({ roomId: body.roomId, userId: auth.userId, clientSeed: body.clientSeed });
    return { ok: true };
  });

  app.post('/rooms/:id/refund', async (req: any) => {
    const auth = await requireAuth(req);
    void auth;
    await refundRoom(req.params.id);
    return { ok: true };
  });

  app.get('/history', async (req: any) => {
    const auth = await requireAuth(req);
    const items = await history(auth.userId);
    return { ok: true, items };
  });

  app.post('/settings', async (req: any) => {
    const auth = await requireAuth(req);
    const body = SetSettingsSchema.parse(req.body);
    await prisma.user.update({ where: { id: auth.userId }, data: body });
    return { ok: true };
  });

  // Backend endpoint called by bot on successful Stars payment
  app.post('/payments/stars/success', async (req: any) => {
    // Verify bot webhook secret to avoid spoofing
    const secret = req.headers['x-webhook-secret'];
    if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      throw app.httpErrors.unauthorized('bad_secret');
    }
    const body = z.object({
      tgUserId: z.string(),
      telegramPaymentChargeId: z.string(),
      totalAmountStars: z.number().int().positive(),
    }).parse(req.body);

    const tgUserId = BigInt(body.tgUserId);
    const user = await prisma.user.findUnique({ where: { tgUserId } });
    if (!user) throw app.httpErrors.notFound('user_not_found');

    const res = await confirmStarsPayment({
      userId: user.id,
      telegramPaymentChargeId: body.telegramPaymentChargeId,
      totalAmountStars: body.totalAmountStars,
      currency: 'XTR',
    });
    return { ok: true, ...res };
  });

  // TON deposit confirmation (client provides BOC + intent or room)
  app.post('/payments/ton/confirm', async (req: any) => {
    const auth = await requireAuth(req);
    const body = z
      .object({
        amountTon: z.string().min(1),
        to: z.string().min(10),
        boc: z.string().min(16).optional(),
        txHash: z.string().min(10).optional(),
      })
      .refine((v) => Boolean(v.boc || v.txHash), { message: 'boc_or_txHash_required' })
      .parse(req.body);

    // Receiver check (protect from malicious crediting to other address)
    if (body.to !== env.tonReceiverAddress) throw app.httpErrors.badRequest('bad_receiver');

    const amountNano = toNano('TON' as any, body.amountTon);

    // Verify on-chain via TonAPI/Toncenter (no blind trust)
    const vr = await verifyTonDeposit({
      boc: body.boc,
      txHash: body.txHash,
      expectedTo: env.tonReceiverAddress,
      expectedAmountNano: amountNano,
    });

    if (!vr.ok) {
      // For NOT_FOUND_YET we want client to retry/poll.
      // We return 400 with a stable error code string.
      if (vr.reason === 'NOT_FOUND_YET') throw app.httpErrors.badRequest('ton_not_found_yet');
      throw app.httpErrors.badRequest('ton_verify_failed:' + vr.reason);
    }

    const providerRef = vr.msgHash || vr.txHash || body.txHash || 'unknown';
    const idemKey = `ton:${providerRef}`;

    // Idempotency (repeat-safe)
    const existing = await prisma.paymentIntent.findUnique({ where: { idempotencyKey: idemKey } });
    if (existing) return { ok: true, already: true };

    await prisma.paymentIntent.create({
      data: {
        userId: auth.userId,
        provider: 'TON',
        currency: 'TON',
        amountNano,
        status: 'CONFIRMED',
        idempotencyKey: idemKey,
        providerRef,
        confirmedAt: new Date(),
      },
    });

    await prisma.$transaction(async (tx) => {
      const account = await tx.account.upsert({
        where: { userId_currency: { userId: auth.userId, currency: 'TON' } },
        create: { userId: auth.userId, currency: 'TON' },
        update: {},
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          type: 'DEPOSIT',
          amountNano,
          refType: 'TON',
          refId: providerRef,
        },
      });
    });

    return { ok: true, already: false, providerRef, confirmedVia: vr.confirmedVia };
  });
  });

  // Staking
  app.get('/staking', async (req: any) => {
    const auth = await requireAuth(req);
    await accrueRewards(auth.userId);
    const state = await stakingState(auth.userId);
    return { ok: true, stakes: state };
  });

  app.post('/staking/lock', async (req: any) => {
    const auth = await requireAuth(req);
    const body = z.object({ amountTon: z.string(), lockSeconds: z.number().int().min(3600) }).parse(req.body);
    const id = await lockStake(auth.userId, toNano('TON' as any, body.amountTon), body.lockSeconds);
    return { ok: true, stakeId: id };
  });

  app.post('/staking/unlock', async (req: any) => {
    const auth = await requireAuth(req);
    const body = z.object({ stakeId: z.string().uuid() }).parse(req.body);
    await unlockStake(auth.userId, body.stakeId);
    return { ok: true };
  });

  // Referrals
  app.get('/referrals', async (req: any) => {
    const auth = await requireAuth(req);
    const count = await prisma.referral.count({ where: { inviterId: auth.userId } });
    const last = await prisma.referral.findMany({ where: { inviterId: auth.userId }, orderBy: { createdAt: 'desc' }, take: 20, include: { invitee: true } });
    return { ok: true, count, last: last.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), invitee: { username: r.invitee.username, firstName: r.invitee.firstName } })) };
  });
}
