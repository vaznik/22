import { prisma } from '../prisma';
import { addEntry, accountBalanceNano } from './ledger';
import { env } from '../env';

export async function stakingState(userId: string) {
  const stakes = await prisma.stake.findMany({ where: { userId }, orderBy: { lockedAt: 'desc' }, take: 50 });
  return stakes.map((s) => ({
    id: s.id,
    amountNano: s.amountNano.toString(),
    lockedAt: s.lockedAt.toISOString(),
    unlockAt: s.unlockAt.toISOString(),
    status: s.status,
    lastRewardAt: s.lastRewardAt.toISOString(),
  }));
}

export async function lockStake(userId: string, amountNano: bigint, lockSeconds: number) {
  const bal = await accountBalanceNano(userId, 'TON');
  if (bal < amountNano) throw new Error('INSUFFICIENT_FUNDS');

  // Ledger: STAKE_LOCK is negative
  await addEntry({ userId, currency: 'TON', type: 'STAKE_LOCK', amountNano: -amountNano, refType: 'STAKE', refId: 'lock' });

  const now = new Date();
  const unlockAt = new Date(now.getTime() + Math.max(lockSeconds, env.stakingMinLockSeconds) * 1000);

  const stake = await prisma.stake.create({
    data: { userId, amountNano, unlockAt, status: 'LOCKED', lastRewardAt: now },
  });

  return stake.id;
}

export async function unlockStake(userId: string, stakeId: string) {
  const stake = await prisma.stake.findFirst({ where: { id: stakeId, userId } });
  if (!stake) throw new Error('STAKE_NOT_FOUND');
  if (stake.status !== 'LOCKED') throw new Error('STAKE_NOT_LOCKED');
  if (new Date() < stake.unlockAt) throw new Error('STAKE_NOT_UNLOCKABLE');

  // accrue rewards up to now
  await accrueRewards(userId, stakeId);

  await prisma.stake.update({ where: { id: stakeId }, data: { status: 'UNLOCKED' } });

  // Ledger: STAKE_UNLOCK is positive
  await addEntry({ userId, currency: 'TON', type: 'STAKE_UNLOCK', amountNano: stake.amountNano, refType: 'STAKE', refId: stakeId });
}

export async function accrueRewards(userId: string, stakeId?: string) {
  const now = new Date();
  const where: any = { userId, status: 'LOCKED' };
  if (stakeId) where.id = stakeId;
  const stakes = await prisma.stake.findMany({ where });

  for (const s of stakes) {
    const last = s.lastRewardAt;
    const dt = (now.getTime() - last.getTime()) / 1000;
    if (dt <= 0) continue;
    // APR bps: reward = amount * apr * dt / year
    const year = 365 * 24 * 3600;
    const reward = (s.amountNano * BigInt(env.stakingAprBps) * BigInt(Math.floor(dt))) / BigInt(10000 * year);
    if (reward > 0) {
      await addEntry({ userId, currency: 'TON', type: 'STAKE_REWARD', amountNano: reward, refType: 'STAKE_REWARD', refId: s.id });
    }
    await prisma.stake.update({ where: { id: s.id }, data: { lastRewardAt: now } });
  }
}
