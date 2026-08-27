/**
 * The live inbox: conversations, the thread, human takeover, and promoting a
 * confirmed chat into a real Lead.
 *
 * Mounted under the same /whatsapp-agent prefix as whatsappAgent.routes.ts and
 * behind the same entitlement gate.
 */

import { Router } from 'express';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { isWaAgentActive, WA_GATE_SELECT } from '../services/waCredits.service.js';
import { promoteContactToLead } from '../services/waLeadPromotion.service.js';
import { isSandboxJid } from '../wa/transport.js';
import { sendAsBenchCustomer } from '../wa/bench.js';
import { nudgeWorker } from '../lib/waWorkerClient.js';

const router = Router();

const AGENT_ROLES = ['VENDOR', 'INFLUENCER'];

const gate = asyncHandler(async (req: any, _res: any, next: any) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { ...WA_GATE_SELECT, role: { select: { name: true } } },
  });
  if (!user || !AGENT_ROLES.includes(user.role?.name || '') || !isWaAgentActive(user)) {
    throw new AppException(403, "L'agent WhatsApp n'est pas activé sur ce compte.");
  }
  next();
});

/** Loads a conversation, refusing anyone else's. */
async function ownedContact(userId: number, id: number) {
  const contact = await prisma.whatsappContact.findFirst({ where: { id, userId } });
  if (!contact) throw new AppException(404, 'Conversation introuvable.');
  return contact;
}

/* ------------------------------------------------------------------ */

router.get(
  '/conversations',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const { status, source, q } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const where: Record<string, unknown> = { userId: req.user.id };
    if (status && status !== 'all') where.status = String(status);
    if (source && source !== 'all') where.source = String(source);
    if (q) {
      const term = String(q).trim();
      where.OR = [
        { phone: { contains: term } },
        { pushName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.whatsappContact.findMany({
        where,
        // lastMessageAt can be null on a contact created before its first
        // message landed; id breaks the tie so rows cannot swap between pages.
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * take,
        take,
      }),
      prisma.whatsappContact.count({ where }),
    ]);

    res.json({
      status: 'success',
      data: {
        conversations,
        pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
      },
    });
  })
);

router.get(
  '/conversations/:id/messages',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const contact = await ownedContact(req.user.id, Number(req.params.id));
    const take = Math.min(200, Math.max(1, Number(req.query.limit) || 80));

    const messages = await prisma.whatsappMessage.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Opening the thread is what clears the badge — the same moment a human
    // actually read it.
    await prisma.whatsappContact.update({
      where: { id: contact.id },
      data: { unreadCount: 0 },
    });

    res.json({
      status: 'success',
      data: { contact, messages: messages.reverse() },
    });
  })
);

/**
 * A human takes over.
 *
 * Sending a manual message ALWAYS pauses the agent on this chat. That is not a
 * convenience, it is the guard against the agent and the operator answering the
 * same customer within seconds of each other — which reads, to the customer, as
 * two different people contradicting each other. The account turns AI replies
 * back on explicitly when it is done.
 */
router.post(
  '/conversations/:id/send',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const contact = await ownedContact(req.user.id, Number(req.params.id));

    const text = String(req.body?.text || '').trim();
    if (!text) throw new AppException(400, 'Message vide.');
    if (text.length > 4000) throw new AppException(400, 'Message trop long (4000 caractères maximum).');

    // LE BANC INVERSE CE GESTE, et il le faut.
    //
    // Ici, envoyer veut dire « un humain reprend la main » : le texte part vers
    // le client et l'IA se met en pause. Sur le banc il n'y a pas de client —
    // c'est l'utilisateur lui-même. Le même bouton doit donc vouloir dire « le
    // client vient d'écrire ça », sinon on tape dans la conversation de test,
    // l'agent reste muet, et l'écran n'explique rien.
    if (isSandboxJid(contact.jid)) {
      const message = await sendAsBenchCustomer(req.user.id, contact.id, text);
      return res.status(202).json({ status: 'success', data: { bench: true, message, aiEnabled: true } });
    }

    await prisma.whatsappContact.update({
      where: { id: contact.id },
      data: { aiEnabled: false },
    });

    const job = await prisma.whatsappOutboundJob.create({
      data: {
        userId: req.user.id,
        contactId: contact.id,
        kind: 'TEXT',
        payload: { text },
        // A retried POST cannot send the customer the same line twice.
        idempotencyKey: `manual:${contact.id}:${randomUUID()}`,
      },
    });

    await nudgeWorker('drain', req.user.id);

    res.status(202).json({ status: 'success', data: { jobId: job.id, aiEnabled: false } });
  })
);

router.patch(
  '/conversations/:id',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const contact = await ownedContact(req.user.id, Number(req.params.id));

    const data: Record<string, unknown> = {};
    if (typeof req.body?.aiEnabled === 'boolean') data.aiEnabled = req.body.aiEnabled;

    if (req.body?.status) {
      const allowed = ['NEW', 'QUALIFIED', 'CONFIRMED', 'REJECTED', 'HUMAN'];
      const next = String(req.body.status);
      if (!allowed.includes(next)) throw new AppException(400, 'Statut invalide.');
      data.status = next;
    }

    if (req.body?.draft && typeof req.body.draft === 'object') {
      data.draft = req.body.draft;
    }

    if (!Object.keys(data).length) throw new AppException(400, 'Rien à modifier.');

    const updated = await prisma.whatsappContact.update({ where: { id: contact.id }, data });
    res.json({ status: 'success', data: updated });
  })
);

/**
 * Promotes a confirmed conversation into a real Lead.
 *
 * This is the one place the agent's work crosses into the platform's billed
 * pipeline, and it is manual by default for exactly that reason: a Lead is
 * charged at User.saisieFeeMad, reserves a Google Sheets credit, can be
 * auto-forwarded to the call center, and enters the auto-release cron. An
 * account that wants it automatic turns on WhatsappAgent.autoCreateLead, and
 * then the worker calls this same code path.
 *
 * `WhatsappContact.leadId` is the idempotency guard: promoting twice returns
 * the existing lead instead of creating a second one and billing again.
 */
router.post(
  '/conversations/:id/promote',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const contact = await ownedContact(req.user.id, Number(req.params.id));

    if (contact.leadId) {
      const existing = await prisma.lead.findUnique({ where: { id: contact.leadId } });
      if (existing) {
        return res.json({ status: 'success', data: { lead: existing, alreadyPromoted: true } });
      }
    }

    const lead = await promoteContactToLead(contact.id);
    res.status(201).json({ status: 'success', data: { lead, alreadyPromoted: false } });
  })
);


/**
 * Serves one customer attachment.
 *
 * Behind authenticate + an ownership check, and reading from WA_MEDIA_ROOT
 * rather than uploads/. The path comes from the database, never from the
 * request, so there is nothing here to traverse with.
 */
router.get(
  '/media/:messageId',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const message = await prisma.whatsappMessage.findFirst({
      where: { id: Number(req.params.messageId), userId: req.user.id },
      select: { mediaPath: true, mediaMime: true },
    });

    if (!message?.mediaPath) throw new AppException(404, 'Fichier introuvable.');
    if (!fs.existsSync(message.mediaPath)) throw new AppException(410, 'Fichier expiré ou supprimé.');

    if (message.mediaMime) res.type(message.mediaMime);
    res.sendFile(message.mediaPath);
  })
);


/* ------------------------------------------------------------------ */
/* collected leads                                                     */
/* ------------------------------------------------------------------ */

/** The draft keys the agent fills, in the order a seller reads them. */
const DRAFT_FIELDS = [
  'full_name',
  'phone',
  'city',
  'address',
  'product',
  'variant',
  'quantity',
  'price',
  'notes',
] as const;

const draftValue = (draft: unknown, key: string): string => {
  const v = (draft as Record<string, unknown> | null)?.[key];
  return v === null || v === undefined ? '' : String(v).trim();
};

/**
 * A dialable number, ignoring the @lid identifier.
 *
 * Mirrors the guard in waLeadPromotion.service.ts. Kept in step deliberately:
 * a Créer-le-lead button that is enabled and then throws is worse than one
 * that is disabled with a reason.
 */
const hasRealPhone = (draft: unknown, phone: string | null, jid: string): boolean => {
  const candidate = (draftValue(draft, 'phone') || phone || '').replace(/[^0-9]/g, '');
  if (!candidate) return false;
  const lid = jid.endsWith('@lid') ? jid.split('@')[0] : null;
  return candidate !== lid;
};

const filledCount = (draft: unknown): number =>
  DRAFT_FIELDS.filter((k) => draftValue(draft, k) !== '').length;

/**
 * Everything the agent has collected, as one table.
 *
 * The inbox shows a draft one conversation at a time, which is fine for
 * answering someone and useless for working a day's leads. This is the list
 * view: every conversation that has collected something, whether it has been
 * promoted, and what it would become.
 *
 * A conversation with an EMPTY draft is excluded — it is a chat, not a lead.
 */
router.get(
  '/leads',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const status = String(req.query.status || 'all');
    const promoted = String(req.query.promoted || 'all');
    const source = String(req.query.source || 'all');
    const q = String(req.query.q || '').trim();

    const where: Record<string, unknown> = { userId: req.user.id };
    if (status !== 'all') where.status = status;
    if (source !== 'all') where.source = source;
    if (promoted === 'yes') where.leadId = { not: null };
    if (promoted === 'no') where.leadId = null;
    if (q) {
      where.OR = [
        { phone: { contains: q } },
        { pushName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.whatsappContact.findMany({
      where,
      orderBy: [{ confirmedAt: 'desc' }, { lastMessageAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        jid: true,
        phone: true,
        pushName: true,
        source: true,
        status: true,
        draft: true,
        leadId: true,
        confirmedAt: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });

    // Filtered in memory, not SQL: "has the agent collected anything" is a
    // property of a JSON column's contents, and Postgres cannot answer it
    // cheaply without a generated column. The row count per account is small.
    const collected = rows.filter((r) => filledCount(r.draft) > 0);
    const total = collected.length;
    const pageRows = collected.slice((page - 1) * take, page * take);

    // One query for the promoted leads rather than an include per row.
    const leadIds = pageRows.map((r) => r.leadId).filter((v): v is number => !!v);
    const leads = leadIds.length
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, status: true, createdAt: true, phone: true },
        })
      : [];
    const leadById = new Map(leads.map((l) => [l.id, l]));

    res.json({
      status: 'success',
      data: {
        leads: pageRows.map((r) => ({
          contactId: r.id,
          phone: r.phone,
          pushName: r.pushName,
          source: r.source,
          status: r.status,
          draft: r.draft,
          filled: filledCount(r.draft),
          // The one thing that blocks promotion, surfaced per row so the seller
          // can see WHY a button is disabled without clicking it.
          canPromote: !r.leadId && hasRealPhone(r.draft, r.phone, r.jid),
          leadId: r.leadId,
          lead: r.leadId ? leadById.get(r.leadId) || null : null,
          confirmedAt: r.confirmedAt,
          lastMessageAt: r.lastMessageAt,
          createdAt: r.createdAt,
        })),
        fields: DRAFT_FIELDS,
        pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
      },
    });
  })
);

/**
 * Promotes several conversations at once.
 *
 * Each is committed independently: one contact missing a phone number must not
 * roll back the twenty that were fine. The per-row reason comes back so the
 * seller can fix exactly those.
 */
router.post(
  '/leads/promote',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const ids = Array.isArray(req.body?.contactIds) ? req.body.contactIds.map(Number).filter(Boolean) : [];
    if (!ids.length) throw new AppException(400, 'Aucune conversation sélectionnée.');
    if (ids.length > 100) throw new AppException(400, 'Maximum 100 conversations à la fois.');

    const owned = await prisma.whatsappContact.findMany({
      where: { id: { in: ids }, userId: req.user.id },
      select: { id: true },
    });

    const results: { contactId: number; ok: boolean; leadId?: number; error?: string }[] = [];

    for (const { id } of owned) {
      try {
        const lead = await promoteContactToLead(id);
        results.push({ contactId: id, ok: true, leadId: lead.id });
      } catch (err) {
        results.push({ contactId: id, ok: false, error: (err as Error).message });
      }
    }

    res.json({
      status: 'success',
      data: {
        created: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      },
    });
  })
);

/**
 * CSV of everything collected, honouring the current filters.
 *
 * UTF-8 WITH A BOM, deliberately: without it Excel opens Arabic and accented
 * French names as mojibake, which is the whole point of the export for a
 * Moroccan seller handing a list to a courier.
 */
router.get(
  '/leads/export',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const status = String(req.query.status || 'all');
    const promoted = String(req.query.promoted || 'all');

    const where: Record<string, unknown> = { userId: req.user.id };
    if (status !== 'all') where.status = status;
    if (promoted === 'yes') where.leadId = { not: null };
    if (promoted === 'no') where.leadId = null;

    const rows = (
      await prisma.whatsappContact.findMany({
        where,
        orderBy: [{ confirmedAt: 'desc' }, { id: 'desc' }],
        select: {
          phone: true,
          pushName: true,
          source: true,
          status: true,
          draft: true,
          leadId: true,
          confirmedAt: true,
          createdAt: true,
        },
      })
    ).filter((r) => filledCount(r.draft) > 0);

    const header = [
      'nom',
      'telephone',
      'ville',
      'adresse',
      'produit',
      'variante',
      'quantite',
      'prix',
      'notes',
      'statut',
      'source',
      'lead_id',
      'confirme_le',
      'cree_le',
    ];

    // Quote everything and double inner quotes: a Moroccan address routinely
    // contains commas, and an unquoted one silently shifts every later column.
    const cell = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          draftValue(r.draft, 'full_name') || r.pushName || '',
          draftValue(r.draft, 'phone') || r.phone || '',
          draftValue(r.draft, 'city'),
          draftValue(r.draft, 'address'),
          draftValue(r.draft, 'product'),
          draftValue(r.draft, 'variant'),
          draftValue(r.draft, 'quantity'),
          draftValue(r.draft, 'price'),
          draftValue(r.draft, 'notes'),
          r.status,
          r.source,
          r.leadId ?? '',
          r.confirmedAt ? r.confirmedAt.toISOString() : '',
          r.createdAt.toISOString(),
        ]
          .map(cell)
          .join(',')
      );
    }

    const csv = '\uFEFF' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="whatsapp-leads-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  })
);

export default router;
