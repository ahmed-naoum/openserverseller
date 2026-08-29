/**
 * Outbound Google Sheets pipeline: enqueue on the request thread, drain on a cron,
 * charge one credit per row Google confirmed.
 *
 * WHY AN OUTBOX AND NOT A DIRECT CALL. A lead arriving from a landing page is the
 * one request in this system that must never fail or hang — a customer is waiting
 * on the form. Enqueueing costs one indexed SELECT plus one INSERT and touches no
 * network, so Google being slow, rate-limiting us, or being down cannot affect lead
 * capture at all. (BullMQ is a dependency here but is dead code: nothing imports
 * `jobs/queue.ts`, no worker exists, and pm2 runs a single instance. A DB-backed
 * outbox drained by setInterval is this codebase's real async pattern — see
 * jobs/leadReassignment, sessionCleanup, logRetention — and it survives a restart.)
 *
 * WHY APPEND FIRST AND CHARGE SECOND. A credit is spent only against a row Google
 * has confirmed. The inverse ordering needs a compensating refund path and loses a
 * credit outright if the process dies between the debit and the HTTP call.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/realtime.js';
import { createNotification } from '../utils/notification.js';
import { getLockedLeadIds } from './leadCredits.service.js';
import { LEAD_PRICE_CENTS, centsToLeads } from '../lib/sheetPricing.js';
import { claimPlanQuota, getActiveSubscriptionRow, getPlanRemaining } from './sheetPlans.service.js';
import {
  appendRows,
  applyHeaderTemplate,
  buildLeadRow,
  headerSignature,
  isWriterConfigured,
  readSheetLeadIds,
  DEFAULT_TAB,
  outboundLabels,
  parseOutboundSelection,
  resolveOutboundColumns,
  type SheetWriteResult,
} from './googleSheetsWriter.js';

// ─── Tunables ────────────────────────────────────────────────────────────────

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Rows per Google call. One append carries many rows, so this is also the batch. */
const BATCH_SIZE = num('SHEET_PUSH_BATCH_SIZE', 50);
/** Vendors handled per drain tick. */
const VENDORS_PER_TICK = num('SHEET_PUSH_VENDORS_PER_TICK', 10);
const MAX_ATTEMPTS = num('SHEET_PUSH_MAX_ATTEMPTS', 6);
const BASE_BACKOFF_MS = num('SHEET_PUSH_BASE_BACKOFF_MS', 3000);
const MAX_BACKOFF_MS = num('SHEET_PUSH_MAX_BACKOFF_MS', 30 * 60 * 1000);
/** Pause between Google calls — Sheets caps writes per user per minute. */
const MIN_GAP_MS = num('SHEET_PUSH_MIN_GAP_MS', 150);
/** A claim older than this belonged to a process that died mid-append. */
const STALE_CLAIM_MS = num('SHEET_PUSH_STALE_CLAIM_MS', 5 * 60 * 1000);
/**
 * How often the stale-claim sweep actually runs.
 *
 * It used to run on every tick, which was fine at a 15s interval. At 5s it would
 * be a write query every 5 seconds to look for rows that, by definition, cannot
 * appear more than once every STALE_CLAIM_MS. Once a minute is still far more
 * often than it can possibly find anything.
 */
const STALE_SWEEP_INTERVAL_MS = num('SHEET_PUSH_STALE_SWEEP_MS', 60 * 1000);
let lastStaleSweepAt = 0;
/** How often one vendor may be told their credits ran out. */
const EMPTY_NOTICE_COOLDOWN_MS = num('SHEET_PUSH_EMPTY_NOTICE_MS', 24 * 60 * 60 * 1000);
/** How stale a sheet read may be before a request path pays for a fresh one. */
const RECONCILE_TTL_MS = num('SHEET_RECONCILE_TTL_MS', 60 * 1000);
/** Leads re-queued per tick by the auto backfill. */
const BACKFILL_LIMIT = num('SHEET_PUSH_BACKFILL_LIMIT', 500);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Leads that came FROM a Google Sheet are never written back INTO one — that is a
 * loop, and the inbound sync would re-import our own rows as new leads.
 */
export const SKIP_SOURCES = new Set(['GOOGLE_SHEETS']);

export type PushOrigin = 'AUTO' | 'MANUAL';

// ─── Credit account ──────────────────────────────────────────────────────────

/** Current balance, without creating an account for someone who has never had one. */
export async function getCreditBalance(userId: number): Promise<number> {
  const account = await prisma.sheetCreditAccount.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return account?.balance ?? 0;
}

/** Creates the account on first use. Safe against a concurrent create. */
export async function ensureCreditAccount(userId: number) {
  return prisma.sheetCreditAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

function emitBalance(userId: number, balance: number) {
  try {
    getIO()?.to(`user:${userId}`).emit('sheet-credits', { balance });
  } catch (err) {
    // Never let a realtime hiccup break the write that just succeeded.
    console.error('[SheetPush] balance emit failed:', err);
  }
}

/**
 * Serialises drains per vendor within this process.
 *
 * The cron's re-entrancy guard only stops the cron racing itself; `pushLeadsNow`
 * runs a drain inline on an HTTP request, so a manual push and a cron tick can
 * otherwise be inside drainVendor for the same seller at the same time. That
 * race overdraws the credit balance (both read it before either spends) and,
 * combined with an unscoped claim, appends the same leads twice. pm2 runs one
 * instance, so an in-process chain is sufficient; the claim token below is what
 * keeps it correct if that ever changes.
 */
const vendorChains = new Map<number, Promise<void>>();

function withVendorLock<T>(vendorId: number, fn: () => Promise<T>): Promise<T> {
  const previous = vendorChains.get(vendorId) ?? Promise.resolve();
  // Runs after the previous drain settles, however it settled.
  const run = previous.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  vendorChains.set(vendorId, tail);
  // Drop the entry once this is the last link, so the map cannot grow forever.
  void tail.then(() => {
    if (vendorChains.get(vendorId) === tail) vendorChains.delete(vendorId);
  });
  return run;
}

/** vendorId -> when they were last told their balance is empty. */
const emptyNoticeSentAt = new Map<number, number>();

/**
 * Canonical phone key for duplicate detection across Moroccan and international numbers:
 * Maps Eastern Arabic digits to ASCII, strips non-digits, and reduces Moroccan numbers
 * (06..., 05..., 07..., 212..., 00212...) to their 9-digit subscriber core.
 */
function phoneKey(raw?: string | null): string {
  const ascii = String(raw ?? '').replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660)
  );
  const digits = ascii.replace(/\D/g, '');
  if (/^0[5-7]\d{8}$/.test(digits)) return digits.slice(1);
  if (/^212[5-7]\d{8}$/.test(digits)) return digits.slice(3);
  if (/^00212[5-7]\d{8}$/.test(digits)) return digits.slice(5);
  return digits;
}

async function notifyEmptyBalance(vendorId: number, pending: number) {
  const last = emptyNoticeSentAt.get(vendorId) ?? 0;
  if (Date.now() - last < EMPTY_NOTICE_COOLDOWN_MS) return;
  emptyNoticeSentAt.set(vendorId, Date.now());
  await createNotification(
    vendorId,
    'SHEET_CREDITS_EMPTY',
    'Crédits Google Sheets épuisés',
    `${pending} lead(s) attendent d'être envoyés vers votre feuille Google Sheets. ` +
      "Rechargez votre solde ou activez un pack mensuel pour reprendre l'envoi — aucun lead n'est perdu."
  );
}

// ─── Enqueue ─────────────────────────────────────────────────────────────────

interface VendorPushConfig {
  googleSheetsOutboundEnabled: boolean;
  googleSheetOutId: string | null;
  googleSheetOutTab: string | null;
  googleSheetOutActive: boolean;
  googleSheetOutAuto: boolean;
  googleSheetOutHeaderCols: number | null;
  googleSheetOutColumns: string | null;
}

async function loadVendorConfig(vendorId: number): Promise<VendorPushConfig | null> {
  return prisma.user.findUnique({
    where: { id: vendorId },
    select: {
      googleSheetsOutboundEnabled: true,
      googleSheetOutId: true,
      googleSheetOutTab: true,
      googleSheetOutActive: true,
      googleSheetOutAuto: true,
      googleSheetOutHeaderCols: true,
      googleSheetOutColumns: true,
    },
  });
}

function canPush(config: VendorPushConfig | null, origin: PushOrigin): boolean {
  if (!config) return false;
  if (!config.googleSheetsOutboundEnabled) return false;
  if (!config.googleSheetOutId) return false;
  if (!config.googleSheetOutActive) return false;
  // The auto switch gates automatic pushes only. A seller clicking "send" in the
  // leads table is an explicit instruction and does not consult it.
  if (origin === 'AUTO' && !config.googleSheetOutAuto) return false;
  return true;
}

/**
 * Queue one lead for its seller's sheet. Never throws and never blocks: every call
 * site is on a request path that must succeed whether or not this works.
 */
export async function enqueueSheetPush(
  leadId: number,
  vendorId: number,
  source?: string | null,
  origin: PushOrigin = 'AUTO'
): Promise<boolean> {
  try {
    if (!leadId || !vendorId) return false;
    if (source && SKIP_SOURCES.has(source)) return false;

    const config = await loadVendorConfig(vendorId);
    if (!canPush(config, origin)) return false;

    await prisma.sheetPushJob.create({
      data: { leadId, vendorId, origin, sheetId: config!.googleSheetOutId },
    });
    return true;
  } catch (err: any) {
    // P2002 on leadId is the idempotency guard doing its job: a retried form POST
    // or a double-clicked insert already queued this lead. Not an error.
    if (err?.code !== 'P2002') {
      console.error('[SheetPush] enqueue failed for lead', leadId, err);
    }
    return false;
  }
}

/**
 * Bulk variant for the CSV/XLSX import path: one statement for the whole batch
 * rather than one round trip per row.
 */
export async function enqueueSheetPushMany(
  vendorId: number,
  leadIds: number[],
  source?: string | null,
  origin: PushOrigin = 'AUTO'
): Promise<number> {
  try {
    if (!vendorId || !leadIds.length) return 0;
    if (source && SKIP_SOURCES.has(source)) return 0;

    const config = await loadVendorConfig(vendorId);
    if (!canPush(config, origin)) return 0;

    const result = await prisma.sheetPushJob.createMany({
      data: leadIds.map((leadId) => ({
        leadId,
        vendorId,
        origin,
        sheetId: config!.googleSheetOutId,
      })),
      skipDuplicates: true,
    });
    return result.count;
  } catch (err) {
    console.error('[SheetPush] bulk enqueue failed for vendor', vendorId, err);
    return 0;
  }
}

/**
 * Queues leads that automatic sending should have taken but never did.
 *
 * `enqueueSheetPush` runs at capture time and returns early when the auto switch is
 * off, so a lead captured while it was off has NO job — and turning the switch on
 * later never went back for it. The result looked like a broken feature: a seller
 * with credit, auto-send on, and leads sitting there that the drain could not see,
 * because the drain only ever looks at jobs.
 *
 * The floor is the moment the sheet was connected, so this can never sweep up the
 * seller's whole history. Anything it does queue is still subject to the reservation:
 * only the leads the balance covers actually get written.
 */
export async function backfillAutoQueue(vendorId: number): Promise<number> {
  try {
    const config = await loadVendorConfig(vendorId);
    if (!canPush(config, 'AUTO')) return 0;

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { googleSheetOutConnectedAt: true },
    });
    const since = vendor?.googleSheetOutConnectedAt;
    if (!since) return 0;

    const orphans = await prisma.lead.findMany({
      where: {
        vendorId,
        createdAt: { gte: since },
        sheetPushJob: null, // never queued by any path
        source: { notIn: Array.from(SKIP_SOURCES) },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BACKFILL_LIMIT,
      select: { id: true },
    });
    if (!orphans.length) return 0;

    const queued = await enqueueSheetPushMany(vendorId, orphans.map((o) => o.id), null, 'AUTO');
    if (queued > 0) console.log(`[SheetPush] backfilled ${queued} un-queued lead(s) for vendor ${vendorId}`);
    return queued;
  } catch (err) {
    console.error('[SheetPush] auto backfill failed for vendor', vendorId, err);
    return 0;
  }
}

// ─── Draining ────────────────────────────────────────────────────────────────

export interface DrainStats {
  claimed: number;
  sent: number;
  blocked: number;
  failed: number;
  retrying: number;
  skipped: number;
  error?: string;
}

const emptyStats = (): DrainStats => ({ claimed: 0, sent: 0, blocked: 0, failed: 0, retrying: 0, skipped: 0 });

function backoffMs(attempts: number, hinted?: number | null): number {
  const jitter = Math.floor(Math.random() * 1000);
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS) + jitter;
  return Math.max(base, hinted ?? 0);
}

/**
 * Releases claims left behind by a process that died between claiming a job and
 * hearing back from Google.
 *
 * These are marked FAILED rather than retried, and say so: the append may well
 * have landed, so retrying blind would put the lead in the seller's sheet twice.
 * Google's append has no idempotency key, so this is the honest trade — a rare
 * missing row the seller can re-send by hand, over a silent duplicate.
 */
async function releaseStaleClaims(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS);
  const { count } = await prisma.sheetPushJob.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: cutoff } },
    data: {
      status: 'FAILED',
      lastError:
        "Envoi interrompu — état incertain côté Google. La ligne a peut-être été écrite ; renvoyez ce lead manuellement si elle manque.",
    },
  });
  if (count > 0) console.warn(`[SheetPush] released ${count} stale claim(s)`);
  return count;
}

/**
 * Charges the seller for rows Google confirmed, in one transaction.
 *
 * THE PACK PAYS FIRST. If the account is on a monthly pack with quota left, those
 * leads are booked against the quota and their ledger rows carry `amount: 0` and a
 * `subscriptionId` — the seller already paid for them once, at the start of the
 * month, and taking the tariff out of the cents balance too would be charging
 * twice. Only what the quota cannot cover falls through to the per-lead tariff.
 *
 * The ledger row is written EITHER WAY, still as type CONSUME: every predicate in
 * the codebase that means "this lead has been paid for" — the reservation gate, the
 * re-run filter just below — reads exactly that, so a pack-covered lead has to look
 * paid to all of them. `subscriptionId` is what separates the two in a finance view.
 *
 * `SheetCreditTransaction.leadId` is unique, so a second charge for the same lead
 * is impossible at the database level rather than by convention. `balanceAfter` is
 * read off the atomic decrement's return value — never a read-then-write, which is
 * the lost-update bug this codebase already has in a few older money paths.
 */
async function chargeCredits(
  vendorId: number,
  leadIds: number[]
): Promise<{ charged: number; balance: number }> {
  if (!leadIds.length) return { charged: 0, balance: await getCreditBalance(vendorId) };

  // Anything already charged (a re-run after a partial failure) is filtered out
  // here so the decrement below matches the ledger rows exactly.
  const alreadyCharged = await prisma.sheetCreditTransaction.findMany({
    where: { leadId: { in: leadIds }, type: 'CONSUME' },
    select: { leadId: true },
  });
  const chargedSet = new Set(alreadyCharged.map((t) => t.leadId));
  const toCharge = leadIds.filter((id) => !chargedSet.has(id));
  if (!toCharge.length) return { charged: 0, balance: await getCreditBalance(vendorId) };

  const subscription = await getActiveSubscriptionRow(vendorId);

  return prisma.$transaction(async (tx) => {
    // Book as much as the pack will take. The claim is a guarded UPDATE inside this
    // same transaction, so it commits with the ledger rows it pays for or not at all.
    const fromPlan = subscription ? await claimPlanQuota(tx as any, subscription.id, toCharge.length) : 0;
    const fromBalance = toCharge.length - fromPlan;

    // A pack that covered the whole batch leaves the balance untouched — no write,
    // so `updatedAt` on the account does not move for a month of covered rows. The
    // upsert is only there to hand the ledger rows an accountId when the seller has
    // never held a cents balance at all.
    const account =
      fromBalance > 0
        ? await tx.sheetCreditAccount.update({
            where: { userId: vendorId },
            data: {
              // Cents, at the configured tariff — not one unit per lead.
              balance: { decrement: fromBalance * LEAD_PRICE_CENTS },
              totalConsumed: { increment: fromBalance * LEAD_PRICE_CENTS },
            },
          })
        : await tx.sheetCreditAccount.upsert({
            where: { userId: vendorId },
            create: { userId: vendorId },
            update: {},
          });

    // The pack-covered leads are the FIRST of the batch, so the balance-after
    // figures on the tariffed rows below stay a contiguous descending run.
    //
    // They carry the balance as it stood BEFORE the decrement above, not
    // `account.balance`: nothing left the balance for these rows, and stamping
    // them with the post-decrement figure would make the statement jump down to
    // the closing balance and then back up again on the tariffed rows underneath.
    const balanceBefore = account.balance + fromBalance * LEAD_PRICE_CENTS;

    for (let i = 0; i < fromPlan; i++) {
      await tx.sheetCreditTransaction.create({
        data: {
          accountId: account.id,
          type: 'CONSUME',
          // Zero, not the tariff: nothing left the balance for this row.
          amount: 0,
          balanceAfter: balanceBefore,
          leadId: toCharge[i],
          subscriptionId: subscription!.id,
          description: `Lead #${toCharge[i]} envoyé vers Google Sheets (inclus dans le pack)`,
        },
      });
    }

    // Descending so each row carries the balance as it stood after that charge,
    // matching how WalletTransaction.balanceAfterMad is read.
    for (let i = 0; i < fromBalance; i++) {
      await tx.sheetCreditTransaction.create({
        data: {
          accountId: account.id,
          type: 'CONSUME',
          amount: -LEAD_PRICE_CENTS,
          balanceAfter: account.balance + (fromBalance - 1 - i) * LEAD_PRICE_CENTS,
          leadId: toCharge[fromPlan + i],
          description: `Lead #${toCharge[fromPlan + i]} envoyé vers Google Sheets`,
        },
      });
    }

    return { charged: toCharge.length, balance: account.balance };
  });
}

/**
 * Processes one vendor's queued rows: claim, append, charge.
 *
 * `jobIds` restricts the batch to a specific set, which is what the manual
 * "send to Google Sheets" button uses so it can report real counts immediately
 * instead of telling the seller to wait for the next tick.
 */
export function drainVendor(vendorId: number, jobIds?: number[]): Promise<DrainStats> {
  return withVendorLock(vendorId, () => drainVendorLocked(vendorId, jobIds));
}

async function drainVendorLocked(vendorId: number, jobIds?: number[]): Promise<DrainStats> {
  const stats = emptyStats();

  const config = await loadVendorConfig(vendorId);
  if (!config?.googleSheetsOutboundEnabled || !config.googleSheetOutId) {
    // The admin revoked the feature, or the sheet went away without going through
    // /outbound/disconnect. Nothing queued can ever drain, so retire it.
    const { count } = await prisma.sheetPushJob.updateMany({
      where: {
        vendorId,
        status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] },
        ...(jobIds ? { id: { in: jobIds } } : {}),
      },
      data: { status: 'SKIPPED', lastError: 'Connexion Google Sheets inactive.' },
    });
    stats.skipped = count;
    return stats;
  }

  if (!config.googleSheetOutActive) {
    // Paused by the seller from the panel. Leave the queue exactly as it is:
    // pausing is meant to be reversible, and rewriting the backlog to SKIPPED
    // would silently throw away every lead captured while it was off.
    return stats;
  }

  if (!isWriterConfigured()) {
    stats.error = 'NOT_CONFIGURED';
    return stats;
  }

  const now = new Date();
  const candidates = await prisma.sheetPushJob.findMany({
    where: {
      vendorId,
      ...(jobIds ? { id: { in: jobIds } } : {}),
      OR: [{ status: 'PENDING', nextAttemptAt: { lte: now } }, { status: 'BLOCKED_NO_CREDITS' }],
    },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
    select: { id: true, leadId: true, attempts: true, origin: true },
  });
  if (!candidates.length) return stats;

  const candidateLeads = await prisma.lead.findMany({
    where: { id: { in: candidates.map((c) => c.leadId) } },
    select: { id: true, createdAt: true, phone: true },
  });
  const candidateLeadMap = new Map(candidateLeads.map((l) => [l.id, l]));

  // Automatic sending duplicate filter: Automatic jobs must never send duplicate
  // phone numbers to Google Sheets or charge credits for them.
  const candidateKeys = new Set<string>();
  for (const lead of candidateLeads) {
    const key = phoneKey(lead.phone);
    if (key) candidateKeys.add(key);
  }

  if (candidateKeys.size) {
    const inSheetLeads = await prisma.lead.findMany({
      where: {
        vendorId,
        id: { notIn: candidates.map((c) => c.leadId) },
        sheetPushJob: { status: { in: ['SENT', 'PENDING', 'SENDING', 'BLOCKED_NO_CREDITS'] } },
      },
      select: { phone: true },
      take: 20000,
    });
    const existingSheetKeys = new Set(
      inSheetLeads.map((l) => phoneKey(l.phone)).filter(Boolean)
    );

    const seenBatchKeys = new Set<string>();
    const duplicateJobIds: number[] = [];

    for (const job of candidates) {
      if (job.origin === 'AUTO') {
        const lead = candidateLeadMap.get(job.leadId);
        const key = lead ? phoneKey(lead.phone) : '';
        if (key) {
          if (existingSheetKeys.has(key) || seenBatchKeys.has(key)) {
            duplicateJobIds.push(job.id);
            continue;
          }
          seenBatchKeys.add(key);
        }
      }
    }

    if (duplicateJobIds.length) {
      await prisma.sheetPushJob.updateMany({
        where: { id: { in: duplicateJobIds } },
        data: {
          status: 'SKIPPED',
          lastError: 'Doublon ignoré : numéro de téléphone déjà dans la feuille.',
        },
      });
      stats.skipped += duplicateJobIds.length;

      const dupSet = new Set(duplicateJobIds);
      for (let i = candidates.length - 1; i >= 0; i--) {
        if (dupSet.has(candidates[i].id)) candidates.splice(i, 1);
      }
      if (!candidates.length) return stats;
    }
  }

  // Never write a lead the seller cannot even see.
  //
  // A locked lead is one the reservation does not cover, so it has no credit behind
  // it. Gating only on the raw balance let auto-send spend a credit reserved for an
  // older, visible lead on a newer locked one — putting the customer's number in the
  // sheet while the dashboard still masked it in the table. The rule is simply: you
  // can only send what you can see.
  const lockedLeadIds = await getLockedLeadIds(vendorId, candidateLeads);
  if (lockedLeadIds.size) {
    const lockedJobIds = candidates.filter((c) => lockedLeadIds.has(c.leadId)).map((c) => c.id);
    const { count } = await prisma.sheetPushJob.updateMany({
      where: { id: { in: lockedJobIds }, status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] } },
      // `attempts` deliberately untouched: waiting for credit must not burn the
      // retry budget, exactly as in the empty-balance branch below.
      data: { status: 'BLOCKED_NO_CREDITS', lastError: 'Crédits insuffisants — lead verrouillé.' },
    });
    stats.blocked += count;
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (lockedLeadIds.has(candidates[i].leadId)) candidates.splice(i, 1);
    }
    if (!candidates.length) return stats;
  }

  const [balance, planRemaining] = await Promise.all([getCreditBalance(vendorId), getPlanRemaining(vendorId)]);
  // Affordability is in leads: the pack's remaining quota, plus whatever the cents
  // balance buys at the tariff. Below one lead there is nothing that can be sent,
  // however many cents are left over.
  const affordableLeads = planRemaining + centsToLeads(balance);
  if (affordableLeads < 1) {
    const { count } = await prisma.sheetPushJob.updateMany({
      where: { id: { in: candidates.map((c) => c.id) }, status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] } },
      // Deliberately does NOT touch `attempts`: an unfunded job must not burn its
      // retry budget while it waits for the seller to top up.
      data: { status: 'BLOCKED_NO_CREDITS', lastError: 'Crédits insuffisants.' },
    });
    stats.blocked = count;
    const pending = await prisma.sheetPushJob.count({ where: { vendorId, status: 'BLOCKED_NO_CREDITS' } });
    await notifyEmptyBalance(vendorId, pending);
    return stats;
  }

  // Never append more rows than the seller can pay for; the rest stay queued.
  const affordable = candidates.slice(0, Math.min(candidates.length, affordableLeads));
  if (affordable.length < candidates.length) {
    const remainder = candidates.slice(affordable.length).map((c) => c.id);
    const { count } = await prisma.sheetPushJob.updateMany({
      // Status filter matters: without it this can drag a row another runner has
      // already claimed back out of SENDING.
      where: { id: { in: remainder }, status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] } },
      data: { status: 'BLOCKED_NO_CREDITS', lastError: 'Crédits insuffisants.' },
    });
    stats.blocked += count;
  }

  // Claim before calling Google. The status predicate makes this an atomic
  // compare-and-set, and the token records WHICH run won each row.
  const claimIds = affordable.map((c) => c.id);
  const claimToken = randomUUID();
  const { count: claimed } = await prisma.sheetPushJob.updateMany({
    where: { id: { in: claimIds }, status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] } },
    data: { status: 'SENDING', claimToken },
  });
  if (claimed === 0) return stats;

  // Read back BY TOKEN, never by status. Filtering on `status: SENDING` would
  // also match rows a concurrent runner claimed, and both runs would then append
  // the same leads into the seller sheet — with the ledger showing one charge,
  // so the duplication would leave no trace.
  const claimedJobs = await prisma.sheetPushJob.findMany({
    where: { claimToken },
    orderBy: { id: 'asc' },
    select: { id: true, leadId: true, attempts: true },
  });
  stats.claimed = claimedJobs.length;

  // `include`, never `select`. Every Lead scalar buildLeadRow reads — variantName
  // and packQuantity among them — rides along for free only because there is no
  // explicit field list here. Converting this to a `select` writes blank Variante
  // and Quantité cells in production while the writer's unit tests, which hand-build
  // the lead object, keep passing.
  const leads = await prisma.lead.findMany({
    where: { id: { in: claimedJobs.map((j) => j.leadId) } },
    include: {
      order: {
        select: {
          totalAmountMad: true,
          productVariant: true,
          packageContent: true,
          items: {
            select: {
              quantity: true,
              totalPriceMad: true,
              product: { select: { sku: true, nameFr: true, nameAr: true, nameEn: true } },
            },
          },
        },
      },
      // Load-bearing for the Prix (MAD) column: getPackPrice falls back through
      // the landing page's pack options and then the product's list price, and a
      // prospect has neither an order nor a confirmed price. Omit this and every
      // unconfirmed lead is written with a blank price.
      referralLink: {
        select: {
          landingPage: { select: { customStructure: true } },
          product: { select: { sku: true, nameFr: true, nameAr: true, nameEn: true, retailPriceMad: true } },
        },
      },
    },
  });
  const leadById = new Map(leads.map((l) => [l.id, l]));

  // A lead deleted between enqueue and drain has nothing to write.
  const orphaned = claimedJobs.filter((j) => !leadById.has(j.leadId));
  if (orphaned.length) {
    await prisma.sheetPushJob.updateMany({
      where: { id: { in: orphaned.map((j) => j.id) } },
      data: { status: 'SKIPPED', lastError: 'Lead supprimé avant envoi.' },
    });
    stats.skipped += orphaned.length;
  }

  const live = claimedJobs.filter((j) => leadById.has(j.leadId));
  if (!live.length) return stats;

  const tab = config.googleSheetOutTab || DEFAULT_TAB;
  // The seller's chosen columns (null selection = all), resolved once for both the
  // rows and the header. buildLeadRow projects each lead down to exactly these.
  const columns = resolveOutboundColumns(parseOutboundSelection(config.googleSheetOutColumns));
  const labels = outboundLabels(columns);
  const rows = live.map((j) => buildLeadRow(leadById.get(j.leadId)!, columns));

  // Keep the sheet's header in step with the current selection before the rows
  // land. Two states reach here: a seller who connected before a column was added
  // and never re-applied (their header is a column short), and a seller who just
  // changed which columns they send (the API applies the header immediately, but a
  // failed apply leaves the marker stale for the next drain to repair). Left alone,
  // buildLeadRow's cells would arrive under a mismatched heading. applyHeaderTemplate
  // overwrites row 1 in place, shifting no data.
  //
  // Guarded by a stored fingerprint rather than attempted every tick: this costs
  // Google calls and must not become a per-drain tax. The fingerprint is order-
  // sensitive where the old width marker was not — a seller reordering columns
  // changes the header without changing its width. A failure is swallowed on
  // purpose and the marker left stale so the next tick retries — a header out of
  // step is cosmetic and must never cost the seller the lead rows themselves.
  if (config.googleSheetOutHeaderCols !== headerSignature(labels)) {
    try {
      const applied = await applyHeaderTemplate(config.googleSheetOutId, tab, labels);
      if (applied.ok) {
        await prisma.user.update({
          where: { id: vendorId },
          data: { googleSheetOutHeaderCols: headerSignature(labels) },
        });
      }
    } catch (err) {
      console.error('[SheetPush] header sync failed for vendor', vendorId, err);
    }
  }

  let result: SheetWriteResult;
  try {
    result = await appendRows(config.googleSheetOutId, tab, rows);
  } catch (err: any) {
    result = { ok: false, status: 0, retriable: true, reason: 'UPSTREAM', error: err?.message ?? 'Erreur inconnue' };
  }

  if (!result.ok) {
    const permanent = !result.retriable;
    for (const job of live) {
      const attempts = job.attempts + 1;
      const giveUp = permanent || attempts >= MAX_ATTEMPTS;
      await prisma.sheetPushJob.update({
        where: { id: job.id },
        data: {
          status: giveUp ? 'FAILED' : 'PENDING',
          attempts,
          lastError: result.error?.slice(0, 500) ?? null,
          nextAttemptAt: giveUp ? new Date() : new Date(Date.now() + backoffMs(attempts, result.retryAfterMs)),
        },
      });
      if (giveUp) stats.failed++;
      else stats.retrying++;
    }

    // Surfaced on the seller's panel: a silent stop is how the inbound integration
    // loses people, and this one costs them credits when it works.
    await prisma.user.update({
      where: { id: vendorId },
      data: {
        googleSheetOutLastError: result.error?.slice(0, 500) ?? 'Erreur inconnue',
        googleSheetOutLastErrorAt: new Date(),
      },
    });
    return stats;
  }

  // The rows are in the seller's sheet from here on. Marking them SENT must happen
  // whatever else fails, or the next tick appends them a second time.
  await prisma.sheetPushJob.updateMany({
    where: { id: { in: live.map((j) => j.id) } },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      rowRange: result.updatedRange ?? null,
      lastError: null,
    },
  });
  stats.sent = live.length;

  try {
    const { charged, balance: after } = await chargeCredits(vendorId, live.map((j) => j.leadId));
    if (charged > 0) emitBalance(vendorId, after);
  } catch (err) {
    // Deliberately swallowed: the rows exist, so under-charging is the correct
    // failure here. The ledger's unique leadId means a later reconciliation can
    // still find and bill them without any risk of double-charging.
    console.error('[SheetPush] credit charge failed after a successful append for vendor', vendorId, err);
  }

  if (result.updatedRange) {
    await prisma.user.update({
      where: { id: vendorId },
      data: { googleSheetOutLastError: null, googleSheetOutLastErrorAt: null },
    });
  }

  return stats;
}

/** One cron tick: releases stale claims, then drains the vendors that have work. */
export async function runSheetPushDrain(): Promise<DrainStats> {
  const totals = emptyStats();

  if (Date.now() - lastStaleSweepAt >= STALE_SWEEP_INTERVAL_MS) {
    lastStaleSweepAt = Date.now();
    try {
      await releaseStaleClaims();
    } catch (err) {
      console.error('[SheetPush] stale-claim sweep failed:', err);
    }
  }

  if (!isWriterConfigured()) return totals;

  // Sweep up leads auto-send never queued, BEFORE picking vendors to drain. The
  // selection below is driven entirely by existing jobs, so a seller whose leads
  // were all captured with the switch off would otherwise never be looked at.
  try {
    const autoVendors = await prisma.user.findMany({
      where: {
        googleSheetsOutboundEnabled: true,
        googleSheetOutAuto: true,
        googleSheetOutActive: true,
        googleSheetOutId: { not: null },
      },
      select: { id: true },
    });
    for (const v of autoVendors) await backfillAutoQueue(v.id);
  } catch (err) {
    console.error('[SheetPush] auto backfill sweep failed:', err);
  }

  const now = new Date();
  let vendorIds: number[] = [];
  try {
    // Only vendors whose queue can actually MOVE this tick get a slot.
    //
    // Ranking by raw queue depth instead would hand every slot to whoever has the
    // biggest backlog — and an unfunded seller's backlog only grows, since a
    // zero-balance drain just re-marks the same rows BLOCKED and returns. A single
    // seller who stopped buying credits would then starve everyone else forever.
    const pendingGroups = await prisma.sheetPushJob.groupBy({
      by: ['vendorId'],
      where: { status: 'PENDING', nextAttemptAt: { lte: now } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // A parked backlog is only worth a slot once the account has been topped up.
    const blockedGroups = await prisma.sheetPushJob.groupBy({
      by: ['vendorId'],
      where: { status: 'BLOCKED_NO_CREDITS' },
      _count: { _all: true },
    });
    const fundedBlocked = blockedGroups.length
      ? (
          await prisma.sheetCreditAccount.findMany({
            where: { userId: { in: blockedGroups.map((g) => g.vendorId) }, balance: { gte: 1 } },
            select: { userId: true },
          })
        ).map((a) => a.userId)
      : [];

    const candidateIds = Array.from(new Set([...pendingGroups.map((g) => g.vendorId), ...fundedBlocked]));
    if (!candidateIds.length) return totals;

    // Paused or disconnected sellers must not consume a slot either.
    const liveVendors = await prisma.user.findMany({
      where: {
        id: { in: candidateIds },
        googleSheetsOutboundEnabled: true,
        googleSheetOutActive: true,
        googleSheetOutId: { not: null },
      },
      select: { id: true },
    });
    const live = new Set(liveVendors.map((u) => u.id));
    vendorIds = candidateIds.filter((id) => live.has(id)).slice(0, VENDORS_PER_TICK);
  } catch (err) {
    console.error('[SheetPush] failed to list vendors with pending rows:', err);
    return totals;
  }

  for (const vendorId of vendorIds) {
    try {
      const stats = await drainVendor(vendorId);
      totals.claimed += stats.claimed;
      totals.sent += stats.sent;
      totals.blocked += stats.blocked;
      totals.failed += stats.failed;
      totals.retrying += stats.retrying;
      totals.skipped += stats.skipped;
    } catch (err) {
      // One bad vendor must not stop the others from being drained.
      console.error('[SheetPush] drain failed for vendor', vendorId, err);
    }
    await sleep(MIN_GAP_MS);
  }


  return totals;
}

/**
 * The manual "send to Google Sheets" path used by the per-row icon and the bulk
 * button. Enqueues and drains in the same request so the seller gets real counts
 * rather than "queued, check back later".
 */
export async function pushLeadsNow(
  vendorId: number,
  leadIds: number[]
): Promise<DrainStats & { alreadySent: number; balance: number }> {
  const unique = Array.from(new Set(leadIds.filter((id) => Number.isInteger(id) && id > 0)));
  const base = { ...emptyStats(), alreadySent: 0, balance: await getCreditBalance(vendorId) };
  if (!unique.length) return base;

  // Only this seller's own leads, and never one that came from a sheet.
  const owned = await prisma.lead.findMany({
    where: { id: { in: unique }, vendorId },
    select: { id: true, source: true },
  });
  const pushable = owned.filter((l) => !SKIP_SOURCES.has(l.source)).map((l) => l.id);
  if (!pushable.length) return base;

  const existing = await prisma.sheetPushJob.findMany({
    where: { leadId: { in: pushable } },
    select: { id: true, leadId: true, status: true },
  });
  const existingByLead = new Map(existing.map((j) => [j.leadId, j]));

  base.alreadySent = existing.filter((j) => j.status === 'SENT').length;

  const fresh = pushable.filter((id) => !existingByLead.has(id));
  if (fresh.length) {
    await enqueueSheetPushMany(vendorId, fresh, null, 'MANUAL');
  }

  // A row the seller is explicitly re-sending gets another go, including ones that
  // previously failed, ran out of credits, or were written and then deleted out of
  // the sheet by hand (REMOVED — see reconcileVendorSheet). Re-sending a REMOVED
  // lead is free: chargeCredits filters out anything that already carries a CONSUME
  // row, so the append happens and the balance does not move.
  const retryable = existing.filter(
    (j) =>
      j.status === 'FAILED' ||
      j.status === 'BLOCKED_NO_CREDITS' ||
      j.status === 'SKIPPED' ||
      j.status === 'REMOVED'
  );
  if (retryable.length) {
    await prisma.sheetPushJob.updateMany({
      where: { id: { in: retryable.map((j) => j.id) } },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), origin: 'MANUAL', lastError: null },
    });
  }

  const jobs = await prisma.sheetPushJob.findMany({
    where: { leadId: { in: pushable }, status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] } },
    select: { id: true },
  });
  if (!jobs.length) return base;

  const stats = await drainVendor(vendorId, jobs.map((j) => j.id));
  return { ...stats, alreadySent: base.alreadySent, balance: await getCreditBalance(vendorId) };
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

/** vendorId -> when their sheet was last re-read. */
const lastReconcileAt = new Map<number, number>();

/**
 * Re-aligns SENT/REMOVED with what the seller's sheet actually contains.
 *
 * WHY THIS EXISTS. An append is the last time this pipeline looks at the document.
 * A seller who selects their rows and deletes them — which they are entitled to do,
 * it is their spreadsheet — leaves every job SENT forever, so the platform keeps
 * claiming leads are in a sheet that no longer holds them and the per-row send icon
 * stays hidden. Reading the Lead ID column back is the only way to know.
 *
 * It flips both ways: a row that vanished becomes REMOVED, and one that came back
 * (the seller hit undo, or restored a copy) becomes SENT again.
 *
 * Never throws — every caller is on a request path that must answer regardless.
 */
export async function reconcileVendorSheet(
  vendorId: number,
  opts?: { force?: boolean }
): Promise<{ checked: number; removed: number; restored: number; skipped?: string }> {
  const zero = { checked: 0, removed: 0, restored: 0 };

  try {
    // The leads table asks for sheet status on every render and every page change.
    // Reading Google that often would burn the per-minute read quota for no new
    // information, so a request path gets a cached-by-omission answer instead; the
    // seller's own "re-check" button passes force and always pays for a real read.
    const last = lastReconcileAt.get(vendorId) ?? 0;
    if (!opts?.force && Date.now() - last < RECONCILE_TTL_MS) {
      return { ...zero, skipped: 'THROTTLED' };
    }

    const config = await loadVendorConfig(vendorId);
    if (!config?.googleSheetsOutboundEnabled || !config.googleSheetOutId) {
      return { ...zero, skipped: 'NOT_CONNECTED' };
    }
    // Deliberately NOT gated on googleSheetOutActive: a seller who paused the push
    // still wants to know their existing rows disappeared.
    if (!isWriterConfigured()) return { ...zero, skipped: 'NOT_CONFIGURED' };

    return await withVendorLock(vendorId, async () => {
      // Inside the lock, and that is load-bearing. A drain that is mid-append has
      // rows Google has not answered on yet; reading between the append and the
      // SENT update would see them as absent and flip leads the seller just paid
      // for straight to REMOVED.
      //
      // Stamped before the read, not after: a sheet that errors must not be
      // retried on every single request either.
      lastReconcileAt.set(vendorId, Date.now());

      const tab = config.googleSheetOutTab || DEFAULT_TAB;
      const read = await readSheetLeadIds(config.googleSheetOutId, tab);
      if (!read.ok || !read.leadIds) {
        // A failed read says nothing about the contents. Treating it as "the sheet
        // is empty" would mark the seller's entire history REMOVED on one 403.
        return { ...zero, skipped: read.reason || 'READ_FAILED' };
      }
      const inSheet = read.leadIds;

      // Scoped to the document we just read. A seller who connects a DIFFERENT
      // spreadsheet still has the old one's jobs sitting at SENT, and none of those
      // ids are in the new sheet — without this filter, switching sheets would
      // report the seller's entire history as deleted.
      const jobs = await prisma.sheetPushJob.findMany({
        where: { vendorId, status: { in: ['SENT', 'REMOVED'] }, sheetId: config.googleSheetOutId },
        select: { id: true, leadId: true, status: true },
      });
      if (!jobs.length) return { ...zero };

      const gone = jobs.filter((j) => j.status === 'SENT' && !inSheet.has(j.leadId)).map((j) => j.id);
      const back = jobs.filter((j) => j.status === 'REMOVED' && inSheet.has(j.leadId)).map((j) => j.id);

      let removed = 0;
      let restored = 0;

      if (gone.length) {
        // NO REFUND, and no second charge when the lead is sent again. The seller
        // paid one credit for the delivery we performed; deleting their own row and
        // re-adding it must not bill them twice, and refunding a delivery that did
        // happen would turn the sheet into a way to mint credits. The mechanism is
        // already in place: chargeCredits skips any lead that carries a CONSUME row,
        // and SheetCreditTransaction.leadId is unique, so a re-send is free.
        const { count } = await prisma.sheetPushJob.updateMany({
          // Status re-checked in the predicate: the read above is a snapshot, and
          // this must not drag a row a concurrent path already moved back.
          where: { id: { in: gone }, status: 'SENT' },
          data: { status: 'REMOVED', lastError: 'Ligne supprimée de la feuille.' },
        });
        removed = count;
      }

      if (back.length) {
        const { count } = await prisma.sheetPushJob.updateMany({
          where: { id: { in: back }, status: 'REMOVED' },
          // lastError cleared: the row is there, so the explanation is stale.
          data: { status: 'SENT', lastError: null },
        });
        restored = count;
      }

      return { checked: jobs.length, removed, restored };
    });
  } catch (err) {
    console.error('[SheetPush] reconcile failed for vendor', vendorId, err);
    return { ...zero };
  }
}
