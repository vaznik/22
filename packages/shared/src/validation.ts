import { z } from 'zod';
import { Currency, GameKind } from './types';

export const CurrencySchema = z.enum(['XTR', 'TON']) satisfies z.ZodType<Currency>;
export const GameKindSchema = z.enum(['ROULETTE', 'COINFLIP', 'JACKPOT', 'CRASH']) satisfies z.ZodType<GameKind>;

export const CreateRoomSchema = z.object({
  currency: CurrencySchema,
  game: GameKindSchema,
  stakeAmount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  maxPlayers: z.number().int().min(2).max(50),
  startMode: z.enum(['TIMER', 'FILL']),
  startDelaySeconds: z.number().int().min(10).max(3600).optional(),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().uuid(),
  clientSeed: z.string().min(6).max(64),
  deviceId: z.string().min(8).max(128),
});

export const CreateDepositIntentSchema = z.object({
  currency: CurrencySchema,
  amount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  provider: z.enum(['STARS', 'TON']),
});

export const TonTxVerifySchema = z.object({
  boc: z.string().min(10),
  roomId: z.string().uuid().optional(),
  intentId: z.string().uuid().optional(),
});

export const SetSettingsSchema = z.object({
  language: z.enum(['en', 'ru']).optional(),
  notifications: z.boolean().optional(),
});
