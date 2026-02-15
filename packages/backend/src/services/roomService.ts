import { prisma } from '../prisma';
import { withLock } from '../redis';
import { roomQueue } from '../bull';
import { commitHash, makeServerSeed, rouletteOutcome, coinflipOutcome, jackpotOutcome, crashOutcome } from '@tgcasino/shared';
import { Currency, GameKind, RoomKind, RoomStatus } from '@prisma/client';
import { addEntry, accountBalanceNano, fromNano, toNano } from './ledger';
import { idempotencyGuard } from './idempotency';

const SYSTEM_STAKES_XTR = ['10', '50', '100'];
const SYSTEM_STAKES_TON = ['0.1', '0.5', '1'];

export async function ensureSystemRooms() {
  // Create system rooms for each currency/game/stake combination (roulette + coinflip + jackpot)
  const configs: Array<{ currency: Currency; game: GameKind; stake: string; maxPlayers: number }> = [];
  for (const s of SYSTEM_STAKES_XTR) {
    configs.push({ currency: 'XTR', game: 'ROULETTE', stake: s, maxPlayers: 20 });
    configs.push({ currency: 'XTR', game: 'COINFLIP', stake: s, maxPlayers: 2 });
    configs.push({ currency: 'XTR', game: 'JACKPOT', stake: s, maxPlayers: 30 });
  }
  for (const s of SYSTEM_STAKES_TON) {
    configs.push({ currency: 'TON', game: 'ROULETTE', stake: s, maxPlayers: 20 });
    configs.push({ currency: 'TON', game: 'COINFLIP', stake: s, maxPlayers: 2 });
    configs.push({ currency: 'TON', game: 'JACKPOT', stake: s, maxPlayers: 30 });
  }

  for (const c of configs) {
    const stakeNano = toNano(c.currency, c.stake);
    const existing = await prisma.room.findFirst({
      where: { kind: 'SYSTEM', currency: c.currency, game: c.game, stakeAmountNano: stakeNano, status: { in: ['OPEN','LOCKED'] } },
    });
    if (!existing) {
      const serverSeed = makeServerSeed();
      await prisma.room.create({
        data: {
          kind: 'SYSTEM',
          currency: c.currency,
          game: c.game,
          stakeAmountNano: stakeNano,
          maxPlayers: c.maxPlayers,
          startMode: 'FILL',
          serverSeedHash: commitHash(serverSeed),
          serverSeed,
          nonce: 0,
          status: 'OPEN',
        },
      });
    }
  }
}

export async function listRooms(params: { currency?: Currency; game?: GameKind; kind?: RoomKind }) {
  const where: any = {};
  if (params.currency) where.currency = params.currency;
  if (params.game) where.game = params.game;
  if (params.kind) where.kind = params.kind;
  where.status = { in: ['OPEN', 'LOCKED', 'RUNNING'] };

  const rooms = await prisma.room.findMany({
    where,
    orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { players: true } } },
    take: 200,
  });

  return rooms.map((r) => ({
    id: r.id,
    kind: r.kind,
    currency: r.currency,
    game: r.game,
    stakeAmount: fromNano(r.stakeAmountNano),
    maxPlayers: r.maxPlayers,
    status: r.status,
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    playersCount: r._count.players,
  }));
}

export async function createUserRoom(params: {
  userId: string;
  currency: Currency;
  game: GameKind;
  stakeAmount: string;
  maxPlayers: number;
  startMode: 'TIMER' | 'FILL';
  startDelaySeconds?: number;
}) {
  const stakeNano = toNano(params.currency, params.stakeAmount);
  const serverSeed = makeServerSeed();

  const now = new Date();
  const startsAt = params.startMode === 'TIMER'
    ? new Date(now.getTime() + (params.startDelaySeconds ?? 30) * 1000)
    : null;

  const cancelAt = new Date(now.getTime() + 10 * 60 * 1000); // auto-cancel after 10 minutes if empty/not started

  const room = await prisma.room.create({
    data: {
      kind: 'USER',
      currency: params.currency,
      game: params.game,
      stakeAmountNano: stakeNano,
      maxPlayers: params.maxPlayers,
      startMode: params.startMode,
      startsAt,
      cancelAt,
      serverSeedHash: commitHash(serverSeed),
      serverSeed,
      nonce: 0,
      status: 'OPEN',
    },
  });

  // schedule cancel check
  await roomQueue.add('cancel_if_empty', { roomId: room.id }, { delay: cancelAt.getTime() - now.getTime(), removeOnComplete: true, removeOnFail: true });
  if (startsAt) {
    await roomQueue.add('settle_room', { roomId: room.id }, { delay: startsAt.getTime() - now.getTime() + 2000, removeOnComplete: true, removeOnFail: true });
  }
  return room.id;
}

export async function joinRoom(params: { roomId: string; userId: string; clientSeed: string }) {
  return withLock(`join:${params.roomId}`, 5000, async () => {
    const room = await prisma.room.findUnique({ where: { id: params.roomId }, include: { players: true } });
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (!['OPEN', 'LOCKED'].includes(room.status)) throw new Error('ROOM_NOT_JOINABLE');
    if (room.players.length >= room.maxPlayers) throw new Error('ROOM_FULL');

    const already = room.players.find((p) => p.userId === params.userId);
    if (already) return;

    // Ledger-only: lock bet amount (BET_LOCK) requires enough balance
    const balance = await accountBalanceNano(params.userId, room.currency);
    if (balance < room.stakeAmountNano) throw new Error('INSUFFICIENT_FUNDS');

    const lockEntry = await addEntry({
      userId: params.userId,
      currency: room.currency,
      type: 'BET_LOCK',
      amountNano: -room.stakeAmountNano,
      refType: 'ROOM',
      refId: room.id,
    });

    await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: params.userId,
        clientSeed: params.clientSeed,
        betLockedEntryId: lockEntry.id,
      },
    });

    // update room status
    const playersCount = room.players.length + 1;
    const nextStatus: RoomStatus = playersCount >= room.maxPlayers ? 'LOCKED' : 'OPEN';
    await prisma.room.update({ where: { id: room.id }, data: { status: nextStatus } });

    // If startMode fill and full => settle
    if (room.startMode === 'FILL' && playersCount >= room.maxPlayers) {
      await roomQueue.add('settle_room', { roomId: room.id }, { delay: 1500, removeOnComplete: true, removeOnFail: true });
    }
  });
}

export async function cancelRoomIfEmpty(roomId: string) {
  return withLock(`cancel:${roomId}`, 5000, async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: true } });
    if (!room) return;
    if (room.status !== 'OPEN') return;
    if (room.players.length > 0) return;

    await prisma.room.update({ where: { id: roomId }, data: { status: 'CANCELLED' } });
  });
}

export async function refundRoom(roomId: string) {
  return withLock(`refund:${roomId}`, 8000, async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: true } });
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (!['CANCELLED', 'OPEN', 'LOCKED'].includes(room.status)) throw new Error('ROOM_NOT_REFUNDABLE');

    for (const p of room.players) {
      // Refund: BET_UNLOCK (reverse lock)
      await addEntry({
        userId: p.userId,
        currency: room.currency,
        type: 'REFUND',
        amountNano: room.stakeAmountNano,
        refType: 'ROOM_REFUND',
        refId: room.id,
      });
    }

    await prisma.room.update({ where: { id: room.id }, data: { status: 'REFUNDED' } });
    // For system rooms, recreate a fresh one
    if (room.kind === 'SYSTEM') {
      const serverSeed = makeServerSeed();
      await prisma.room.create({
        data: {
          kind: 'SYSTEM',
          currency: room.currency,
          game: room.game,
          stakeAmountNano: room.stakeAmountNano,
          maxPlayers: room.maxPlayers,
          startMode: 'FILL',
          serverSeedHash: commitHash(serverSeed),
          serverSeed,
          nonce: 0,
          status: 'OPEN',
        },
      });
    }
  });
}

export async function settleRoom(roomId: string) {
  return withLock(`settle:${roomId}`, 10000, async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { players: true, settlements: true } });
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.settlements.length > 0) return; // idempotent
    if (!['OPEN','LOCKED'].includes(room.status)) return;
    if (room.players.length < 2) {
      // if not enough players by timer -> cancel + refund
      await prisma.room.update({ where: { id: room.id }, data: { status: 'CANCELLED' } });
      await refundRoom(room.id);
      return;
    }

    await prisma.room.update({ where: { id: room.id }, data: { status: 'RUNNING' } });

    const clientSeed = room.players.map((p) => p.clientSeed).join('|');
    const nonce = room.nonce + 1;
    const serverSeed = room.serverSeed!;
    let outcome: any = null;

    if (room.game === 'ROULETTE') outcome = rouletteOutcome(serverSeed, clientSeed, nonce, room.id);
    if (room.game === 'COINFLIP') outcome = coinflipOutcome(serverSeed, clientSeed, nonce, room.id);
    if (room.game === 'CRASH') outcome = crashOutcome(serverSeed, clientSeed, nonce, room.id);
    if (room.game === 'JACKPOT') {
      outcome = jackpotOutcome(serverSeed, clientSeed, nonce, room.id, room.players.map((p) => ({ userId: p.userId, weight: room.stakeAmountNano })));
    }

    // Payout logic (simple):
    // - COINFLIP: first player is HEADS, second is TAILS winner. Winner gets 2*stake (net +stake because already locked -stake).
    // - ROULETTE: everyone bets equal, winner is closest? We'll do: everyone is "on color" by their index (even=RED odd=BLACK), green => house wins -> refund half to all.
    // - JACKPOT: deterministic winner takes pot.
    // - CRASH: simplistic auto-cashout at 2.0x for all; if crash <2x => all lose; else everyone wins 2x (house subsidizes) (kept simple).
    const stake = room.stakeAmountNano;
    const pot = stake * BigInt(room.players.length);

    const payouts: Array<{ userId: string; amountNano: bigint }> = [];
    if (room.game === 'COINFLIP') {
      const winner = outcome.side === 'HEADS' ? room.players[0] : room.players[1];
      payouts.push({ userId: winner.userId, amountNano: pot });
    } else if (room.game === 'JACKPOT') {
      payouts.push({ userId: outcome.winnerUserId, amountNano: pot });
    } else if (room.game === 'ROULETTE') {
      if (outcome.color === 'GREEN') {
        // refund half
        const half = stake / BigInt(2);
        for (const p of room.players) payouts.push({ userId: p.userId, amountNano: half });
      } else {
        // winners: even index -> RED, odd index -> BLACK
        const winners = room.players.filter((_, idx) => (idx % 2 === 0 ? 'RED' : 'BLACK') === outcome.color);
        const share = winners.length ? pot / BigInt(winners.length) : BigInt(0);
        for (const w of winners) payouts.push({ userId: w.userId, amountNano: share });
      }
    } else if (room.game === 'CRASH') {
      const crash = outcome.multiplierBps;
      const target = 20000; // 2x
      if (crash >= target) {
        // everybody gets 2x stake
        for (const p of room.players) payouts.push({ userId: p.userId, amountNano: stake * BigInt(2) });
      } else {
        // nobody gets payout
      }
    }

    // Write settlement and ledger
    await prisma.settlement.create({
      data: {
        roomId: room.id,
        outcomeJson: outcome,
        revealClientSeed: clientSeed,
        revealServerSeed: serverSeed,
        revealNonce: nonce,
      },
    });

    // Unlock locked bet (BET_UNLOCK) by compensating? We already deducted stake on BET_LOCK.
    // Now payouts should be credited as PAYOUT amounts.
    for (const p of room.players) {
      // record bet was consumed (no unlock), but for accounting we can mark BET_UNLOCK 0.
      // We'll keep it simple: no extra entry.
      void p;
    }

    for (const pay of payouts) {
      await addEntry({
        userId: pay.userId,
        currency: room.currency,
        type: 'PAYOUT',
        amountNano: pay.amountNano,
        refType: 'ROOM_PAYOUT',
        refId: room.id,
      });
    }

    await prisma.room.update({ where: { id: room.id }, data: { status: 'SETTLED', nonce } });

    // For system rooms: recreate a fresh one to keep lobby alive
    if (room.kind === 'SYSTEM') {
      const serverSeed2 = makeServerSeed();
      await prisma.room.create({
        data: {
          kind: 'SYSTEM',
          currency: room.currency,
          game: room.game,
          stakeAmountNano: room.stakeAmountNano,
          maxPlayers: room.maxPlayers,
          startMode: 'FILL',
          serverSeedHash: commitHash(serverSeed2),
          serverSeed: serverSeed2,
          nonce: 0,
          status: 'OPEN',
        },
      });
    }
  });
}

export async function roomDetails(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: { include: { user: true } }, settlements: true },
  });
  if (!room) throw new Error('ROOM_NOT_FOUND');
  const settled = room.settlements[0] ?? null;

  return {
    id: room.id,
    kind: room.kind,
    currency: room.currency,
    game: room.game,
    stakeAmount: fromNano(room.stakeAmountNano),
    maxPlayers: room.maxPlayers,
    status: room.status,
    startsAt: room.startsAt ? room.startsAt.toISOString() : null,
    createdAt: room.createdAt.toISOString(),
    playersCount: room.players.length,
    players: room.players.map((p) => ({
      userId: p.userId,
      displayName: p.user.firstName || p.user.username || String(p.user.tgUserId),
      avatarUrl: p.user.photoUrl,
      joinedAt: p.joinedAt.toISOString(),
    })),
    provablyFair: { serverSeedHash: room.serverSeedHash, nonce: room.nonce },
    settled: settled
      ? {
          outcome: settled.outcomeJson,
          reveal: { serverSeed: settled.revealServerSeed, clientSeed: settled.revealClientSeed, nonce: settled.revealNonce },
          settledAt: settled.settledAt.toISOString(),
          txProof: settled.txProof,
        }
      : null,
  };
}

export async function history(userId: string) {
  const items = await prisma.settlement.findMany({
    where: { room: { players: { some: { userId } } } },
    include: { room: true },
    orderBy: { settledAt: 'desc' },
    take: 100,
  });

  return items.map((s) => ({
    id: s.id,
    roomId: s.roomId,
    game: s.room.game,
    currency: s.room.currency,
    stakeAmount: fromNano(s.room.stakeAmountNano),
    startedAt: s.room.createdAt.toISOString(),
    settledAt: s.settledAt.toISOString(),
    outcome: s.outcomeJson,
    provablyFair: {
      serverSeedHash: s.room.serverSeedHash,
      clientSeed: s.revealClientSeed,
      serverSeed: s.revealServerSeed,
      nonce: s.revealNonce,
    },
  }));
}
