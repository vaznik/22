export type Currency = 'XTR' | 'TON';

export type GameKind = 'ROULETTE' | 'COINFLIP' | 'JACKPOT' | 'CRASH';

export type RoomKind = 'SYSTEM' | 'USER';

export type RoomStatus = 'OPEN' | 'LOCKED' | 'RUNNING' | 'SETTLED' | 'CANCELLED' | 'REFUNDED';

export type PaymentProvider = 'STARS' | 'TON';

export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'BET_LOCK'
  | 'BET_UNLOCK'
  | 'PAYOUT'
  | 'REFUND'
  | 'STAKE_LOCK'
  | 'STAKE_UNLOCK'
  | 'STAKE_REWARD';

export type ProvablyFairCommit = {
  serverSeedHash: string;
  nonce: number;
};

export type ProvablyFairReveal = {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
};

export type RouletteOutcome = {
  number: number; // 0..36
  color: 'RED' | 'BLACK' | 'GREEN';
};

export type CoinflipOutcome = { side: 'HEADS' | 'TAILS' };

export type JackpotOutcome = { winnerUserId: string };

export type CrashOutcome = { multiplierBps: number }; // e.g. 24500 => 2.45x

export type RoomPublic = {
  id: string;
  kind: RoomKind;
  currency: Currency;
  game: GameKind;
  stakeAmount: string;
  maxPlayers: number;
  status: RoomStatus;
  startsAt: string | null;
  createdAt: string;
  playersCount: number;
};

export type RoomDetails = RoomPublic & {
  players: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    joinedAt: string;
  }>;
  provablyFair: ProvablyFairCommit;
  settled?: {
    outcome: any;
    reveal?: ProvablyFairReveal;
    settledAt: string;
    txProof?: string | null;
  } | null;
};

export type HistoryItem = {
  id: string;
  roomId: string;
  game: GameKind;
  currency: Currency;
  stakeAmount: string;
  startedAt: string;
  settledAt: string;
  outcome: any;
  provablyFair: { serverSeedHash: string; clientSeed: string; serverSeed: string; nonce: number };
};
