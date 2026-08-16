import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Recently-seen link+IP+UA combinations, so a browser that fires several
 * requests for the same page in quick succession is counted once.
 *
 * This map is module-level on purpose. Both the JSON route the SPA calls and the
 * compiled-HTML route record a click for the same visit, and a visitor served
 * the compiled page whose browser also reaches the API would otherwise be
 * counted twice. Sharing one map is what makes the two paths agree.
 */
const recentClicks = new Map<string, number>();

const DEDUPE_MS = 10_000;
const MILESTONE = 100;

export interface ReferralClickInput {
  linkId: number;
  influencerId: number;
  /** Only used for the milestone notification text. */
  code: string;
  ip: string;
  userAgent?: string | null;
}

/**
 * Records a visit to a referral link.
 *
 * A row is written for every non-duplicate visit, but `ReferralLink.clicks` only
 * moves for an IP+UA never seen on that link before — the counter means "unique
 * visitors", while the table keeps the full history.
 *
 * Never throws: click accounting must not be able to fail a page render. Callers
 * on the document path should not await it.
 */
export async function recordReferralClick(input: ReferralClickInput): Promise<void> {
  const { linkId, influencerId, code, ip } = input;
  const userAgent = typeof input.userAgent === 'string' ? input.userAgent : null;

  const clickKey = `${linkId}-${ip}-${userAgent || 'unknown'}`;
  const now = Date.now();

  const seenAt = recentClicks.get(clickKey);
  if (seenAt !== undefined && now - seenAt < DEDUPE_MS) return;

  recentClicks.set(clickKey, now);
  setTimeout(() => recentClicks.delete(clickKey), DEDUPE_MS).unref?.();

  try {
    const existingClick = await (prisma as any).referralLinkClick.findFirst({
      where: { referralLinkId: linkId, ipAddress: ip, userAgent },
    });

    await (prisma as any).referralLinkClick.create({
      data: { referralLinkId: linkId, ipAddress: ip, userAgent },
    });

    if (existingClick) return;

    const updatedLink = await (prisma as any).referralLink.update({
      where: { id: linkId },
      data: { clicks: { increment: 1 } },
    });

    if (updatedLink.clicks !== MILESTONE) return;

    try {
      const { createNotification } = await import('../utils/notification.js');
      await createNotification(
        influencerId,
        'REFERRAL_LINK_CLICKS',
        '🎉 Objectif 100 visiteurs atteint !',
        `Félicitations ! Votre lien de parrainage (${code}) a généré 100 visiteurs uniques !`
      );
    } catch (err) {
      console.error('Failed to trigger clicks milestone notification:', err);
    }
  } catch (err) {
    console.error('[referralClicks] failed to record click for link', linkId, err);
  }
}
