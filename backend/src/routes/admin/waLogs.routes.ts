/**
 * SUPER_ADMIN — the WhatsApp agent activity log, read side.
 *
 * One screen answers the questions the other agent pages cannot: what did the
 * model actually receive, what did it answer, what did WhatsApp do with it, and
 * where did it break. The rows are written by services/waLogs.service from both
 * processes; nothing here writes.
 *
 * SUPER_ADMIN ONLY, like the rest of admin/ai.routes.ts, and for a stronger
 * reason: these rows carry customer message bodies and voice transcripts. That
 * is the same material as the seller's inbox, so it gets the same door.
 *
 * PAGINATION IS BY CURSOR, not by page number, and that is not a style choice.
 * The table is append-only and busy; between "page 1" and "page 2" a chatty
 * account can push ten new rows in, and offset paging would then show the
 * reader the same rows twice while hiding others entirely.
 */

import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler, AppException } from '../../middleware/errorHandler.js';
import {
  WA_LOG_CATEGORIES,
  WA_LOG_LEVELS,
  pruneWaLogs,
  type WaLogCategory,
  type WaLogLevel,
} from '../../services/waLogs.service.js';

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Builds the where-clause shared by the list, the export and the purge.
 *
 * Every filter is optional and they intersect. `userId` is resolved from a uuid
 * by the caller, never taken from the query as a raw id: the admin screens
 * address accounts by uuid everywhere else.
 */
function buildWhere(query: any, userId: number | null): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (userId) where.userId = userId;

  const level = String(query.level || 'all');
  if (level === 'problems') {
    // The default view of someone who opened this page because something is
    // wrong: warnings and errors, nothing else.
    where.level = { in: ['WARN', 'ERROR'] };
  } else if (WA_LOG_LEVELS.includes(level as WaLogLevel)) {
    where.level = level;
  }

  const category = String(query.category || 'all');
  if (WA_LOG_CATEGORIES.includes(category as WaLogCategory)) where.category = category;

  const event = String(query.event || '').trim();
  if (event) where.event = event;

  const source = String(query.source || 'all');
  if (source === 'worker' || source === 'api') where.source = source;

  const contactId = Number(query.contactId);
  if (Number.isInteger(contactId) && contactId > 0) where.contactId = contactId;

  const turnId = Number(query.turnId);
  if (Number.isInteger(turnId) && turnId > 0) where.turnId = turnId;

  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;
  const range: Record<string, Date> = {};
  if (from && !Number.isNaN(from.getTime())) range.gte = from;
  if (to && !Number.isNaN(to.getTime())) range.lte = to;
  if (Object.keys(range).length) where.createdAt = range;

  const q = String(query.q || '').trim();
  if (q) {
    // Deliberately NOT searching the JSON payloads. A `contains` over two Json
    // columns on a table this size is a sequential scan per keystroke; the
    // columns that identify a row — the message, the event, the phone — are
    // indexed text and answer the question people actually type.
    where.OR = [
      { message: { contains: q, mode: 'insensitive' } },
      { event: { contains: q, mode: 'insensitive' } },
      { errorText: { contains: q, mode: 'insensitive' } },
      { contactJid: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
      { messageWaId: { contains: q } },
    ];
  }

  return where;
}

/** Resolves ?account=<uuid> to an id, or throws if it names nobody. */
async function resolveAccount(query: any): Promise<number | null> {
  const uuid = String(query.account || '').trim();
  if (!uuid || uuid === 'all') return null;

  const user = await prisma.user.findUnique({ where: { uuid }, select: { id: true } });
  if (!user) throw new AppException(404, 'Compte introuvable.');
  return user.id;
}

/**
 * Attaches account identities to a page of rows.
 *
 * One query for the whole page rather than a Prisma `include`: a page is fifty
 * rows and usually three or four distinct accounts, so the join would fetch the
 * same seller fifty times.
 */
async function withAccounts<T extends { userId: number | null }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.userId).filter((id): id is number => !!id))];
  if (!ids.length) return rows.map((r) => ({ ...r, account: null }));

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, uuid: true, email: true, profile: { select: { fullName: true } } },
  });
  const byId = new Map(
    users.map((u) => [u.id, { id: u.id, uuid: u.uuid, email: u.email, name: u.profile?.fullName || u.email }])
  );

  return rows.map((r) => ({ ...r, account: (r.userId && byId.get(r.userId)) || null }));
}

/* ------------------------------------------------------------------ */
/* the list                                                            */
/* ------------------------------------------------------------------ */

/**
 * One page of the timeline, newest first.
 *
 * `before` walks backwards into the past. `after` is the live tail: give it the
 * newest id you already hold and it returns only what has happened since, which
 * is what makes the auto-refresh cheap enough to leave running.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
    const userId = await resolveAccount(req.query);
    const where = buildWhere(req.query, userId);

    const before = Number(req.query.before);
    const after = Number(req.query.after);
    const tailing = Number.isInteger(after) && after > 0;

    if (Number.isInteger(before) && before > 0) where.id = { lt: before };
    if (tailing) where.id = { gt: after };

    const rows = await prisma.whatsappAgentLog.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      // The payloads are excluded from the LIST on purpose: fifty rows of model
      // request and response is megabytes over the wire for a screen that shows
      // one line each. GET /:id fetches the bodies of the row someone opened.
      select: {
        id: true,
        level: true,
        category: true,
        event: true,
        message: true,
        userId: true,
        contactId: true,
        contactJid: true,
        contactName: true,
        turnId: true,
        messageWaId: true,
        errorText: true,
        durationMs: true,
        inputTokens: true,
        outputTokens: true,
        costCents: true,
        source: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      status: 'success',
      data: {
        logs: await withAccounts(page),
        // Only meaningful walking backwards; a tail request has no "older".
        nextCursor: hasMore && !tailing ? page[page.length - 1].id : null,
        newestId: page.length ? page[0].id : null,
        levels: WA_LOG_LEVELS,
        categories: WA_LOG_CATEGORIES,
      },
    });
  })
);

/**
 * Everything about one row, payloads included.
 *
 * Also returns its immediate neighbours on the same conversation, because a
 * model answer is rarely explicable on its own — the customer message before it
 * and the send after it are what make it readable.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppException(400, 'Identifiant invalide.');

    const log = await prisma.whatsappAgentLog.findUnique({ where: { id } });
    if (!log) throw new AppException(404, 'Ligne de journal introuvable.');

    const [enriched] = await withAccounts([log]);

    const context = log.contactId
      ? await prisma.whatsappAgentLog.findMany({
          where: { contactId: log.contactId, id: { not: log.id } },
          orderBy: { id: 'desc' },
          take: 12,
          select: {
            id: true,
            level: true,
            category: true,
            event: true,
            message: true,
            createdAt: true,
          },
        })
      : [];

    const contact = log.contactId
      ? await prisma.whatsappContact.findUnique({
          where: { id: log.contactId },
          select: { id: true, jid: true, phone: true, pushName: true, status: true, source: true },
        })
      : null;

    res.json({ status: 'success', data: { log: enriched, contact, context } });
  })
);

/* ------------------------------------------------------------------ */
/* the header numbers                                                  */
/* ------------------------------------------------------------------ */

/**
 * What the last 24 hours looked like, for the top of the screen.
 *
 * Grouped counts rather than a scan: this is read on every page load and on
 * every auto-refresh tick.
 */
router.get(
  '/stats/overview',
  asyncHandler(async (req, res) => {
    const hours = Math.min(168, Math.max(1, Number(req.query.hours) || 24));
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const userId = await resolveAccount(req.query);

    const scope: Record<string, unknown> = { createdAt: { gte: since } };
    if (userId) scope.userId = userId;

    const [byLevel, byCategory, total, newest, worst, retention] = await Promise.all([
      prisma.whatsappAgentLog.groupBy({ by: ['level'], where: scope, _count: { _all: true } }),
      prisma.whatsappAgentLog.groupBy({ by: ['category'], where: scope, _count: { _all: true } }),
      prisma.whatsappAgentLog.count({ where: scope }),
      prisma.whatsappAgentLog.findFirst({
        where: userId ? { userId } : {},
        orderBy: { id: 'desc' },
        select: { createdAt: true },
      }),
      // Who is generating the errors. This is the list that says which seller
      // to call before they call support.
      prisma.whatsappAgentLog.groupBy({
        by: ['userId'],
        where: { ...scope, level: 'ERROR' },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 5,
      }),
      prisma.whatsappAgentLog.aggregate({ _min: { createdAt: true }, _count: { _all: true } }),
    ]);

    const accounts = await prisma.user.findMany({
      where: { id: { in: worst.map((w) => w.userId).filter((id): id is number => !!id) } },
      select: { id: true, uuid: true, email: true, profile: { select: { fullName: true } } },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));

    res.json({
      status: 'success',
      data: {
        hours,
        total,
        // Every level and every category is present with a zero rather than
        // absent: a filter chip that appears only once it has something to show
        // is a filter nobody discovers.
        byLevel: byLevel.reduce(
          (acc, row) => ({ ...acc, [row.level]: row._count._all }),
          Object.fromEntries(WA_LOG_LEVELS.map((l) => [l, 0])) as Record<string, number>
        ),
        byCategory: byCategory.reduce(
          (acc, row) => ({ ...acc, [row.category]: row._count._all }),
          Object.fromEntries(WA_LOG_CATEGORIES.map((c) => [c, 0])) as Record<string, number>
        ),
        lastEventAt: newest?.createdAt || null,
        topErrorAccounts: worst
          .filter((w) => w.userId)
          .map((w) => {
            const account = byId.get(w.userId!);
            return {
              userId: w.userId,
              uuid: account?.uuid || null,
              name: account?.profile?.fullName || account?.email || `#${w.userId}`,
              errors: w._count._all,
            };
          }),
        // So the screen can say "12 340 lignes depuis le 3 août" rather than
        // leaving the reader to guess how far back the log goes.
        storedRows: retention._count._all,
        oldestStoredAt: retention._min.createdAt,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* per-model reliability                                               */
/* ------------------------------------------------------------------ */

/**
 * Which engine, in each role, actually works.
 *
 * WHY THIS CANNOT BE READ OFF THE EXISTING COUNTS. The header numbers count
 * ERROR rows, and an ERROR row says a turn broke, not WHICH engine broke it.
 * With five transcription engines behind one fallback chain, « 12 erreurs STT »
 * is equally compatible with one dead engine and four healthy ones, or with all
 * five degrading at once — opposite problems with opposite fixes. The model
 * identity lives in `meta`, so the grouping has to reach into the JSON column,
 * which Prisma's groupBy cannot do; hence raw SQL.
 *
 * THREE OUTCOMES, NOT TWO. A pass/fail split would hide the most valuable state
 * this log records: the engine that failed and was rescued by the next link of
 * the chain. Nothing downstream notices — the customer got their reply — and it
 * stays invisible right up until the fallback is exhausted too. So:
 *
 *   ok        the engine answered, first time
 *   degraded  it answered, but only after a retry or a fallback (the WARN rows)
 *   failed    it did not answer at all
 *
 * WHAT `meta` MEANS DIFFERS BY ROLE, and the mapping below is written around
 * it. On STT, meta names the engine that was ASKED, so a WARN transcription is
 * a failure of the model named on the row and a success for one that is not
 * named at all. On TTS, meta names the engine that actually SPOKE. Merging the
 * two blindly would credit rescues to the wrong engine.
 */

/** The only events that say something about a model. Anything else is ignored. */
const MODEL_EVENTS = [
  'brain.answer',
  'brain.error',
  'stt.transcribed',
  'stt.failed',
  'tts.spoken',
  'tts.failed',
];

type Outcome = 'ok' | 'degraded' | 'failed';

/**
 * Reads one grouped row as an outcome.
 *
 * The level does the work on the success events: waLog writes INFO for a clean
 * pass and WARN when a fallback or a retry was involved, which is exactly the
 * ok/degraded line.
 */
function outcomeOf(event: string, level: string): Outcome {
  if (event.endsWith('.failed') || event.endsWith('.error')) return 'failed';
  return level === 'WARN' || level === 'ERROR' ? 'degraded' : 'ok';
}

/**
 * Bucket width for the timeline, from the window being asked about.
 *
 * Fixed widths rather than « always 24 points » so the x-axis means the same
 * thing whatever the period: a spike an hour wide has to look an hour wide.
 */
function bucketSeconds(hours: number): number {
  if (hours <= 2) return 300;
  if (hours <= 12) return 1800;
  if (hours <= 48) return 3600;
  if (hours <= 168) return 21_600;
  return 86_400;
}

interface GroupedRow {
  category: string;
  provider: string;
  modelId: string;
  event: string;
  level: string;
  rows: number;
  suppressed: number;
  totalMs: number;
  timed: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

const MODEL_ROLES = ['BRAIN', 'STT', 'TTS'] as const;

router.get(
  '/stats/models',
  asyncHandler(async (req, res) => {
    const hours = Math.min(720, Math.max(1, Number(req.query.hours) || 24));
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const userId = await resolveAccount(req.query);

    const rawSource = String(req.query.source || 'all');
    // Not cosmetic: production traffic runs in the worker, while the « Tester »
    // button on the models page runs in the API. Mixing them silently would let
    // a handful of deliberate probes move a production success rate.
    const source = rawSource === 'worker' || rawSource === 'api' ? rawSource : null;

    const grouped = await prisma.$queryRaw<GroupedRow[]>`
      SELECT
        "category",
        COALESCE(NULLIF("meta"->>'provider', ''), '?') AS "provider",
        COALESCE(NULLIF("meta"->>'modelId', ''), '?')  AS "modelId",
        "event",
        "level",
        COUNT(*)::int AS "rows",
        -- Identical faults inside a minute are collapsed by the logger and the
        -- count carried on the next row. Without adding it back, a model that
        -- fails on a two-second timer reports far FEWER failures than a model
        -- that fails once an hour.
        COALESCE(SUM(COALESCE(NULLIF("meta"->>'repeatedSinceLastRow', '')::int, 0)), 0)::int AS "suppressed",
        COALESCE(SUM("durationMs"), 0)::int AS "totalMs",
        COUNT("durationMs")::int AS "timed",
        COALESCE(SUM("inputTokens"), 0)::int AS "inputTokens",
        COALESCE(SUM("outputTokens"), 0)::int AS "outputTokens",
        COALESCE(SUM("costCents"), 0)::int AS "costCents"
      FROM whatsapp_agent_logs
      WHERE "createdAt" >= ${since}
        AND "event" = ANY(${MODEL_EVENTS}::text[])
        AND (${userId}::int IS NULL OR "userId" = ${userId}::int)
        AND (${source}::text IS NULL OR "source" = ${source}::text)
      GROUP BY 1, 2, 3, 4, 5
    `;

    /**
     * The most recent thing that went wrong, per engine.
     *
     * DISTINCT ON rather than a second pass in JS: the point is the ONE latest
     * message per model, and shipping every error row to compute it would send
     * the whole failure history over the wire for a tooltip.
     */
    const lastErrors = await prisma.$queryRaw<
      { category: string; provider: string; modelId: string; message: string; errorText: string | null; at: Date }[]
    >`
      SELECT DISTINCT ON ("category", "provider", "modelId")
        "category",
        COALESCE(NULLIF("meta"->>'provider', ''), '?') AS "provider",
        COALESCE(NULLIF("meta"->>'modelId', ''), '?')  AS "modelId",
        "message",
        "errorText",
        "createdAt" AS "at"
      FROM whatsapp_agent_logs
      WHERE "createdAt" >= ${since}
        AND "event" = ANY(${MODEL_EVENTS}::text[])
        AND "level" IN ('WARN', 'ERROR')
        AND (${userId}::int IS NULL OR "userId" = ${userId}::int)
        AND (${source}::text IS NULL OR "source" = ${source}::text)
      ORDER BY "category", "provider", "modelId", "createdAt" DESC
    `;

    const seconds = bucketSeconds(hours);
    const timeline = await prisma.$queryRaw<
      { at: Date; category: string; event: string; level: string; count: number }[]
    >`
      SELECT
        to_timestamp(floor(extract(epoch FROM "createdAt") / ${seconds}) * ${seconds}) AS "at",
        "category",
        "event",
        "level",
        COUNT(*)::int AS "count"
      FROM whatsapp_agent_logs
      WHERE "createdAt" >= ${since}
        AND "event" = ANY(${MODEL_EVENTS}::text[])
        AND (${userId}::int IS NULL OR "userId" = ${userId}::int)
        AND (${source}::text IS NULL OR "source" = ${source}::text)
      GROUP BY 1, 2, 3, 4
      ORDER BY 1 ASC
    `;

    /* ---- per model ------------------------------------------------- */

    const errorBy = new Map(
      lastErrors.map((e) => [
        `${e.category}|${e.provider}|${e.modelId}`,
        { message: e.errorText || e.message, at: e.at },
      ])
    );

    interface Bucket {
      provider: string;
      modelId: string;
      ok: number;
      degraded: number;
      failed: number;
      totalMs: number;
      timed: number;
      inputTokens: number;
      outputTokens: number;
      costCents: number;
    }

    const perRole = new Map<string, Map<string, Bucket>>(MODEL_ROLES.map((r) => [r, new Map()]));

    for (const row of grouped) {
      const models = perRole.get(row.category);
      if (!models) continue;

      const key = `${row.provider}|${row.modelId}`;
      const bucket = models.get(key) || {
        provider: row.provider,
        modelId: row.modelId,
        ok: 0,
        degraded: 0,
        failed: 0,
        totalMs: 0,
        timed: 0,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
      };

      // Suppressed repeats are real attempts that were never written. They have
      // no duration and no cost of their own, so they are added to the count
      // only — averaging over them would invent latency nobody measured.
      bucket[outcomeOf(row.event, row.level)] += row.rows + row.suppressed;
      bucket.totalMs += row.totalMs;
      bucket.timed += row.timed;
      bucket.inputTokens += row.inputTokens;
      bucket.outputTokens += row.outputTokens;
      bucket.costCents += row.costCents;

      models.set(key, bucket);
    }

    const roles = MODEL_ROLES.map((role) => {
      const models = [...(perRole.get(role)?.values() ?? [])]
        .map((b) => {
          const attempts = b.ok + b.degraded + b.failed;
          const failure = errorBy.get(`${role}|${b.provider}|${b.modelId}`);
          return {
            provider: b.provider,
            modelId: b.modelId,
            key: `${b.provider}:${b.modelId}`,
            attempts,
            ok: b.ok,
            degraded: b.degraded,
            failed: b.failed,
            // The headline number. Clean passes only — an engine that always
            // needs its fallback is not a working engine.
            successRate: attempts ? Math.round((b.ok / attempts) * 1000) / 10 : 0,
            // Everything the customer eventually got an answer from, which is a
            // different and also useful question.
            answeredRate: attempts ? Math.round(((b.ok + b.degraded) / attempts) * 1000) / 10 : 0,
            avgMs: b.timed ? Math.round(b.totalMs / b.timed) : null,
            inputTokens: b.inputTokens,
            outputTokens: b.outputTokens,
            costCents: b.costCents,
            lastFailure: failure ? { message: failure.message.slice(0, 300), at: failure.at } : null,
          };
        })
        // Busiest first: the engine carrying the traffic is the one whose rate
        // matters, and a model with three calls should not head the chart.
        .sort((a, b) => b.attempts - a.attempts);

      const totals = models.reduce(
        (acc, m) => ({
          attempts: acc.attempts + m.attempts,
          ok: acc.ok + m.ok,
          degraded: acc.degraded + m.degraded,
          failed: acc.failed + m.failed,
          costCents: acc.costCents + m.costCents,
        }),
        { attempts: 0, ok: 0, degraded: 0, failed: 0, costCents: 0 }
      );

      return {
        role,
        models,
        totals: {
          ...totals,
          successRate: totals.attempts ? Math.round((totals.ok / totals.attempts) * 1000) / 10 : 0,
        },
      };
    });

    /* ---- the timeline ---------------------------------------------- */

    /**
     * Empty buckets are emitted as zeros rather than skipped.
     *
     * A line drawn from present points only interpolates straight through a
     * silent hour, which reads as steady traffic during an outage — the exact
     * opposite of what happened.
     */
    const byBucket = new Map<number, Record<string, number>>();
    const firstBucket = Math.floor(since.getTime() / 1000 / seconds) * seconds;
    const lastBucket = Math.floor(Date.now() / 1000 / seconds) * seconds;
    for (let t = firstBucket; t <= lastBucket; t += seconds) {
      byBucket.set(
        t,
        Object.fromEntries(
          MODEL_ROLES.flatMap((r) => [
            [`${r}_ok`, 0],
            [`${r}_degraded`, 0],
            [`${r}_failed`, 0],
          ])
        )
      );
    }

    for (const row of timeline) {
      const t = Math.floor(new Date(row.at).getTime() / 1000);
      const slot = byBucket.get(t);
      if (!slot || !MODEL_ROLES.includes(row.category as (typeof MODEL_ROLES)[number])) continue;
      slot[`${row.category}_${outcomeOf(row.event, row.level)}`] += row.count;
    }

    res.json({
      status: 'success',
      data: {
        hours,
        since,
        source: rawSource,
        bucketSeconds: seconds,
        roles,
        timeline: [...byBucket.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([t, counts]) => ({ at: new Date(t * 1000).toISOString(), ...counts })),
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* cleanup                                                             */
/* ------------------------------------------------------------------ */

/**
 * Applies the retention window on demand.
 *
 * The worker already does this hourly; this is the button for the case where
 * the retention setting was just lowered and nobody wants to wait, and for a
 * deployment where the worker is not running at all.
 */
router.post(
  '/prune',
  asyncHandler(async (_req, res) => {
    const removed = await pruneWaLogs();
    res.json({ status: 'success', data: { removed } });
  })
);

/**
 * Deletes what the current filters select.
 *
 * Requires an explicit `confirm: true`, and refuses a completely empty filter:
 * "delete everything" through a filter form is nearly always a mis-click, and
 * the deliberate way to empty this table is to set the retention to 1 day.
 */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    if (req.body?.confirm !== true) throw new AppException(400, 'Confirmation requise.');

    const userId = await resolveAccount(req.query);
    const where = buildWhere(req.query, userId);
    if (!Object.keys(where).length) {
      throw new AppException(
        400,
        'Filtrez avant de supprimer (compte, niveau, catégorie ou période). Pour tout purger, baissez WA_LOG_RETENTION_DAYS.'
      );
    }

    const { count } = await prisma.whatsappAgentLog.deleteMany({ where });
    res.json({ status: 'success', data: { removed: count } });
  })
);

export default router;
