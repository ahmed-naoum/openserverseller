import { prisma } from '../lib/prisma.js';
import type { PageDocument } from '../shared/document/types.js';

/**
 * Drafts and versions for Studio targets.
 *
 * A draft is the working copy: every operation the editor applies lands
 * here and nowhere else, so a seller can leave a half-finished page for a
 * week without customers seeing it. Publishing copies the draft into the
 * page's live column — the same write the old save route did, compile and
 * all — records the result as a version, and deletes the draft.
 *
 * A version is what was live at a moment. Restoring one does not touch the
 * live page: it writes a new draft from that version, which the seller then
 * publishes like any other change. Restore is therefore never destructive
 * and always reversible, and the history is append-only.
 *
 * Keyed by (targetKind, targetKey) rather than by a foreign key: the targets
 * live in three different tables and one of them (the reserved store pages)
 * in a column of a fourth. A string key is the honest join.
 */

export const VERSION_LIMIT = 50;

export interface VersionSummary {
  id: number;
  label: string | null;
  source: string;
  createdById: number | null;
  createdAt: Date;
}

export async function getDraft(targetKind: string, targetKey: string): Promise<{ document: PageDocument; updatedAt: Date } | null> {
  const row = await (prisma as any).studioDraft.findUnique({ where: { targetKind_targetKey: { targetKind, targetKey } } });
  return row ? { document: row.document as PageDocument, updatedAt: row.updatedAt } : null;
}

export async function saveDraft(targetKind: string, targetKey: string, document: PageDocument, userId: number | null): Promise<void> {
  await (prisma as any).studioDraft.upsert({
    where: { targetKind_targetKey: { targetKind, targetKey } },
    update: { document, updatedById: userId },
    create: { targetKind, targetKey, document, updatedById: userId },
  });
}

export async function deleteDraft(targetKind: string, targetKey: string): Promise<void> {
  await (prisma as any).studioDraft.deleteMany({ where: { targetKind, targetKey } });
}

export async function recordVersion(
  targetKind: string,
  targetKey: string,
  document: PageDocument,
  opts: { label?: string | null; source?: string; userId?: number | null }
): Promise<VersionSummary> {
  const row = await (prisma as any).studioVersion.create({
    data: {
      targetKind,
      targetKey,
      document,
      label: opts.label?.trim().slice(0, 120) || null,
      source: opts.source || 'publish',
      createdById: opts.userId ?? null,
    },
  });

  // Bounded history. The newest fifty are the ones anyone restores; the rest
  // are cost without a reader.
  const stale = await (prisma as any).studioVersion.findMany({
    where: { targetKind, targetKey },
    orderBy: { createdAt: 'desc' },
    skip: VERSION_LIMIT,
    select: { id: true },
  });
  if (stale.length) {
    await (prisma as any).studioVersion.deleteMany({ where: { id: { in: stale.map((s: any) => s.id) } } });
  }

  return { id: row.id, label: row.label, source: row.source, createdById: row.createdById, createdAt: row.createdAt };
}

export async function listVersions(targetKind: string, targetKey: string, limit = 20): Promise<VersionSummary[]> {
  const rows = await (prisma as any).studioVersion.findMany({
    where: { targetKind, targetKey },
    orderBy: { createdAt: 'desc' },
    take: Math.min(VERSION_LIMIT, Math.max(1, limit)),
    select: { id: true, label: true, source: true, createdById: true, createdAt: true },
  });
  return rows;
}

export async function getVersion(targetKind: string, targetKey: string, id: number): Promise<{ document: PageDocument } & VersionSummary | null> {
  const row = await (prisma as any).studioVersion.findFirst({ where: { id, targetKind, targetKey } });
  if (!row) return null;
  return { id: row.id, label: row.label, source: row.source, createdById: row.createdById, createdAt: row.createdAt, document: row.document as PageDocument };
}
