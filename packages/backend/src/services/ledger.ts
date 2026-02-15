import { prisma } from "../prisma";
import { Currency, LedgerEntryType } from "@prisma/client";

export function toNano(currency: Currency, amount: string): bigint {
  // XTR and TON both treated as 1e9 nano units here for ledger uniformity.
  // Stars are integer in Stars UI, but we store nano for consistency.
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "000000000").slice(0, 9);
  return BigInt(whole || "0") * BigInt(1_000_000_000) + BigInt(fracPadded);
}

export function fromNano(amountNano: bigint): string {
  const sign = amountNano < 0n ? "-" : "";
  const x = amountNano < 0n ? -amountNano : amountNano;
  const whole = x / 1_000_000_000n;
  const frac = (x % 1_000_000_000n)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  return sign + whole.toString() + (frac ? "." + frac : "");
}

export async function ensureAccount(userId: string, currency: Currency) {
  return prisma.account.upsert({
    where: { userId_currency: { userId, currency } },
    create: { userId, currency },
    update: {},
  });
}

export async function addEntry(params: {
  userId: string;
  currency: Currency;
  type: LedgerEntryType;
  amountNano: bigint;
  refType: string;
  refId: string;
}) {
  const account = await ensureAccount(params.userId, params.currency);

  // ✅ IMPORTANT: LedgerEntry now requires userId (opposite relation to User.ledgerEntries)
  return prisma.ledgerEntry.create({
    data: {
      userId: account.userId, // same as params.userId, but guaranteed consistent with account
      accountId: account.id,
      type: params.type,
      amountNano: params.amountNano,
      refType: params.refType,
      refId: params.refId,
    },
  });
}

export async function accountBalanceNano(userId: string, currency: Currency): Promise<bigint> {
  const account = await prisma.account.findUnique({
    where: { userId_currency: { userId, currency } },
  });
  if (!account) return 0n;

  const agg = await prisma.ledgerEntry.aggregate({
    where: { accountId: account.id },
    _sum: { amountNano: true },
  });

  return (agg._sum.amountNano ?? 0n) as unknown as bigint;
}
