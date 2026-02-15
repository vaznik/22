import { redis } from '../redis';
import { env } from '../env';

export async function idempotencyGuard(key: string): Promise<boolean> {
  // Returns true if first time seen.
  const ok = await redis.set(key, val, { NX: true, PX: ttlMs });
  return Boolean(ok);
}
