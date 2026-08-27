/**
 * AI credits for the WhatsApp agent.
 *
 * Deliberately a near-copy of SheetCreditAccount / SheetCreditTransaction and
 * services/leadCredits.service.ts, because a seller who has already bought
 * Google Sheets credits should not have to learn a second billing idea: an
 * admin grants a balance in cents, every agent reply debits the tariff, and the
 * ledger keeps a running `balanceAfter` so panels read closing balances off the
 * column instead of replaying history.
 *
 * WHERE IT DIFFERS FROM SHEET CREDITS, and why:
 *
 *   Sheet credits are a RESERVATION model — a captured lead reserves a credit
 *   and the balance only drops when the row is actually appended, so a lead you
 *   can see is a lead you can definitely send. Nothing here needs that. An
 *   agent reply is produced and spent in the same instant; there is no gap
 *   between "captured" and "delivered" to protect. So this is a plain debit,
 *   and the only thing that has to be watertight is that one turn is charged
 *   exactly once — enforced by Postgres through the unique
 *   WaCreditTransaction.turnId, the same device as SheetCreditTransaction.leadId.
 *
 *   There is also no equivalent of lead masking. Running out of sheet credits
 *   hides a phone number you already own; running out of AI credits just means
 *   the agent stops replying, which the account sees in the inbox.
 */

import { prisma } from '../lib/prisma.js';
import { replyPriceCents, centsToReplies } from '../lib/waPricing.js';
import { waLog } from './waLogs.service.js';

/** The account fields every entitlement decision needs. */
export interface WaGateConfig {
  whatsappAgentEnabled: boolean;
  whatsappAgentGateFrom: Date | null;
}

export const WA_GATE_SELECT = {
  whatsappAgentEnabled: true,
  whatsappAgentGateFrom: true,
} as const;

/**
 * True when the admin has actually sold this account the feature.
 *
 * Both halves are required, exactly as in isGateActive(): the boolean alone can
 * be true on a row whose gateFrom was never stamped, and billing from an
 * unknown instant is worse than not billing at all.
 */
export function isWaAgentActive(config: WaGateConfig | null | undefined): boolean {
  return !!config?.whatsappAgentEnabled && !!config?.whatsappAgentGateFrom;
}

export interface WaCreditStats {
  /** Whether the admin has enabled the feature for this account. */
  enabled: boolean;
  /** Money held, in CENTS. */
  balance: number;
  /** How many agent replies that money could still pay for. */
  affordable: number;
  totalGranted: number;
  totalConsumed: number;
  /** Cents charged per reply, so the client never hardcodes the tariff. */
  priceCents: number;
}

const ZERO = (priceCents: number): WaCreditStats => ({
  enabled: false,
  balance: 0,
  affordable: 0,
  totalGranted: 0,
  totalConsumed: 0,
  priceCents,
});

/**
 * Never throws, never 404s.
 *
 * Held to the same contract as getGateStats(): this feeds a header chip and a
 * status endpoint that every role hits, and an account that has never been
 * granted a credit is not an error condition. A caller with no row gets zeros.
 */
export async function getWaCreditStats(userId: number): Promise<WaCreditStats> {
  const price = replyPriceCents();
  try {
    const [user, account] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: WA_GATE_SELECT }),
      prisma.waCreditAccount.findUnique({
        where: { userId },
        select: { balance: true, totalGranted: true, totalConsumed: true },
      }),
    ]);

    return {
      enabled: isWaAgentActive(user),
      balance: account?.balance ?? 0,
      affordable: centsToReplies(account?.balance ?? 0),
      totalGranted: account?.totalGranted ?? 0,
      totalConsumed: account?.totalConsumed ?? 0,
      priceCents: price,
    };
  } catch (err) {
    console.error('[waCredits] getWaCreditStats failed:', err);
    return ZERO(price);
  }
}

/** Cheap pre-flight for the worker: can this account afford one more reply? */
export async function canAffordReply(userId: number): Promise<boolean> {
  const account = await prisma.waCreditAccount.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return (account?.balance ?? 0) >= replyPriceCents();
}

export type ChargeResult =
  | { ok: true; charged: number; balanceAfter: number; alreadyCharged: boolean }
  | { ok: false; reason: 'NO_ACCOUNT' | 'INSUFFICIENT' };

/**
 * Debits one reply against a turn.
 *
 * The unique index on turnId is what makes this safe to call from a retry: a
 * turn that failed to SEND and is drained again must not be billed twice. The
 * insert is attempted inside the transaction and a unique violation is read as
 * "already paid for", not as an error.
 *
 * `amountCents` is resolved at call time rather than passed in, so a tariff
 * change cannot be replayed at an old price by a stale caller.
 */
export async function chargeTurn(
  userId: number,
  turnId: number,
  description = 'Réponse de l’agent WhatsApp'
): Promise<ChargeResult> {
  const price = replyPriceCents();

  // Charging is skipped entirely when the turn already carries a charge. Read
  // first so the common path never opens a transaction it will roll back.
  const existing = await prisma.waCreditTransaction.findUnique({
    where: { turnId },
    select: { amount: true, balanceAfter: true },
  });
  if (existing) {
    return {
      ok: true,
      charged: Math.abs(existing.amount),
      balanceAfter: existing.balanceAfter,
      alreadyCharged: true,
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.waCreditAccount.findUnique({
        where: { userId },
        select: { id: true, balance: true },
      });
      if (!account) {
        waLog({
          userId,
          turnId,
          level: 'WARN',
          category: 'CREDITS',
          event: 'credits.no_account',
          message: "Aucun compte de crédits IA : l'agent ne peut pas répondre tant qu'il n'a pas été crédité.",
          meta: { priceCents: price },
        });
        return { ok: false as const, reason: 'NO_ACCOUNT' as const };
      }
      if (account.balance < price) {
        // The row a seller's "l'agent ne répond plus" ticket resolves on.
        waLog({
          userId,
          turnId,
          level: 'WARN',
          category: 'CREDITS',
          event: 'credits.insufficient',
          message: `Solde insuffisant (${(account.balance / 100).toFixed(2)} pour ${(price / 100).toFixed(
            2
          )} requis) : la réponse est bloquée.`,
          meta: { priceCents: price, balanceCents: account.balance },
        });
        return { ok: false as const, reason: 'INSUFFICIENT' as const };
      }

      const balanceAfter = account.balance - price;

      await tx.waCreditAccount.update({
        where: { id: account.id },
        data: { balance: balanceAfter, totalConsumed: { increment: price } },
      });

      await tx.waCreditTransaction.create({
        data: {
          accountId: account.id,
          type: 'CONSUME',
          amount: -price,
          balanceAfter,
          description,
          turnId,
        },
      });

      waLog({
        userId,
        turnId,
        level: 'DEBUG',
        category: 'CREDITS',
        event: 'credits.charged',
        message: `Réponse facturée : ${(price / 100).toFixed(2)} — nouveau solde ${(balanceAfter / 100).toFixed(2)}.`,
        meta: { priceCents: price, balanceAfterCents: balanceAfter, description },
        costCents: price,
      });

      return { ok: true as const, charged: price, balanceAfter, alreadyCharged: false };
    });
  } catch (err: any) {
    // P2002 on turnId: a concurrent drain won the race and paid for this turn.
    // That is the guard doing its job, so report the charge as done rather than
    // failing a reply the customer is already waiting for.
    if (err?.code === 'P2002') {
      const row = await prisma.waCreditTransaction.findUnique({
        where: { turnId },
        select: { amount: true, balanceAfter: true },
      });
      if (row) {
        return {
          ok: true,
          charged: Math.abs(row.amount),
          balanceAfter: row.balanceAfter,
          alreadyCharged: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Admin grant. Creates the account row on first use — that is the only thing
 * that creates it, deliberately: loading a page must not.
 */
export async function grantCredits(
  userId: number,
  amountCents: number,
  description: string | null,
  actorId?: number
): Promise<{ balance: number }> {
  const amount = Math.trunc(Number(amountCents) || 0);
  if (amount <= 0) throw new Error('Le montant doit être supérieur à zéro.');

  return prisma.$transaction(async (tx) => {
    const account = await tx.waCreditAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true, balance: true },
    });

    const balanceAfter = account.balance + amount;

    await tx.waCreditAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter, totalGranted: { increment: amount } },
    });

    await tx.waCreditTransaction.create({
      data: {
        accountId: account.id,
        type: 'GRANT',
        amount,
        balanceAfter,
        description,
        createdBy: actorId ?? null,
      },
    });

    return { balance: balanceAfter };
  });
}

/**
 * Admin correction. Takes credits back — for a mistaken grant, or a refund
 * being reversed. Floors at zero rather than going negative: a negative balance
 * has no meaning here and would make `affordable` lie.
 */
export async function debitCredits(
  userId: number,
  amountCents: number,
  description: string | null,
  actorId?: number
): Promise<{ balance: number }> {
  const amount = Math.trunc(Number(amountCents) || 0);
  if (amount <= 0) throw new Error('Le montant doit être supérieur à zéro.');

  return prisma.$transaction(async (tx) => {
    const account = await tx.waCreditAccount.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    });
    if (!account) throw new Error('Ce compte n’a pas de solde de crédits IA.');

    const taken = Math.min(amount, account.balance);
    const balanceAfter = account.balance - taken;

    await tx.waCreditAccount.update({
      where: { id: account.id },
      data: { balance: balanceAfter },
    });

    await tx.waCreditTransaction.create({
      data: {
        accountId: account.id,
        type: 'ADMIN_DEBIT',
        amount: -taken,
        balanceAfter,
        description,
        createdBy: actorId ?? null,
      },
    });

    return { balance: balanceAfter };
  });
}
