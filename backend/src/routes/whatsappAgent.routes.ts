/**
 * The account-facing WhatsApp agent API — configuration, catalogue, voices,
 * and the WhatsApp connection itself.
 *
 * ENTITLEMENT. Everything except GET /status is behind `requireAgent`, which
 * reads the same two-column gate as Google Sheets credits
 * (`whatsappAgentEnabled` + `whatsappAgentGateFrom`). GET /status deliberately
 * answers 200 { enabled: false } instead of 403, for the same reason
 * /sheet-credits/me does: the frontend calls it to decide whether to render the
 * navigation entry at all, and a 403 there would be an error toast on every
 * page load for every account that has not bought the feature.
 *
 * SUB-ACCOUNTS. A VENDOR_HELPER never reaches this router: lib/vendorSubAccount
 * is deny-by-default and has no rule for /whatsapp-agent, so a helper request
 * is refused before it arrives. That is the intended v1 behaviour — the agent
 * speaks to customers as the business, and handing that to a helper deserves
 * its own explicit grant rather than arriving by accident.
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { getSecret } from '../lib/secretStore.js';
import { getWaCreditStats, isWaAgentActive, WA_GATE_SELECT } from '../services/waCredits.service.js';
import { getOrCreateAgent, sanitiseAgentPatch, ensureDefaultVoices } from '../wa/agentStore.js';
import { normaliseKb, recompilePrompt } from '../wa/kb.js';
import { listModels, ensureCatalogue } from '../wa/catalogue.js';
import { synthesize } from '../wa/speech.js';
import { getIO } from '../lib/realtime.js';
import { nudgeWorker } from '../lib/waWorkerClient.js';
import { isSandboxJid, sandboxJid } from '../wa/transport.js';
import { getOrCreateBench, sendAsBenchCustomer } from '../wa/bench.js';

const router = Router();

/** Roles that may run an agent. Everyone else is simply not entitled. */
const AGENT_ROLES = ['VENDOR', 'INFLUENCER'];

const DENIED = "L'agent WhatsApp n'est pas activé sur ce compte.";

/**
 * Where customer photos and voice notes live.
 *
 * NEVER under uploads/. That directory is mounted as unauthenticated static
 * twice — routes/index.ts and index.ts, the second with
 * Access-Control-Allow-Origin:* and 30-day caching — so anything written there
 * is readable by anyone who can guess the path. These files are customer PII.
 */
export const mediaRoot = (): string =>
  getSecret('WA_MEDIA_ROOT') || path.join(process.cwd(), 'wa-media');

/** Loads the caller's gate. Throws 403 for anyone not entitled. */
async function requireAgent(req: any) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { ...WA_GATE_SELECT, role: { select: { name: true } } },
  });

  if (!user || !AGENT_ROLES.includes(user.role?.name || '') || !isWaAgentActive(user)) {
    throw new AppException(403, DENIED);
  }
  return user;
}

const gate = asyncHandler(async (req: any, _res: any, next: any) => {
  await requireAgent(req);
  next();
});

/* ------------------------------------------------------------------ */
/* status — the only endpoint that never 403s                         */
/* ------------------------------------------------------------------ */

router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: any, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { ...WA_GATE_SELECT, role: { select: { name: true } } },
    });

    const entitled =
      !!user && AGENT_ROLES.includes(user.role?.name || '') && isWaAgentActive(user);

    if (!entitled) {
      return res.json({ status: 'success', data: { enabled: false } });
    }

    const [agent, session, credits] = await Promise.all([
      getOrCreateAgent(req.user.id),
      prisma.whatsappSession.findUnique({ where: { userId: req.user.id } }),
      getWaCreditStats(req.user.id),
    ]);

    const [unread, products] = await Promise.all([
      prisma.whatsappContact.count({ where: { userId: req.user.id, unreadCount: { gt: 0 } } }),
      prisma.whatsappProductProfile.count({ where: { userId: req.user.id, enabled: true } }),
    ]);

    res.json({
      status: 'success',
      data: {
        enabled: true,
        agentEnabled: agent.enabled,
        // Named prerequisites rather than one "ready" boolean, so the UI can
        // tell the account exactly what is still missing instead of showing a
        // disabled button with no explanation.
        prerequisites: {
          brainModel: !!agent.brainModelId,
          whatsappConnected: session?.status === 'CONNECTED',
          hasProducts: products > 0,
          hasCredits: credits.balance >= credits.priceCents,
        },
        session: session
          ? {
              status: session.status,
              desiredState: session.desiredState,
              phoneNumber: session.phoneNumber,
              pushName: session.pushName,
              lastError: session.lastError,
              lastConnectedAt: session.lastConnectedAt,
            }
          : { status: 'DISCONNECTED', desiredState: 'OFF' },
        credits,
        unread,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* configuration                                                       */
/* ------------------------------------------------------------------ */

router.get(
  '/config',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const agent = await getOrCreateAgent(req.user.id);
    res.json({
      status: 'success',
      data: {
        ...agent,
        kb: normaliseKb(agent.kb),
        // Tells the UI to render the brain as a read-only, platform-managed
        // fact rather than a select whose value it cannot represent.
        brainLocked: !!agent.brainModel?.adminOnly,
      },
    });
  })
);

router.put(
  '/config',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    await getOrCreateAgent(req.user.id);

    let patch: Record<string, unknown>;
    try {
      patch = sanitiseAgentPatch(req.body || {});
    } catch (err: any) {
      throw new AppException(400, err.message);
    }

    // An admin-assigned brain belongs to the admin.
    //
    // The account's model picker cannot even DISPLAY an adminOnly model, so its
    // select falls back to showing some other one; saving that form would
    // silently move the account off the engine an admin deliberately put it on.
    // Refusing the write is the only way the page cannot lie by omission.
    const current = await prisma.whatsappAgent.findUnique({
      where: { userId: req.user.id },
      select: { brainModel: { select: { adminOnly: true, label: true } } },
    });

    if (current?.brainModel?.adminOnly && 'brainModelId' in (req.body || {})) {
      throw new AppException(
        403,
        `Le cerveau de cet agent (${current.brainModel.label}) est géré par la plateforme et ne peut pas être changé ici.`
      );
    }

    // Model choices are validated separately from the plain settings: the id
    // must name a row the ADMIN has enabled for that exact role, or an account
    // could point its brain at a TTS model, or at one the admin turned off.
    // sttModelId and ttsModelId are deliberately absent: which speech engines
    // the platform pays for is not a seller decision. See
    // ADMIN_ONLY_AGENT_FIELDS.
    // visionModelId is deliberately absent: nothing reads it. Photos reach the
    // model as inline blocks on the BRAIN request, so the only setting that
    // governs them is `readImages` — accepting a vision model here would store
    // a choice that never takes effect.
    for (const [field, role] of [['brainModelId', 'BRAIN']] as const) {
      if (!(field in (req.body || {}))) continue;
      const raw = req.body[field];
      if (raw === null || raw === '') {
        patch[field] = null;
        continue;
      }
      const id = Number(raw);
      const model = await prisma.aiModel.findFirst({
        where: { id, role, isEnabled: true, adminOnly: false },
      });
      if (!model) throw new AppException(400, `Modèle ${role} indisponible.`);
      patch[field] = id;
      if (field === 'brainModelId' && typeof patch.maxOutputTokens === 'number') {
        patch.maxOutputTokens = Math.min(patch.maxOutputTokens as number, model.maxOutputTokens);
      }
    }

    if ('ttsChain' in (req.body || {})) {
      const raw = Array.isArray(req.body.ttsChain) ? req.body.ttsChain : [];
      const enabled = await prisma.aiModel.findMany({
        where: { role: 'TTS', isEnabled: true },
        select: { provider: true, modelId: true },
      });
      const allowed = new Set(enabled.map((m) => `${m.provider}:${m.modelId}`));

      const chain = raw
        .map((entry: unknown) => String(entry).trim())
        .filter((entry: string) => allowed.has(entry))
        .slice(0, 8);

      // Silently dropping an unknown link would leave the account believing it
      // has a fallback it does not have.
      if (chain.length !== raw.length) {
        throw new AppException(400, 'La chaîne de repli contient un modèle vocal qui n’est pas activé.');
      }
      patch.ttsChain = chain;
    }

    if ('activeVoiceId' in (req.body || {})) {
      const id = Number(req.body.activeVoiceId);
      const owned = await prisma.whatsappAgentVoice.findFirst({
        where: { id, userId: req.user.id },
        select: { id: true },
      });
      if (!owned) throw new AppException(400, 'Préréglage de voix introuvable.');
      patch.activeVoiceId = id;
    }

    const agent = await prisma.whatsappAgent.update({
      where: { userId: req.user.id },
      data: patch,
      include: { brainModel: true, sttModel: true, ttsModel: true, activeVoice: true },
    });

    res.json({ status: 'success', data: agent });
  })
);

router.put(
  '/kb',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    await getOrCreateAgent(req.user.id);

    const kb = normaliseKb(req.body?.kb ?? req.body);
    await prisma.whatsappAgent.update({
      where: { userId: req.user.id },
      data: { kb: kb as unknown as object },
    });

    // Recompiled on save, never per turn: the system block is sent with
    // cache_control and prompt caching is a prefix match, so re-rendering it on
    // every message risks a byte moving and silently losing the cache hit.
    const compiledPrompt = await recompilePrompt(req.user.id);

    res.json({ status: 'success', data: { kb, compiledPrompt } });
  })
);

/** Lets the account read exactly what its agent is told. */
router.get(
  '/prompt',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const agent = await prisma.whatsappAgent.findUnique({
      where: { userId: req.user.id },
      select: { compiledPrompt: true, promptVersion: true },
    });
    res.json({ status: 'success', data: agent || { compiledPrompt: '', promptVersion: 0 } });
  })
);

/* ------------------------------------------------------------------ */
/* catalogue the account may choose from                              */
/* ------------------------------------------------------------------ */

router.get(
  '/models',
  authenticate,
  gate,
  asyncHandler(async (_req, res) => {
    await ensureCatalogue();
    const [brain, stt, tts] = await Promise.all([
      listModels('BRAIN'),
      listModels('STT'),
      listModels('TTS'),
    ]);
    res.json({ status: 'success', data: { brain, stt, tts } });
  })
);

router.get(
  '/voices',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    await ensureDefaultVoices(req.user.id);

    const [catalogue, presets] = await Promise.all([
      prisma.aiVoice.findMany({
        where: { isEnabled: true },
        orderBy: [{ provider: 'asc' }, { sortOrder: 'asc' }],
      }),
      prisma.whatsappAgentVoice.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isSystem: 'desc' }, { id: 'asc' }],
      }),
    ]);

    res.json({ status: 'success', data: { catalogue, presets } });
  })
);

/** Validates and normalises a voice preset body. */
async function readPresetBody(body: any) {
  const name = String(body?.name || '').trim();
  if (!name) throw new AppException(400, 'Le préréglage doit avoir un nom.');

  const voiceRefId = Number(body?.voiceRef);
  const voice = Number.isFinite(voiceRefId)
    ? await prisma.aiVoice.findFirst({ where: { id: voiceRefId, isEnabled: true } })
    : null;
  if (!voice) throw new AppException(400, 'Choisissez une voix dans le catalogue.');

  // Clamped, not rejected: these are sliders. -50%..+100% is the range SSML
  // handles gracefully — past that Edge starts producing unintelligible audio.
  const clamp = (v: unknown, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.trunc(Number(v) || 0)));

  return {
    name: name.slice(0, 80),
    voiceRef: voice.id,
    // Denormalised so a preset still renders after an admin disables a
    // catalogue row, and so synthesis fails loudly rather than silently
    // speaking in some other voice.
    provider: voice.provider,
    voiceId: voice.voiceId,
    rate: clamp(body?.rate, -50, 100),
    pitch: clamp(body?.pitch, -50, 50),
    volume: clamp(body?.volume, -50, 50),
    style: voice.supportsStyle && body?.style ? String(body.style).slice(0, 40) : null,
    styleDegree: Math.min(2, Math.max(0.01, Number(body?.styleDegree) || 1)),
    stylePrompt: body?.stylePrompt ? String(body.stylePrompt).slice(0, 600) : null,
  };
}

router.post(
  '/voices',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const data = await readPresetBody(req.body);

    const existing = await prisma.whatsappAgentVoice.findUnique({
      where: { userId_name: { userId: req.user.id, name: data.name } },
      select: { id: true },
    });
    if (existing) throw new AppException(409, 'Un préréglage porte déjà ce nom.');

    const preset = await prisma.whatsappAgentVoice.create({
      data: { ...data, userId: req.user.id, isSystem: false },
    });

    res.status(201).json({ status: 'success', data: preset });
  })
);

router.put(
  '/voices/:id',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const id = Number(req.params.id);
    const owned = await prisma.whatsappAgentVoice.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true },
    });
    if (!owned) throw new AppException(404, 'Préréglage introuvable.');

    const data = await readPresetBody(req.body);
    const preset = await prisma.whatsappAgentVoice.update({ where: { id }, data });
    res.json({ status: 'success', data: preset });
  })
);

router.delete(
  '/voices/:id',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const id = Number(req.params.id);
    const preset = await prisma.whatsappAgentVoice.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true, isSystem: true },
    });
    if (!preset) throw new AppException(404, 'Préréglage introuvable.');
    if (preset.isSystem) throw new AppException(400, 'Les préréglages fournis ne peuvent pas être supprimés.');

    // The agent must never end up pointing at a deleted preset, or the next
    // voice reply fails at synthesis with a foreign key that resolves to null.
    await prisma.whatsappAgent.updateMany({
      where: { userId: req.user.id, activeVoiceId: id },
      data: { activeVoiceId: null },
    });
    await prisma.whatsappAgentVoice.delete({ where: { id } });

    res.json({ status: 'success', data: { id } });
  })
);

/**
 * Speaks a sample so the account can hear a preset before saving it.
 *
 * Synthesised on demand rather than pre-rendered: the whole point is to hear
 * the speed and emotion the account has just dialled in, which no pre-rendered
 * sample can capture.
 */
router.post(
  '/voices/preview',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const data = await readPresetBody(req.body);
    const agent = await getOrCreateAgent(req.user.id);

    const text =
      String(req.body?.text || '').trim().slice(0, 300) ||
      'السلام عليكم، أنا معاك من المتجر. واش بغيتي نأكدو الطلب ديالك؟';

    const outDir = path.join(mediaRoot(), String(req.user.id), 'previews');

    try {
      const result = await synthesize(
        text,
        data,
        {
          modelId: (agent as any).ttsModel?.modelId,
          policy: {
            chain: agent.ttsChain,
            retries: agent.ttsRetries,
            verify: agent.ttsVerify as 'never' | 'live_only' | 'always',
            onFailure: agent.ttsOnFailure as 'text_only' | 'fallback_edge',
            timeoutMs: agent.ttsTimeoutMs,
            sttProvider: (agent as any).sttModel?.provider,
            sttModelId: (agent as any).sttModel?.modelId,
          },
          outDir,
          // Deterministic per preset name, so repeated previews overwrite one
          // file instead of filling the disk with every slider adjustment.
          basename: `preview-${data.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        }
      );

      res.json({
        status: 'success',
        data: {
          url: `/api/v1/whatsapp-agent/media/preview/${path.basename(result.filePath)}`,
          provider: result.provider,
          model: result.model,
          fellBackFrom: result.fellBackFrom,
          retried: result.retried,
          attempts: result.attempts,
        },
      });
    } catch (err: any) {
      // A missing ffmpeg or a missing Gemini key is a configuration problem the
      // account cannot fix, so say which one it is rather than "500".
      throw new AppException(400, `Aperçu impossible : ${err.message}`);
    }
  })
);

router.get(
  '/media/preview/:file',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    // basename() strips any traversal: the file name comes from a URL and must
    // never be able to walk out of the account's own preview directory.
    const file = path.basename(String(req.params.file));
    const full = path.join(mediaRoot(), String(req.user.id), 'previews', file);
    if (!fs.existsSync(full)) throw new AppException(404, 'Aperçu introuvable.');
    res.sendFile(full);
  })
);

/* ------------------------------------------------------------------ */
/* products the agent may sell                                        */
/* ------------------------------------------------------------------ */

/**
 * The account's own catalogue, each row carrying its agent profile when it has
 * one.
 *
 * "Own" means a product it owns outright or has an approved affiliate claim on
 * — the same two sources the rest of the seller UI treats as the seller's
 * catalogue. The agent must never be able to sell something the account cannot
 * actually fulfil.
 */
router.get(
  '/products',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const claims = await prisma.affiliateClaim.findMany({
      where: { userId: req.user.id, status: 'APPROVED' },
      select: { productId: true },
    });

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { ownerId: req.user.id },
          { id: { in: claims.map((c) => c.productId) } },
        ],
      },
      select: {
        id: true,
        sku: true,
        nameFr: true,
        nameAr: true,
        description: true,
        retailPriceMad: true,
        stockStatus: true,
        images: { select: { imageUrl: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
        videoUrls: true,
      },
      orderBy: { id: 'desc' },
    });

    const profiles = await prisma.whatsappProductProfile.findMany({
      where: { userId: req.user.id },
    });
    const byProduct = new Map(profiles.map((p) => [p.productId, p]));

    res.json({
      status: 'success',
      data: products.map((p) => ({ ...p, profile: byProduct.get(p.id) || null })),
    });
  })
);

router.put(
  '/products/:productId',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const productId = Number(req.params.productId);

    const claim = await prisma.affiliateClaim.findFirst({
      where: { userId: req.user.id, productId, status: 'APPROVED' },
      select: { id: true },
    });
    const product = await prisma.product.findFirst({
      where: { id: productId, OR: [{ ownerId: req.user.id }, ...(claim ? [{ id: productId }] : [])] },
      select: { id: true },
    });
    if (!product) throw new AppException(404, 'Produit introuvable dans votre catalogue.');

    const b = req.body || {};
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const str = (v: unknown, max = 4000) => (v ? String(v).slice(0, max) : null);

    const objections = Array.isArray(b.objections)
      ? b.objections
          .filter((o: any) => o?.objection && o?.response)
          .slice(0, 20)
          .map((o: any) => ({
            objection: String(o.objection).slice(0, 300),
            response: String(o.response).slice(0, 1000),
          }))
      : [];

    const mediaUrls = Array.isArray(b.mediaUrls)
      ? b.mediaUrls.filter((u: any) => typeof u === 'string' && u.trim()).slice(0, 20).map((u: string) => u.trim())
      : [];

    const data = {
      enabled: b.enabled !== false,
      agentPriceMad: num(b.agentPriceMad),
      oldPriceMad: num(b.oldPriceMad),
      sellingCopy: str(b.sellingCopy),
      benefits: str(b.benefits),
      variants: str(b.variants, 1000),
      stockNote: str(b.stockNote, 200),
      objections,
      mediaUrls,
      notes: str(b.notes, 2000),
    };

    const profile = await prisma.whatsappProductProfile.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: data,
      create: { userId: req.user.id, productId, ...data },
    });

    await recompilePrompt(req.user.id);
    res.json({ status: 'success', data: profile });
  })
);

router.delete(
  '/products/:productId',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const productId = Number(req.params.productId);
    await prisma.whatsappProductProfile.deleteMany({ where: { userId: req.user.id, productId } });
    await recompilePrompt(req.user.id);
    res.json({ status: 'success', data: { productId } });
  })
);

/* ------------------------------------------------------------------ */
/* the WhatsApp connection                                            */
/* ------------------------------------------------------------------ */

/**
 * Asks the worker to bring this account's session up.
 *
 * `desiredState` is written FIRST and the worker is only nudged afterwards. The
 * worker reconciles live sockets against desiredState on every tick, so a nudge
 * that never arrives — worker restarting, loopback call lost — self-heals
 * within one tick instead of leaving the two permanently out of step.
 */
router.post(
  '/session/connect',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const cap = Number(getSecret('WA_MAX_SESSIONS') || 0);
    if (cap > 0) {
      const live = await prisma.whatsappSession.count({
        where: { desiredState: 'ON', userId: { not: req.user.id } },
      });
      if (live >= cap) {
        throw new AppException(
          503,
          'La plateforme a atteint son nombre maximum de connexions WhatsApp simultanées. Réessayez plus tard.'
        );
      }
    }

    const session = await prisma.whatsappSession.upsert({
      where: { userId: req.user.id },
      update: { desiredState: 'ON', lastError: null },
      create: { userId: req.user.id, desiredState: 'ON', status: 'CONNECTING' },
    });

    await nudgeWorker('connect', req.user.id);
    res.json({ status: 'success', data: session });
  })
);

router.post(
  '/session/disconnect',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const session = await prisma.whatsappSession.upsert({
      where: { userId: req.user.id },
      update: { desiredState: 'OFF' },
      create: { userId: req.user.id, desiredState: 'OFF' },
    });
    await nudgeWorker('disconnect', req.user.id);
    res.json({ status: 'success', data: session });
  })
);

/**
 * Drops the socket and builds a new one, without unlinking the device.
 *
 * THE BUTTON FOR "IT SAYS CONNECTED AND NOTHING IS ARRIVING". That state is
 * real and it is not visible from the dashboard: a WhatsApp socket can stay
 * open, keep sending successfully, keep every status green, and silently stop
 * delivering inbound messages. `connect` cannot clear it, because it reconciles
 * against desiredState and desiredState is already ON — the session is skipped
 * as already-running, which is exactly the wrong answer for the one session
 * that needs rebuilding.
 *
 * Recovering used to mean disconnect, wait for the tick, connect, and hope the
 * cooldown had expired. This is that sequence, done correctly and in one call.
 *
 * No QR is involved. Credentials live in Postgres and survive the bounce, so
 * the seller stays linked.
 */
router.post(
  '/session/reconnect',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const session = await prisma.whatsappSession.upsert({
      where: { userId: req.user.id },
      // Cleared because it is about to be re-derived. Leaving a stale reason on
      // screen next to a session that just came back up reads as a failure.
      update: { desiredState: 'ON', lastError: null },
      create: { userId: req.user.id, desiredState: 'ON', status: 'CONNECTING' },
    });

    // Unlike the others this one is awaited for its effect, not as a hint: the
    // seller is watching a spinner. If the worker is unreachable the reconcile
    // tick still rebuilds the socket within ten seconds, which is why a failed
    // nudge is not surfaced as an error.
    await nudgeWorker('reconnect', req.user.id);
    res.json({ status: 'success', data: session });
  })
);

/**
 * Unlinks the device and destroys the credentials.
 *
 * Separate from disconnect on purpose: disconnect is "stop for now" and keeps
 * the pairing, this is "forget my WhatsApp" and forces a new QR scan. Merging
 * them would make a temporary pause cost the seller a re-scan.
 */
router.post(
  '/session/logout',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    await prisma.whatsappSession.upsert({
      where: { userId: req.user.id },
      update: { desiredState: 'OFF', status: 'LOGGED_OUT', qr: null, phoneNumber: null },
      create: { userId: req.user.id, desiredState: 'OFF', status: 'LOGGED_OUT' },
    });
    await nudgeWorker('logout', req.user.id);
    await prisma.whatsappAuthCredential.deleteMany({ where: { userId: req.user.id } });
    res.json({ status: 'success', data: { status: 'LOGGED_OUT' } });
  })
);

/**
 * The pairing QR.
 *
 * Polled by the connect screen. Baileys rotates the code roughly every 20
 * seconds, so a stale one is reported as expired rather than served — a QR that
 * silently fails to scan is the single most confusing thing in this flow.
 */
router.get(
  '/session/qr',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const session = await prisma.whatsappSession.findUnique({
      where: { userId: req.user.id },
      select: { qr: true, qrExpiresAt: true, status: true, lastError: true },
    });

    const fresh =
      session?.qr && session.qrExpiresAt && session.qrExpiresAt.getTime() > Date.now();

    res.json({
      status: 'success',
      data: {
        qr: fresh ? session!.qr : null,
        status: session?.status || 'DISCONNECTED',
        lastError: session?.lastError || null,
      },
    });
  })
);

/* ------------------------------------------------------------------ */
/* banc d'essai — talk to your own agent without WhatsApp             */
/* ------------------------------------------------------------------ */

/**
 * THE BENCH. An account chats with its own agent from the dashboard.
 *
 * WHY IT EXISTS. Testing an agent otherwise requires a SECOND phone: WhatsApp
 * will not let the connected number message itself, so the only way to see what
 * the agent actually says was to borrow someone else's handset — which meant
 * nobody tested a knowledge-base change before customers did.
 *
 * WHAT IT DOES NOT DO is more important than what it does. It does not
 * reimplement the turn. It writes the same three rows `ingest()` writes — a
 * contact, a message, a turn — and the worker drains them through exactly the
 * code a real customer goes through: the guard rails, the working hours, the
 * credit debit, the model call, the tools, the voice. If a bench reply differs
 * from a live one, that is a bug in the bench, not a feature of it.
 *
 * The two deliberate differences, both enforced elsewhere so they cannot be
 * bypassed from here:
 *
 *   The reply never reaches WhatsApp. `@sandbox` is not a routable domain and
 *   wa/worker.ts completes those jobs locally.
 *
 *   A confirmed bench order never becomes a billed Lead — refused inside
 *   services/waLeadPromotion.service.ts, which is the single crossing point
 *   into the billed pipeline.
 *
 * IT DOES SPEND CREDITS, on purpose. A bench turn is a real model call the
 * platform pays for, and a free one would be a way to run the agent for nothing.
 */

router.get(
  '/sandbox',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const contact = await getOrCreateBench(req.user.id);

    const messages = await prisma.whatsappMessage.findMany({
      where: { contactId: contact.id },
      orderBy: { id: 'asc' },
      take: 200,
      select: {
        id: true,
        direction: true,
        kind: true,
        body: true,
        transcript: true,
        fromAgent: true,
        mediaPath: true,
        createdAt: true,
      },
    });

    // The turn state is what makes the bench diagnostic rather than merely
    // conversational: a reply that never arrives has a reason, and the reason
    // is on the turn row.
    const turns = await prisma.whatsappAgentTurn.findMany({
      where: { contactId: contact.id },
      orderBy: { id: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        skipReason: true,
        lastError: true,
        costCents: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true,
        finishedAt: true,
      },
    });

    res.json({
      status: 'success',
      data: {
        contact: {
          id: contact.id,
          status: contact.status,
          draft: contact.draft,
          aiEnabled: contact.aiEnabled,
          aiReplyCount: contact.aiReplyCount,
          leadId: contact.leadId,
        },
        messages: messages.map((m) => ({
          ...m,
          // The bench never serves media bytes; a path would only leak the
          // worker's filesystem layout into the browser.
          mediaPath: undefined,
          hasMedia: !!m.mediaPath,
        })),
        turns,
      },
    });
  })
);

/**
 * Sends a message AS THE CUSTOMER and queues the agent's turn.
 *
 * Mirrors wa/worker.ts `ingest()` field for field. Where the two drift, this
 * one is wrong.
 */
router.post(
  '/sandbox/message',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) throw new AppException(400, 'Écrivez un message.');
    if (text.length > 4000) throw new AppException(400, 'Message trop long pour un test.');

    const contact = await getOrCreateBench(req.user.id);
    const stored = await sendAsBenchCustomer(req.user.id, contact.id, text);

    res.status(201).json({ status: 'success', data: { message: stored } });
  })
);

/** Wipes the bench so the next test starts from a first contact. */
router.delete(
  '/sandbox',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const contact = await prisma.whatsappContact.findUnique({
      where: { userId_jid: { userId: req.user.id, jid: sandboxJid(req.user.id) } },
      select: { id: true, jid: true },
    });

    // Belt and braces. The where-clause above can only find the bench, but this
    // route deletes a whole conversation and its messages, so it verifies what
    // it is about to destroy rather than trusting the lookup.
    if (contact && isSandboxJid(contact.jid)) {
      await prisma.whatsappContact.delete({ where: { id: contact.id } });
    }

    res.json({ status: 'success', data: { reset: true } });
  })
);

/* ------------------------------------------------------------------ */
/* credits and usage                                                  */
/* ------------------------------------------------------------------ */

router.get(
  '/credits',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const stats = await getWaCreditStats(req.user.id);

    const account = await prisma.waCreditAccount.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    const transactions = account
      ? await prisma.waCreditTransaction.findMany({
          where: { accountId: account.id },
          // id is the tie-break: a grant and the consumes it unblocks can land
          // in the same millisecond, and without a total order rows swap
          // between pages.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        })
      : [];

    res.json({ status: 'success', data: { ...stats, transactions } });
  })
);

router.get(
  '/usage',
  authenticate,
  gate,
  asyncHandler(async (req: any, res) => {
    const rows = await prisma.whatsappAgentUsage.findMany({
      where: { userId: req.user.id },
      orderBy: { day: 'desc' },
      take: 30,
    });
    res.json({ status: 'success', data: rows });
  })
);

/* ------------------------------------------------------------------ */


/** Pushes a live update to the account's browser tabs. */
export function emitToAccount(userId: number, event: string, payload: unknown): void {
  try {
    getIO()?.to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    console.error('[wa] realtime emit failed:', err);
  }
}

// Re-exported so existing importers keep working now that the implementation
// lives in lib/waWorkerClient.ts (the worker must not import the HTTP layer).
export { nudgeWorker };

export default router;
