import crypto from 'crypto';
import { CoinflipOutcome, CrashOutcome, JackpotOutcome, RouletteOutcome } from './types';

export function sha256Hex(data: string) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

export function randomBytesHex(n: number) {
  return crypto.randomBytes(n).toString('hex');
}

export function makeServerSeed() {
  return randomBytesHex(32);
}

export function commitHash(serverSeed: string) {
  return sha256Hex(serverSeed);
}

export function hmacSha256Hex(key: string, msg: string) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
}

function hexToBigInt(hex: string) {
  return BigInt('0x' + hex);
}

function toUnitFloatFromHex(hex: string) {
  const x = hexToBigInt(hex);
  // map to [0,1)
  const max = (BigInt(1) << BigInt(256));
  return Number(x % max) / Number(max);
}

/**
 * Commit-reveal:
 * - server commits serverSeedHash
 * - player provides clientSeed at join
 * - reveal uses HMAC(serverSeed, clientSeed:nonce:roomId)
 */
export function rouletteOutcome(serverSeed: string, clientSeed: string, nonce: number, roomId: string): RouletteOutcome {
  const digest = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${roomId}`);
  // Use first 8 hex chars -> 32 bits
  const n = parseInt(digest.slice(0, 8), 16);
  const number = n % 37;
  const color: RouletteOutcome['color'] =
    number === 0 ? 'GREEN' : [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number) ? 'RED' : 'BLACK';
  return { number, color };
}

export function coinflipOutcome(serverSeed: string, clientSeed: string, nonce: number, roomId: string): CoinflipOutcome {
  const digest = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${roomId}`);
  const n = parseInt(digest.slice(0, 2), 16);
  return { side: (n % 2 === 0) ? 'HEADS' : 'TAILS' };
}

/**
 * Jackpot: winner picked by weighted stakes.
 * deterministic: use digest to pick a float and walk weights.
 */
export function jackpotOutcome(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  roomId: string,
  players: Array<{ userId: string; weight: bigint }>,
): JackpotOutcome {
  const digest = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${roomId}`);
  const r = toUnitFloatFromHex(digest);
  const total = players.reduce((a, p) => a + p.weight, BigInt(0));
  let acc = BigInt(0);
  const target = BigInt(Math.floor(r * Number(total)));
  for (const p of players) {
    acc += p.weight;
    if (target < acc) return { winnerUserId: p.userId };
  }
  return { winnerUserId: players[players.length - 1]?.userId ?? '' };
}

/**
 * Crash: classic provably fair crash curve.
 * multiplier = floor( (100 * 1e4) / (1 - r) )? We'll use bps (1x=10000).
 * House edge via clamp.
 */
export function crashOutcome(serverSeed: string, clientSeed: string, nonce: number, roomId: string): CrashOutcome {
  const digest = hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${roomId}`);
  // Use 52 bits from digest (first 13 hex chars)
  const h = parseInt(digest.slice(0, 13), 16);
  const r = h / Math.pow(2, 52); // [0,1)
  // House edge 1%
  const edge = 0.01;
  const m = (1 - edge) / (1 - r);
  const multiplierBps = Math.max(10000, Math.floor(m * 10000));
  return { multiplierBps };
}
