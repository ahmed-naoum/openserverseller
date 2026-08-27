/**
 * SUPER_ADMIN control plane for the WhatsApp AI agent.
 *
 * Two halves:
 *
 *   The CATALOGUE — which models and voices exist, which are enabled, which is
 *   the default for each role, and what each model costs. An account can only
 *   ever pick from what is enabled here. Model CREDENTIALS are not in this file
 *   at all: they live in AppSecret behind the existing Variables & Secrets
 *   screen, encrypted at rest, so a compromised admin session on this router
 *   cannot read a key.
 *
 *   The ACCOUNTS page — every vendor and influencer, with the agent
 *   entitlement, the AI credit balance, and the live WhatsApp session state on
 *   one row. This is the screen an admin uses to sell and support the feature.
 *
 * The whole router is behind authorize('SUPER_ADMIN'). FINANCE_ADMIN and
 * SYSTEM_SUPPORT are deliberately excluded: enabling the agent commits the
 * platform to model spend on that account's behalf.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler, AppException } from '../../middleware/errorHandler.js';
import { ensureCatalogue } from '../../wa/catalogue.js';
import { grantCredits, debitCredits } from '../../services/waCredits.service.js';
import { amountToCents, replyPriceCents, centsToReplies } from '../../lib/waPricing.js';
import { nudgeWorker } from '../../lib/waWorkerClient.js';
import { testModel, testDir } from '../../wa/modelTest.js';
import { flushWaLogs } from '../../services/waLogs.service.js';

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

/**
 * The roles this catalogue EXPOSES — deliberately not every value the column can
 * hold.
 *
 * VISION is absent. `WhatsappAgent.visionModelId` still exists, and so does the
 * role in the ModelRole type, but nothing in the turn pipeline ever read it:
 * customer photos are attached inline to the BRAIN request (see
 * wa/turnRunner.ts loadHistory), gated by the account's `readImages` and the
 * brain row's `supportsVision` flag. A role selector that can only ever produce
 * a model nobody calls is worse than no selector, so it is not offered here and
 * a body naming it is refused.
 */
const MODEL_ROLES = ['BRAIN', 'STT', 'TTS'];

/* ------------------------------------------------------------------ */
/* model catalogue                                                     */
/* ------------------------------------------------------------------ */

router.get(
  '/models',
  asyncHandler(async (_req, res) => {
    await ensureCatalogue();
    const models = await prisma.aiModel.findMany({
      orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ status: 'success', data: { models, roles: MODEL_ROLES } });
  })
);

/**
 * The capability flags are the important part of this payload, not decoration.
 * Each one guards a request parameter that is a 400 on a model that does not
 * accept it, so an admin adding a model has to say what it supports.
 */
function readModelBody(body: any, current?: { adminOnly: boolean } | null) {
  const provider = String(body?.provider || '').trim().toLowerCase();
  const modelId = String(body?.modelId || '').trim();
  const role = String(body?.role || '').trim().toUpperCase();
  const label = String(body?.label || '').trim();

  if (!provider) throw new AppException(400, 'Fournisseur requis.');
  if (!modelId) throw new AppException(400, 'Identifiant du modèle requis.');
  if (!MODEL_ROLES.includes(role)) throw new AppException(400, 'Rôle invalide.');

  const int = (v: unknown, fallback = 0) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return {
    provider,
    modelId,
    role,
    label: label || modelId,
    isEnabled: body?.isEnabled !== false,
    supportsEffort: !!body?.supportsEffort,
    supportsVision: !!body?.supportsVision,
    supportsThinking: !!body?.supportsThinking,
    supportsMidSystem: !!body?.supportsMidSystem,
    supportsFallbacks: !!body?.supportsFallbacks,
    // `adminOnly` is a safety flag, not a preference: the CLI models carry it
    // because one Claude subscription cannot serve several tenants. An UPDATE
    // that omits it must mean « unchanged » — the admin screen round-trips the
    // whole row to flip a single toggle, and coercing a missing field to false
    // there would quietly hand a subscription-backed model to every account.
    adminOnly: body?.adminOnly === undefined ? !!current?.adminOnly : !!body.adminOnly,
    inputCostPerMTokCents: int(body?.inputCostPerMTokCents),
    outputCostPerMTokCents: int(body?.outputCostPerMTokCents),
    maxOutputTokens: int(body?.maxOutputTokens, 4096) || 4096,
    notes: body?.notes ? String(body.notes).slice(0, 1000) : null,
    sortOrder: int(body?.sortOrder),
  };
}

router.post(
  '/models',
  asyncHandler(async (req, res) => {
    const data = readModelBody(req.body);

    const clash = await prisma.aiModel.findUnique({
      where: { provider_modelId_role: { provider: data.provider, modelId: data.modelId, role: data.role } },
      select: { id: true },
    });
    if (clash) throw new AppException(409, 'Ce modèle existe déjà pour ce rôle.');

    const model = await prisma.aiModel.create({ data });
    res.status(201).json({ status: 'success', data: model });
  })
);

router.put(
  '/models/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.aiModel.findUnique({
      where: { id },
      select: { id: true, adminOnly: true, isDefault: true },
    });
    if (!existing) throw new AppException(404, 'Modèle introuvable.');

    const data = readModelBody(req.body, existing);

    // Making a model admin-only while it is the role default would leave the
    // phantom default POST /models/:id/default refuses to create: the badge
    // would read « Défaut » while resolveModel() skipped the row for every
    // account. Dropping the flag sends the role back to its first enabled
    // model, which is what those accounts already resolve to.
    if (data.adminOnly && existing.isDefault) Object.assign(data, { isDefault: false });

    const model = await prisma.aiModel.update({ where: { id }, data });
    res.json({ status: 'success', data: model });
  })
);

/**
 * Reorders a whole role in one shot.
 *
 * WHY A DEDICATED ROUTE AND NOT N × PUT. `sortOrder` is not decoration: when an
 * account has no explicit model, resolveModel() falls back to the enabled,
 * non-adminOnly row that sorts FIRST. So this list is a preference order, and
 * two rows briefly sharing a rank — which is what a sequence of independent
 * PUTs produces — means the fallback is decided by the id tiebreak in the gap.
 * One transaction renumbers the role atomically instead.
 *
 * The payload is the ids IN THE ORDER WANTED, not a set of numbers. The client
 * never has to compute ranks, and gaps left by deleted rows are closed on every
 * save rather than accumulating.
 */
router.post(
  '/models/reorder',
  asyncHandler(async (req, res) => {
    const role = String(req.body?.role || '').trim().toUpperCase();
    if (!MODEL_ROLES.includes(role)) throw new AppException(400, 'Rôle invalide.');

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    if (!ids.length) throw new AppException(400, 'Aucun modèle à ordonner.');

    // Every id must belong to THIS role. Without the check, a reordered list
    // carrying an id from another role would renumber a model the admin cannot
    // see on screen — and silently move another role's fallback.
    const owned = await prisma.aiModel.findMany({
      where: { id: { in: ids }, role },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new AppException(400, 'La liste contient un modèle qui n’appartient pas à ce rôle.');
    }

    // Ranks start at 10 and step by 10, so a model inserted by hand later can
    // be slotted between two rows without renumbering everything.
    await prisma.$transaction(
      ids.map((id, index) => prisma.aiModel.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } }))
    );

    const models = await prisma.aiModel.findMany({
      where: { role },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    res.json({ status: 'success', data: { models } });
  })
);

/**
 * Exactly one default per role.
 *
 * Done in a transaction because the clear and the set are one decision: a crash
 * between them would leave a role with no default at all, and resolveModel()
 * would silently fall through to whatever sorts first.
 */
router.post(
  '/models/:id/default',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const model = await prisma.aiModel.findUnique({ where: { id } });
    if (!model) throw new AppException(404, 'Modèle introuvable.');
    if (!model.isEnabled) throw new AppException(400, 'Activez le modèle avant d’en faire le défaut.');

    // The role default is what ORDINARY accounts fall back to, and resolveModel
    // deliberately skips adminOnly models when choosing one. Allowing this
    // would let an admin set a default that silently does nothing — the badge
    // would say "Défaut" while every account kept resolving to something else.
    if (model.adminOnly) {
      throw new AppException(
        400,
        'Un modèle « admin uniquement » ne peut pas être le défaut : les comptes ne peuvent pas le résoudre. ' +
          'Assignez-le compte par compte depuis la page Comptes agent.'
      );
    }

    await prisma.$transaction([
      prisma.aiModel.updateMany({ where: { role: model.role }, data: { isDefault: false } }),
      prisma.aiModel.update({ where: { id }, data: { isDefault: true } }),
    ]);

    res.json({ status: 'success', data: { id, role: model.role } });
  })
);

/**
 * Runs ONE real request through a catalogue row and reports what came back.
 *
 * WHY THIS EXISTS. Every way a model dies in production — a rotated key, a
 * retired model id, a preview tier that 429s all afternoon, a capability flag
 * set on a model that rejects the parameter it guards — looks exactly the same
 * from this screen: an enabled row that does nothing. The first person to learn
 * otherwise is a customer who got no reply. So the button sends the same kind
 * of request the agent sends, down the same code path, with the fallback chain
 * DISABLED so a rescued failure cannot report as health.
 *
 * IT SPENDS MONEY — one vendor call, billed at the row's own price — and it
 * writes the ordinary BRAIN/STT/TTS rows to the activity log, tagged to the
 * admin who pressed it. That is deliberate: the Journal is the audit trail for
 * what this button costs.
 *
 * A model that fails is a 200 carrying `ok: false`, not an error status. The
 * failure IS the answer, and it has to arrive with the transcript, the attempts
 * and the vendor's own message attached — all of which a 4xx would throw away.
 */
router.post(
  '/models/:id/test',
  asyncHandler(async (req: any, res) => {
    const id = Number(req.params.id);
    const model = await prisma.aiModel.findUnique({ where: { id } });
    if (!model) throw new AppException(404, 'Modèle introuvable.');

    // Disabled rows are testable on purpose: "does it work yet?" is the
    // question an admin asks BEFORE enabling one.
    const result = await testModel(model, req.user.id);

    // The log rows this test just produced are batched. Flushing here means the
    // Journal already has them by the time the admin clicks through from the
    // result they are reading.
    await flushWaLogs().catch(() => undefined);

    res.json({ status: 'success', data: result });
  })
);

/**
 * Plays back the voice note a TTS test produced.
 *
 * basename() strips any traversal: the name comes from a URL and must never be
 * able to walk out of the platform's test folder. The folder holds one file per
 * TTS model — synthesize() overwrites by basename — so it cannot grow.
 */
router.get(
  '/models/test-audio/:file',
  asyncHandler(async (req, res) => {
    const file = path.basename(String(req.params.file));
    const full = path.join(testDir(), file);
    if (!fs.existsSync(full)) throw new AppException(404, 'Audio de test introuvable.');
    res.sendFile(full);
  })
);

router.delete(
  '/models/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);

    // Accounts pointing at it are detached rather than blocked from deleting:
    // the foreign keys are onDelete: SetNull, and resolveModel() falls back to
    // the role default, so those accounts keep working on the next turn.
    const inUse = await prisma.whatsappAgent.count({
      where: { OR: [{ brainModelId: id }, { sttModelId: id }, { ttsModelId: id }, { visionModelId: id }] },
    });

    await prisma.aiModel.delete({ where: { id } });
    res.json({ status: 'success', data: { id, detachedAccounts: inUse } });
  })
);

/* ------------------------------------------------------------------ */
/* voice catalogue                                                     */
/* ------------------------------------------------------------------ */

router.get(
  '/voices',
  asyncHandler(async (_req, res) => {
    await ensureCatalogue();
    const voices = await prisma.aiVoice.findMany({
      orderBy: [{ provider: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ status: 'success', data: voices });
  })
);

router.put(
  '/voices/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.aiVoice.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new AppException(404, 'Voix introuvable.');

    const b = req.body || {};
    const voice = await prisma.aiVoice.update({
      where: { id },
      data: {
        label: b.label ? String(b.label).slice(0, 120) : undefined,
        locale: b.locale !== undefined ? (b.locale ? String(b.locale).slice(0, 20) : null) : undefined,
        gender: b.gender !== undefined ? (b.gender ? String(b.gender).slice(0, 20) : null) : undefined,
        isEnabled: typeof b.isEnabled === 'boolean' ? b.isEnabled : undefined,
        supportsProsody: typeof b.supportsProsody === 'boolean' ? b.supportsProsody : undefined,
        supportsStyle: typeof b.supportsStyle === 'boolean' ? b.supportsStyle : undefined,
        styles: Array.isArray(b.styles) ? b.styles.map((s: any) => String(s).slice(0, 40)).slice(0, 30) : undefined,
        sortOrder: b.sortOrder !== undefined ? Math.trunc(Number(b.sortOrder)) || 0 : undefined,
      },
    });

    res.json({ status: 'success', data: voice });
  })
);

router.post(
  '/voices',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const provider = String(b.provider || '').trim().toLowerCase();
    const voiceId = String(b.voiceId || '').trim();
    if (!provider || !voiceId) throw new AppException(400, 'Fournisseur et identifiant de voix requis.');

    const clash = await prisma.aiVoice.findUnique({
      where: { provider_voiceId: { provider, voiceId } },
      select: { id: true },
    });
    if (clash) throw new AppException(409, 'Cette voix existe déjà.');

    const voice = await prisma.aiVoice.create({
      data: {
        provider,
        voiceId,
        label: String(b.label || voiceId).slice(0, 120),
        locale: b.locale ? String(b.locale).slice(0, 20) : null,
        gender: b.gender ? String(b.gender).slice(0, 20) : null,
        isEnabled: b.isEnabled !== false,
        supportsProsody: !!b.supportsProsody,
        supportsStyle: !!b.supportsStyle,
        styles: Array.isArray(b.styles) ? b.styles.map((s: any) => String(s).slice(0, 40)).slice(0, 30) : [],
        sortOrder: Math.trunc(Number(b.sortOrder)) || 0,
      },
    });

    res.status(201).json({ status: 'success', data: voice });
  })
);

/* ------------------------------------------------------------------ */
/* the accounts page — vendors and influencers                        */
/* ------------------------------------------------------------------ */

/**
 * One row per sellable account, with everything an admin needs to decide
 * whether to enable the agent, top up credits, or go and look at why a session
 * is down.
 *
 * Assembled from four tables in fixed round trips rather than a per-row include
 * so the page cost does not grow with the number of accounts.
 */
router.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const roleFilter = String(req.query.role || 'all');
    const statusFilter = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim();

    const roleNames = roleFilter === 'all' ? ['VENDOR', 'INFLUENCER'] : [roleFilter];

    const where: Record<string, unknown> = {
      role: { name: { in: roleNames } },
      deletedAt: null,
    };

    if (statusFilter === 'enabled') where.whatsappAgentEnabled = true;
    if (statusFilter === 'disabled') where.whatsappAgentEnabled = false;

    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { profile: { fullName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          uuid: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          role: { select: { name: true } },
          profile: { select: { fullName: true } },
          whatsappAgentEnabled: true,
          whatsappAgentGateFrom: true,
        },
        orderBy: [{ whatsappAgentEnabled: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * take,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);

    const [agents, sessions, accounts, contactCounts] = await Promise.all([
      prisma.whatsappAgent.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, enabled: true, autoCreateLead: true, brainModel: { select: { label: true } } },
      }),
      prisma.whatsappSession.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, status: true, desiredState: true, phoneNumber: true, lastError: true },
      }),
      prisma.waCreditAccount.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, balance: true, totalGranted: true, totalConsumed: true },
      }),
      prisma.whatsappContact.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const agentBy = new Map(agents.map((a) => [a.userId, a]));
    const sessionBy = new Map(sessions.map((s) => [s.userId, s]));
    const creditBy = new Map(accounts.map((a) => [a.userId, a]));
    const contactBy = new Map(contactCounts.map((c) => [c.userId, c._count._all]));

    const price = replyPriceCents();

    res.json({
      status: 'success',
      data: {
        accounts: users.map((u) => {
          const credit = creditBy.get(u.id);
          return {
            id: u.id,
            uuid: u.uuid,
            email: u.email,
            phone: u.phone,
            isActive: u.isActive,
            createdAt: u.createdAt,
            role: u.role?.name,
            name: u.profile?.fullName || u.email,
            entitlement: {
              enabled: u.whatsappAgentEnabled,
              since: u.whatsappAgentGateFrom,
            },
            agent: agentBy.get(u.id)
              ? {
                  enabled: agentBy.get(u.id)!.enabled,
                  autoCreateLead: agentBy.get(u.id)!.autoCreateLead,
                  brain: agentBy.get(u.id)!.brainModel?.label || null,
                }
              : null,
            session: sessionBy.get(u.id) || null,
            credits: {
              balance: credit?.balance ?? 0,
              affordable: centsToReplies(credit?.balance ?? 0),
              totalGranted: credit?.totalGranted ?? 0,
              totalConsumed: credit?.totalConsumed ?? 0,
            },
            conversations: contactBy.get(u.id) ?? 0,
          };
        }),
        priceCents: price,
        pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
      },
    });
  })
);

/**
 * Turns the entitlement on or off for one account.
 *
 * `whatsappAgentGateFrom` is stamped ONLY on the null->set transition, the same
 * rule as googleSheetsGateFrom: switching off and back on must not move the
 * line, because the line is what "billed from" means and moving it forward
 * would silently re-bill a period the account already paid for.
 *
 * Turning it OFF also stops the WhatsApp session. Without that, a revoked
 * account keeps answering its customers indefinitely — the entitlement is read
 * by the routes, but the worker holds a live socket that no longer consults it.
 */
router.patch(
  '/accounts/:uuid/entitlement',
  asyncHandler(async (req: any, res) => {
    const { uuid } = req.params;
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') throw new AppException(400, 'enabled doit être un booléen.');

    const user = await prisma.user.findUnique({
      where: { uuid },
      select: {
        id: true,
        whatsappAgentEnabled: true,
        whatsappAgentGateFrom: true,
        role: { select: { name: true } },
      },
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');
    if (!['VENDOR', 'INFLUENCER'].includes(user.role?.name || '')) {
      throw new AppException(400, "L'agent WhatsApp ne concerne que les vendeurs et les influenceurs.");
    }

    const startsGateNow = enabled && !user.whatsappAgentEnabled && !user.whatsappAgentGateFrom;

    const updated = await prisma.user.update({
      where: { uuid },
      data: {
        whatsappAgentEnabled: enabled,
        whatsappAgentGateFrom: startsGateNow ? new Date() : undefined,
      },
      select: { id: true, whatsappAgentEnabled: true, whatsappAgentGateFrom: true },
    });

    if (!enabled) {
      await prisma.whatsappSession.updateMany({
        where: { userId: user.id },
        data: { desiredState: 'OFF' },
      });
      await nudgeWorker('disconnect', user.id);
    }

    res.json({ status: 'success', data: updated });
  })
);

/**
 * Grants or takes back AI credits.
 *
 * `amount` is in the display currency (dollars), converted to integer cents by
 * amountToCents so an admin typing 9.99 cannot lose a cent to floating point.
 */
router.post(
  '/accounts/:uuid/credits',
  asyncHandler(async (req: any, res) => {
    const { uuid } = req.params;
    const user = await prisma.user.findUnique({ where: { uuid }, select: { id: true } });
    if (!user) throw new AppException(404, 'Compte introuvable.');

    const cents = amountToCents(req.body?.amount);
    if (cents <= 0) throw new AppException(400, 'Le montant doit être supérieur à zéro.');

    const description = req.body?.description ? String(req.body.description).slice(0, 500) : null;
    const direction = String(req.body?.direction || 'GRANT').toUpperCase();

    try {
      const result =
        direction === 'DEBIT'
          ? await debitCredits(user.id, cents, description, req.user.id)
          : await grantCredits(user.id, cents, description, req.user.id);

      res.json({ status: 'success', data: { balance: result.balance, affordable: centsToReplies(result.balance) } });
    } catch (err: any) {
      throw new AppException(400, err.message);
    }
  })
);

/**
 * Assigns a brain to one account, INCLUDING an adminOnly model.
 *
 * This is the only door those models come through. The account-facing config
 * route refuses them, so a platform-owned number gets the free CLI engine by an
 * admin putting it there deliberately, and a paying tenant cannot wander into
 * it. Turning the CLI off again is the same call with an ordinary model id.
 */
router.patch(
  '/accounts/:uuid/agent',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.params.uuid },
      select: { id: true },
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');

    const agent = await prisma.whatsappAgent.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!agent) throw new AppException(400, "Ce compte n'a pas encore ouvert son agent.");

    const data: Record<string, unknown> = {};

    if ('brainModelId' in (req.body || {})) {
      const raw = req.body.brainModelId;
      if (raw === null || raw === '') {
        data.brainModelId = null;
      } else {
        const model = await prisma.aiModel.findFirst({
          where: { id: Number(raw), role: 'BRAIN', isEnabled: true },
        });
        if (!model) throw new AppException(400, 'Modèle de cerveau indisponible.');
        data.brainModelId = model.id;
      }
    }

    if (typeof req.body?.enabled === 'boolean') data.enabled = req.body.enabled;

    // The speech engines. Validated against the catalogue for the right role,
    // so an admin cannot point STT at a TTS model.
    for (const [field, role] of [
      ['sttModelId', 'STT'],
      ['ttsModelId', 'TTS'],
    ] as const) {
      if (!(field in (req.body || {}))) continue;
      const raw = req.body[field];
      if (raw === null || raw === '') {
        data[field] = null;
        continue;
      }
      const model = await prisma.aiModel.findFirst({ where: { id: Number(raw), role, isEnabled: true } });
      if (!model) throw new AppException(400, `Modèle ${role} indisponible.`);
      data[field] = model.id;
    }

    /**
     * The transcription fallback chain, validated the same way the seller's
     * ttsChain is: every link must name a model the catalogue has enabled.
     *
     * A rejected link is an ERROR rather than a silent drop — an admin who
     * thinks an account has three engines behind it and actually has one will
     * only find out on the day the first one is rate-limited.
     */
    if ('sttChain' in (req.body || {})) {
      const raw = Array.isArray(req.body.sttChain) ? req.body.sttChain : [];
      const enabled = await prisma.aiModel.findMany({
        where: { role: 'STT', isEnabled: true },
        select: { provider: true, modelId: true },
      });
      const allowed = new Set(enabled.map((m) => `${m.provider}:${m.modelId}`));

      // 16 et non 8, contrairement à ttsChain : le quota gratuit de Gemini est
      // de 20 requêtes par jour ET PAR MODÈLE, donc la seule façon d'avoir de
      // la capacité sans payer est d'aligner un maillon par modèle. Une chaîne
      // tronquée en silence à 8 ferait disparaître des replis que l'écran
      // affiche encore.
      const chain = raw
        .map((entry: unknown) => String(entry).trim())
        .filter((entry: string) => allowed.has(entry))
        .slice(0, 16);

      if (chain.length !== raw.length) {
        throw new AppException(400, "La chaîne de repli contient un moteur de transcription qui n'est pas activé.");
      }
      data.sttChain = chain;
    }

    if ('sttRetries' in (req.body || {})) {
      const n = Math.trunc(Number(req.body.sttRetries));
      data.sttRetries = Number.isFinite(n) ? Math.min(3, Math.max(0, n)) : 0;
    }

    // Platform tuning. Clamped rather than rejected — these are sliders, and
    // the nearest legal value is what an admin dragging one actually wants.
    const clamp = (v: unknown, min: number, max: number) =>
      Math.min(max, Math.max(min, Math.trunc(Number(v) || 0)));

    if ('historyMessages' in (req.body || {})) data.historyMessages = clamp(req.body.historyMessages, 4, 100);
    if ('typingDelayMs' in (req.body || {})) data.typingDelayMs = clamp(req.body.typingDelayMs, 0, 10_000);
    if ('replyDelayMs' in (req.body || {})) data.replyDelayMs = clamp(req.body.replyDelayMs, 0, 10_000);

    if ('handoffKeywords' in (req.body || {})) {
      const raw = String(req.body.handoffKeywords || '').slice(0, 2000);
      // Emptying this removes the customer's only way to reach a human. An
      // admin may narrow it; they may not delete it.
      if (!raw.split(',').some((k) => k.trim())) {
        throw new AppException(400, 'Les mots-clés de passage à un humain ne peuvent pas être vides.');
      }
      data.handoffKeywords = raw;
    }

    if (!Object.keys(data).length) throw new AppException(400, 'Rien à modifier.');

    const updated = await prisma.whatsappAgent.update({
      where: { userId: user.id },
      data,
      include: { brainModel: true, sttModel: true, ttsModel: true },
    });

    res.json({ status: 'success', data: updated });
  })
);

router.get(
  '/accounts/:uuid',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { uuid: req.params.uuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        whatsappAgentEnabled: true,
        whatsappAgentGateFrom: true,
        role: { select: { name: true } },
        profile: { select: { fullName: true } },
      },
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');

    const [agent, session, credits, usage, transactions] = await Promise.all([
      prisma.whatsappAgent.findUnique({
        where: { userId: user.id },
        include: { brainModel: true, sttModel: true, ttsModel: true, activeVoice: true },
      }),
      prisma.whatsappSession.findUnique({ where: { userId: user.id } }),
      prisma.waCreditAccount.findUnique({ where: { userId: user.id } }),
      prisma.whatsappAgentUsage.findMany({
        where: { userId: user.id },
        orderBy: { day: 'desc' },
        take: 30,
      }),
      prisma.waCreditAccount
        .findUnique({ where: { userId: user.id }, select: { id: true } })
        .then((a) =>
          a
            ? prisma.waCreditTransaction.findMany({
                where: { accountId: a.id },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: 50,
              })
            : []
        ),
    ]);

    res.json({
      status: 'success',
      data: { user, agent, session, credits, usage, transactions, priceCents: replyPriceCents() },
    });
  })
);

/* ------------------------------------------------------------------ */

/** Platform-wide numbers for the top of the admin screen. */
router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const day = since.toISOString().slice(0, 10);

    const [entitled, connected, conversations, usage, models] = await Promise.all([
      prisma.user.count({ where: { whatsappAgentEnabled: true, deletedAt: null } }),
      prisma.whatsappSession.count({ where: { status: 'CONNECTED' } }),
      prisma.whatsappContact.count(),
      prisma.whatsappAgentUsage.aggregate({
        where: { day: { gte: day } },
        _sum: { turns: true, inputTokens: true, outputTokens: true, costCents: true },
      }),
      prisma.aiModel.count({ where: { isEnabled: true } }),
    ]);

    res.json({
      status: 'success',
      data: {
        entitledAccounts: entitled,
        connectedSessions: connected,
        conversations,
        last30Days: {
          turns: usage._sum.turns ?? 0,
          inputTokens: usage._sum.inputTokens ?? 0,
          outputTokens: usage._sum.outputTokens ?? 0,
          // What the platform actually paid the model provider, against what it
          // billed accounts at the flat tariff. When these drift apart, the
          // tariff needs moving.
          modelCostCents: usage._sum.costCents ?? 0,
        },
        enabledModels: models,
        priceCents: replyPriceCents(),
      },
    });
  })
);

export default router;
