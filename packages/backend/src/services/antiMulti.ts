import crypto from 'crypto';
import { env } from '../env';
import { prisma } from '../prisma';

export function deviceFingerprint(rawDeviceId: string) {
  // Soft fingerprint hash (we never store the raw device id).
  return crypto.createHash('sha256').update(env.deviceFingerprintSalt + ':' + rawDeviceId).digest('hex');
}

export async function linkDevice(userId: string, rawDeviceId: string) {
  const deviceId = deviceFingerprint(rawDeviceId);
  await prisma.deviceLink.upsert({
    where: { deviceId_userId: { deviceId, userId } },
    create: { deviceId, userId },
    update: { lastSeenAt: new Date() },
  });
  return deviceId;
}

export async function referralAllowedForDevice(deviceId: string) {
  // 1) max referrals per device per day
  const sinceDay = new Date(Date.now() - 24 * 3600 * 1000);
  const count = await prisma.referral.count({
    where: {
      createdAt: { gte: sinceDay },
      invitee: { deviceLinks: { some: { deviceId } } },
    },
  });
  if (count >= env.maxReferralsPerDevicePerDay) return false;

  // 2) cooldown (per device)
  const sinceCooldown = new Date(Date.now() - env.referralCooldownSeconds * 1000);
  const last = await prisma.referral.findFirst({
    where: { createdAt: { gte: sinceCooldown }, invitee: { deviceLinks: { some: { deviceId } } } },
    orderBy: { createdAt: 'desc' },
  });
  if (last) return false;

  return true;
}
