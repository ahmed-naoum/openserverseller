import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

/**
 * Log an action immutably to the audit log.
 * Computes a SHA-256 hash linking the new log to the hash of the previous log.
 */
export async function logImmutableAction(
  userId: number | null,
  userEmail: string | null,
  action: string,
  ip: string,
  changes?: any
): Promise<any> {
  try {
    // 1. Get the last log to find the previous hash
    const lastLog = await prisma.immutableAuditLog.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    const prevHash = lastLog ? lastLog.hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const changesStr = changes ? (typeof changes === 'string' ? changes : JSON.stringify(changes)) : null;

    // 2. Compute current record hash
    const dataToHash = {
      userId,
      userEmail,
      action,
      ip,
      changes: changesStr,
      prevHash,
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataToHash))
      .digest('hex');

    // 3. Create the log
    const log = await prisma.immutableAuditLog.create({
      data: {
        userId,
        userEmail,
        action,
        ip,
        changes: changesStr,
        prevHash,
        hash,
      },
    });

    return log;
  } catch (err) {
    console.error('Failed to write immutable audit log:', err);
  }
}

/**
 * Verify the integrity of the entire audit log hash chain.
 * Returns information about any detected tampering.
 */
export async function verifyAuditChain(): Promise<{
  valid: boolean;
  tamperedIndex: number | null;
  errorRecord?: any;
}> {
  const logs = await prisma.immutableAuditLog.findMany({
    orderBy: { timestamp: 'asc' },
  });

  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Check link integrity
    if (log.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        tamperedIndex: i,
        errorRecord: log,
      };
    }

    // Recalculate hash to detect payload tampering
    const dataToHash = {
      userId: log.userId,
      userEmail: log.userEmail,
      action: log.action,
      ip: log.ip,
      changes: log.changes,
      prevHash: log.prevHash,
    };

    const calculatedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataToHash))
      .digest('hex');

    if (log.hash !== calculatedHash) {
      return {
        valid: false,
        tamperedIndex: i,
        errorRecord: log,
      };
    }

    expectedPrevHash = log.hash;
  }

  return {
    valid: true,
    tamperedIndex: null,
  };
}
