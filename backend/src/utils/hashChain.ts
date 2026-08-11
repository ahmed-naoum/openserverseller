import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';

/** Rows pulled per page when walking the chain. Keeps `changes` blobs out of a single heap spike. */
const VERIFY_PAGE_SIZE = 1_000;

const sha256 = (payload: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

/**
 * Hash of the newest row, held in memory.
 *
 * Re-reading the head from Postgres on every write was a full seq scan of the
 * table (no index existed, and the table is ~1M rows), which is what pinned the
 * CPU. The head only ever changes because *we* appended, so it is cached here
 * and read from the database exactly once per process.
 *
 * `null` means "unknown, load it" — set on the first call and after any failed
 * write, so a rejected insert can never leave a phantom hash in the cache.
 */
let chainHead: string | null = null;

/**
 * Writes are appended through this promise chain. Two concurrent requests
 * previously read the same `prevHash` and both wrote it, forking the chain and
 * making verification fail forever after. Serialising the append is what makes
 * the link well-defined.
 */
let tail: Promise<unknown> = Promise.resolve();

const loadChainHead = async (): Promise<string> => {
  const last = await prisma.immutableAuditLog.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { hash: true },
  });
  return last?.hash ?? GENESIS;
};

/**
 * Append an action to the immutable audit log, linking it to the previous
 * record by SHA-256.
 *
 * Single-process assumption: the head cache is per-process, so running the API
 * under cluster/PM2 with >1 worker would let two workers append from the same
 * head. That was already true of the previous read-then-write version; making
 * it safe across processes needs a DB-side lock, not a cache change.
 */
export async function logImmutableAction(
  userId: number | null,
  userEmail: string | null,
  action: string,
  ip: string,
  changes?: any
): Promise<any> {
  const append = tail.then(async () => {
    const prevHash = chainHead ?? (chainHead = await loadChainHead());
    const changesStr = changes
      ? typeof changes === 'string'
        ? changes
        : JSON.stringify(changes)
      : null;

    const hash = sha256({ userId, userEmail, action, ip, changes: changesStr, prevHash });

    try {
      const log = await prisma.immutableAuditLog.create({
        data: { userId, userEmail, action, ip, changes: changesStr, prevHash, hash },
      });
      chainHead = hash;
      return log;
    } catch (err) {
      // The row may or may not exist now; the cached head can no longer be
      // trusted, so force the next append to re-read it.
      chainHead = null;
      throw err;
    }
  });

  // Keep the queue alive regardless of outcome, otherwise one rejection would
  // reject every future append that chains onto it.
  tail = append.catch(() => {});

  try {
    return await append;
  } catch (err) {
    console.error('Failed to write immutable audit log:', err);
  }
}

/** Drop the cached head. For tests, and after any out-of-band write to the table. */
export const resetChainCache = () => {
  chainHead = null;
};

export interface AuditChainResult {
  valid: boolean;
  tamperedIndex: number | null;
  errorRecord?: any;
  /** Rows walked. */
  checked: number;
  /**
   * False when the oldest surviving row does not link to genesis — i.e. retention
   * has pruned the head of the chain. Everything from that row forward is still
   * verified; the pruned prefix simply cannot be.
   */
  anchoredAtGenesis: boolean;
}

/**
 * Verify the integrity of the audit log hash chain.
 *
 * Paged deliberately: the previous version did an unbounded `findMany`, pulling
 * every row (~800 MB) into the heap, which is enough to OOM the process on a
 * small VPS.
 */
export async function verifyAuditChain(): Promise<AuditChainResult> {
  let cursor: string | undefined;
  let expectedPrevHash: string | null = null;
  let anchoredAtGenesis = true;
  let checked = 0;

  for (;;) {
    const page = await prisma.immutableAuditLog.findMany({
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: VERIFY_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;

    for (const log of page) {
      // Anchor on the oldest row that still exists rather than on genesis, so a
      // pruned prefix does not read as tampering at index 0.
      if (expectedPrevHash === null) {
        expectedPrevHash = log.prevHash;
        anchoredAtGenesis = log.prevHash === GENESIS;
      }

      if (log.prevHash !== expectedPrevHash) {
        return { valid: false, tamperedIndex: checked, errorRecord: log, checked, anchoredAtGenesis };
      }

      const calculatedHash = sha256({
        userId: log.userId,
        userEmail: log.userEmail,
        action: log.action,
        ip: log.ip,
        changes: log.changes,
        prevHash: log.prevHash,
      });

      if (log.hash !== calculatedHash) {
        return { valid: false, tamperedIndex: checked, errorRecord: log, checked, anchoredAtGenesis };
      }

      expectedPrevHash = log.hash;
      checked++;
    }

    if (page.length < VERIFY_PAGE_SIZE) break;
    cursor = page[page.length - 1].id;
  }

  return { valid: true, tamperedIndex: null, checked, anchoredAtGenesis };
}
