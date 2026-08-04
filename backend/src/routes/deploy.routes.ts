/**
 * Deployment API.
 *
 * Two audiences with very different trust levels:
 *   - GitHub, unauthenticated, reaching /webhook. Trusted only after an HMAC
 *     signature check that FAILS CLOSED.
 *   - A signed-in SUPER_ADMIN, reaching everything else.
 *
 * Nothing here accepts a command, a branch, a path or a script name from the
 * caller. The deploy command is fixed in deploy.service.ts. That is deliberate:
 * this endpoint runs shell commands on the production host, so the request body
 * must never influence what runs.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { getSecret } from '../lib/secretStore.js';
import {
  getDeployStatus,
  startDeploy,
  readDeployLog,
  isDeploying,
} from '../services/deploy.service.js';

const router = Router();

/** Room for admins watching deployments. Joined only via the `deploy:subscribe` handler. */
export const DEPLOY_ROOM = 'deploy:watchers';

async function emit(event: string, payload: unknown) {
  try {
    // Dynamic import avoids a circular dependency at module init: index.ts
    // imports the router, and the router needs io from index.ts.
    const { getIO } = await import('../index.js');
    getIO()?.to(DEPLOY_ROOM).emit(event, payload);
  } catch {
    /* socket layer not ready — the panel falls back to HTTP polling */
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * GitHub webhook (public, signature-verified)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Verifies GitHub's HMAC-SHA256 signature.
 *
 * Returns false when no secret is configured. This is the single most important
 * line in the file: if an unset secret meant "skip verification", this endpoint
 * would become an unauthenticated trigger for shell commands on the VPS. Fail
 * closed, always.
 */
function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = getSecret('GITHUB_WEBHOOK_SECRET');
  if (!secret) {
    console.warn('[deploy] webhook rejected: GITHUB_WEBHOOK_SECRET is not configured');
    return false;
  }
  if (!signature || !signature.startsWith('sha256=')) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * POST /api/v1/deploy/webhook
 *
 * The raw request bytes come from the `verify` hook on the global
 * express.json() in index.ts. A route-level raw() parser would not work here:
 * express.json() is registered app-wide and has already consumed the stream by
 * the time routing happens, so raw() would see an empty buffer and every
 * legitimate webhook would fail its signature check.
 */
router.post('/webhook', async (req, res) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;

  if (!rawBody) {
    // Missing raw body means the verify hook did not fire — refuse rather than
    // fall back to re-serialising req.body, which would not match the signature
    // and, worse, could be made to match by a crafted payload.
    console.error('[deploy] webhook rejected: raw body unavailable');
    return res.status(400).json({ status: 'error', message: 'Invalid request' });
  }

  if (!verifySignature(rawBody, req.header('x-hub-signature-256'))) {
    // 401 with no detail: a probing attacker learns nothing about why.
    return res.status(401).json({ status: 'error', message: 'Invalid signature' });
  }

  const event = req.header('x-github-event');
  if (event === 'ping') {
    return res.json({ status: 'success', data: { pong: true } });
  }
  if (event !== 'push') {
    return res.json({ status: 'success', data: { ignored: event } });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ status: 'error', message: 'Malformed payload' });
  }

  const branch = String(payload.ref || '').replace('refs/heads/', '');
  const commits: any[] = Array.isArray(payload.commits) ? payload.commits : [];

  for (const c of commits) {
    if (!c?.id) continue;
    await prisma.pendingCommit.upsert({
      where: { sha: c.id },
      create: {
        sha: c.id,
        message: String(c.message || '').slice(0, 500),
        author: c.author?.name || c.author?.username || null,
        branch,
        url: c.url || null,
        committedAt: c.timestamp ? new Date(c.timestamp) : null,
      },
      update: {},
    });
  }

  const pendingCount = await prisma.pendingCommit.count({ where: { deployed: false } });

  await emit('deploy:pending', {
    branch,
    pushed: commits.length,
    pendingCount,
    commits: commits.slice(0, 10).map((c) => ({
      sha: c.id,
      shortSha: String(c.id).slice(0, 7),
      message: String(c.message || '').split('\n')[0],
      author: c.author?.name || null,
    })),
  });

  console.log(`[deploy] webhook: ${commits.length} commit(s) on ${branch}`);

  // Deliberately notify-only. Auto-deploying on push would take the public site
  // down unattended the first time a bad commit lands, and deploy.sh touches the
  // database. A human clicking Deploy is the guardrail.
  return res.json({
    status: 'success',
    data: { received: commits.length, pendingCount, autoDeployed: false },
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * Admin API (SUPER_ADMIN only)
 * ──────────────────────────────────────────────────────────────────────────── */

router.use(authenticate, authorize('SUPER_ADMIN'));

// GET /api/v1/deploy/status — git state + whether a deploy is in flight
router.get('/status', async (_req, res) => {
  try {
    const status = await getDeployStatus();
    const pendingCommits = await prisma.pendingCommit.findMany({
      where: { deployed: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const last = await prisma.deployment.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const webhookConfigured = Boolean(getSecret('GITHUB_WEBHOOK_SECRET'));

    res.json({
      status: 'success',
      data: { ...status, pendingCommits, lastDeployment: last, webhookConfigured },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/deploy/run — trigger a deployment
router.post('/run', async (req, res) => {
  if (isDeploying()) {
    return res
      .status(409)
      .json({ status: 'error', message: 'A deployment is already running' });
  }

  try {
    const { id } = await startDeploy({
      trigger: 'MANUAL',
      triggeredById: req.user!.id,
      triggeredBy: req.user!.email,
      onLog: (line) => emit('deploy:log', { line, at: Date.now() }),
      onStatus: (status, deployment) => emit('deploy:status', { status, deployment }),
    });

    console.log(`[deploy] started ${id} by ${req.user!.email}`);
    res.json({ status: 'success', data: { deploymentId: id } });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/v1/deploy/history
router.get('/history', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(50, parseInt(String(req.query.limit || '15'), 10));

  const [items, total] = await Promise.all([
    prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.deployment.count(),
  ]);

  res.json({
    status: 'success',
    data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
  });
});

// GET /api/v1/deploy/:id/log — full log for one deployment
router.get('/:id/log', async (req, res) => {
  try {
    const log = await readDeployLog(req.params.id);
    res.json({ status: 'success', data: { log } });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

export default router;
