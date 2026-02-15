import { verifyInitData } from '@tgcasino/shared';
import { env } from '../env';
import { prisma } from '../prisma';
import { linkDevice, referralAllowedForDevice } from './antiMulti';

export type TgAuthContext = {
  userId: string;
  tgUserId: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  startParam?: string | null;
  deviceId?: string | null; // hashed (server-side)
};

async function maybeCreateReferral(params: {
  startParam: string;
  inviteeUserId: string;
  inviteeTgUserId: bigint;
  deviceId?: string | null;
}) {
  const sp = params.startParam.trim();
  if (!sp) return;

  // Supported formats:
  // - ref_123456789
  // - ref:123456789
  // - ref123456789
  const m = sp.match(/^ref(?:_|:)?(\d{5,})$/i);
  if (!m) return;

  const inviterTg = BigInt(m[1]);
  if (inviterTg === params.inviteeTgUserId) return;

  const inviter = await prisma.user.findUnique({ where: { tgUserId: inviterTg } });
  if (!inviter) return;

  // Only one referral per invitee
  const already = await prisma.referral.findUnique({ where: { inviteeId: params.inviteeUserId } });
  if (already) return;

  if (params.deviceId) {
    const allowed = await referralAllowedForDevice(params.deviceId);
    if (!allowed) return;
  }

  try {
    await prisma.referral.create({ data: { inviterId: inviter.id, inviteeId: params.inviteeUserId } });
  } catch {
    // ignore unique races
  }
}

export async function authFromInitData(initData: string, rawDeviceId?: string): Promise<TgAuthContext> {
  const res = verifyInitData(initData, env.telegramBotTokenForInitData);
  if (!res.ok) throw new Error('INITDATA_INVALID:' + res.reason);

  const userJson = res.data['user'];
  if (!userJson) throw new Error('INITDATA_NO_USER');
  const u = JSON.parse(userJson);
  const tgUserId = BigInt(u.id);

  const startParam = (res.data['start_param'] ?? '') as string;

  const user = await prisma.user.upsert({
    where: { tgUserId },
    create: {
      tgUserId,
      username: u.username ?? null,
      firstName: u.first_name ?? null,
      lastName: u.last_name ?? null,
      photoUrl: u.photo_url ?? null,
      language: u.language_code ?? 'en',
    },
    update: {
      username: u.username ?? null,
      firstName: u.first_name ?? null,
      lastName: u.last_name ?? null,
      photoUrl: u.photo_url ?? null,
    },
  });

  const deviceId = rawDeviceId ? await linkDevice(user.id, rawDeviceId) : null;

  await maybeCreateReferral({ startParam, inviteeUserId: user.id, inviteeTgUserId: tgUserId, deviceId });

  return {
    userId: user.id,
    tgUserId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    startParam: startParam || null,
    deviceId,
  };
}
