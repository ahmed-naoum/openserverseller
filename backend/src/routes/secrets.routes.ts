/**
 * Admin API for runtime configuration (SUPER_ADMIN only).
 *
 * Secret values are never returned in full — only a masked preview showing the
 * last 4 characters, which is enough to confirm which credential is installed
 * without exposing it to the browser, the network log, or a screen recording.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  SECRET_REGISTRY,
  SECRET_CATEGORY_LABELS,
  getDefinition,
} from '../config/secretRegistry.js';
import {
  getSecret,
  getSource,
  setSecret,
  deleteSecret,
  isEncryptionKeyConfigured,
} from '../lib/secretStore.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(authenticate, authorize('SUPER_ADMIN'));

/**
 * Records a configuration change without ever touching the value.
 *
 * This router is deliberately excluded from the generic `auditLog` middleware
 * (see routes/index.ts): that middleware persists req.body, and the body here is
 * `{ value: "<the credential>" }`. What an auditor needs is which key changed,
 * by whom, and when — never the secret itself.
 */
async function auditSecretChange(
  action: 'SECRET_UPDATED' | 'SECRET_DELETED',
  key: string,
  user?: { id?: number; email?: string },
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: user?.id ?? null,
        action,
        modelType: 'AppSecret',
        // modelId is an Int and the identifier here is a key name, so it goes
        // in `changes` alongside the actor.
        changes: JSON.stringify({ key, by: user?.email ?? 'unknown' }),
      },
    });
  } catch (err) {
    // Never let audit bookkeeping fail the configuration change itself.
    console.error('[secrets] audit write failed:', err);
  }
}

/** Shows only the last 4 characters: "••••••••3bd". */
function maskValue(value: string): string {
  if (value.length <= 4) return '•'.repeat(8);
  return '•'.repeat(Math.min(value.length - 4, 24)) + value.slice(-4);
}

// GET /api/v1/admin/secrets — registry + current state, never raw secret values
router.get('/', async (_req, res) => {
  try {
    const rows = await prisma.appSecret.findMany({
      select: { key: true, updatedAt: true, updatedByEmail: true },
    });
    const meta = new Map(rows.map((r) => [r.key, r]));

    const items = SECRET_REGISTRY.map((def) => {
      const value = getSecret(def.key);
      const source = getSource(def.key);
      const row = meta.get(def.key);

      return {
        key: def.key,
        label: def.label,
        category: def.category,
        categoryLabel: SECRET_CATEGORY_LABELS[def.category],
        secret: def.secret,
        bootstrap: !!def.bootstrap,
        multiline: !!def.multiline,
        description: def.description ?? null,
        source,
        // Non-secret values are shown in full so admins can actually read config.
        preview:
          value === undefined || value === ''
            ? null
            : def.secret
              ? maskValue(value)
              : value,
        updatedAt: row?.updatedAt ?? null,
        updatedByEmail: row?.updatedByEmail ?? null,
      };
    });

    return res.json({
      status: 'success',
      data: {
        items,
        categories: SECRET_CATEGORY_LABELS,
        encryptionKeyConfigured: isEncryptionKeyConfigured(),
      },
    });
  } catch (error) {
    console.error('[secrets] list failed:', error);
    return res.status(500).json({ status: 'error', message: 'Échec du chargement de la configuration.' });
  }
});

// PUT /api/v1/admin/secrets/:key — store a value in the database
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body ?? {};

  const def = getDefinition(key);
  if (!def) {
    return res.status(404).json({ status: 'error', message: `Clé inconnue : ${key}` });
  }
  if (def.bootstrap) {
    return res.status(400).json({
      status: 'error',
      message: `${key} est une valeur de démarrage et doit rester dans le fichier .env.`,
    });
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Valeur requise.' });
  }

  try {
    await setSecret(key, value.trim(), { id: req.user?.id, email: req.user?.email });
    await auditSecretChange('SECRET_UPDATED', key, req.user);
    console.log(`[secrets] ${key} updated by ${req.user?.email ?? 'unknown'}`);
    return res.json({
      status: 'success',
      message: `${def.label} mis à jour.`,
      data: { key, source: getSource(key) },
    });
  } catch (error: any) {
    console.error(`[secrets] update ${key} failed:`, error);
    return res.status(400).json({ status: 'error', message: error.message ?? 'Échec de la mise à jour.' });
  }
});

// DELETE /api/v1/admin/secrets/:key — drop the override, fall back to .env
router.delete('/:key', async (req, res) => {
  const { key } = req.params;

  const def = getDefinition(key);
  if (!def) {
    return res.status(404).json({ status: 'error', message: `Clé inconnue : ${key}` });
  }
  if (def.bootstrap) {
    return res.status(400).json({
      status: 'error',
      message: `${key} n'est pas géré depuis cette interface.`,
    });
  }

  try {
    await deleteSecret(key);
    await auditSecretChange('SECRET_DELETED', key, req.user);
    console.log(`[secrets] ${key} override removed by ${req.user?.email ?? 'unknown'}`);
    return res.json({
      status: 'success',
      message: `${def.label} réinitialisé sur la valeur du fichier .env.`,
      data: { key, source: getSource(key) },
    });
  } catch (error: any) {
    console.error(`[secrets] delete ${key} failed:`, error);
    return res.status(400).json({ status: 'error', message: error.message ?? 'Échec de la réinitialisation.' });
  }
});

export default router;
