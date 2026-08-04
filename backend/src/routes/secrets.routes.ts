import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { decrypt, encrypt } from '../utils/crypto.js';
import { logImmutableAction } from '../utils/hashChain.js';
import { SECRETS_ALLOWLIST, getSecret, updateSecretInMemory, deleteSecretFromMemory } from '../utils/secrets.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (_req: Request, res: Response) => {
    const secrets = await prisma.appSecret.findMany({
      orderBy: { key: 'asc' }
    });
    const safeSecrets = secrets.map(s => ({
      key: s.key,
      description: s.description,
      isEncrypted: s.isEncrypted,
      updatedAt: s.updatedAt,
      value: '••••••••'
    }));
    res.json({ status: 'success', data: safeSecrets });
  })
);

router.get(
  '/reveal/:key',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.key as string;
    if (!SECRETS_ALLOWLIST.has(key)) {
      throw new AppException(400, 'Clé non autorisée');
    }
    const secret = await prisma.appSecret.findUnique({
      where: { key }
    });
    if (!secret) {
      throw new AppException(404, 'Secret non trouvé');
    }
    const decryptedVal = secret.value.startsWith('ENC:') ? decrypt(secret.value) : secret.value;
    
    let maskedVal = '••••';
    if (decryptedVal.length > 4) {
      maskedVal = '••••' + decryptedVal.slice(-4);
    } else if (decryptedVal.length > 1) {
      maskedVal = '••' + decryptedVal.slice(-1);
    }
    
    res.json({
      status: 'success',
      data: {
        key: secret.key,
        value: maskedVal
      }
    });
  })
);

router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.body.key as string;
    const value = req.body.value as string;
    const description = req.body.description as string | undefined;

    if (!key || value === undefined) {
      throw new AppException(400, 'Clé et valeur requises');
    }
    
    if (!SECRETS_ALLOWLIST.has(key)) {
      throw new AppException(400, 'Cette variable d\'environnement n\'est pas autorisée à être modifiée.');
    }

    const encryptedVal = encrypt(value);
    const secret = await prisma.appSecret.upsert({
      where: { key },
      update: { value: encryptedVal, isEncrypted: true, description },
      create: { key, value: encryptedVal, isEncrypted: true, description }
    });

    updateSecretInMemory(key, value);

    try {
      const actor = req.user!.email || 'unknown';
      const timestamp = new Date().toISOString();
      const meta = { key, actor, timestamp };

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: `UPDATE_SECRET ${key}`,
          changes: JSON.stringify(meta)
        }
      });

      await logImmutableAction(
        req.user!.id,
        actor,
        `UPDATE_SECRET ${key}`,
        req.ip || 'unknown',
        meta
      );
    } catch (auditErr) {
      console.warn('Failed to record custom secrets audit log:', auditErr);
    }

    res.json({
      status: 'success',
      message: 'Secret enregistré avec succès',
      data: {
        key: secret.key,
        description: secret.description,
        updatedAt: secret.updatedAt
      }
    });
  })
);

router.delete(
  '/:key',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.key as string;
    
    if (!SECRETS_ALLOWLIST.has(key)) {
      throw new AppException(400, 'Clé non autorisée');
    }

    const existing = await prisma.appSecret.findUnique({
      where: { key }
    });
    if (!existing) {
      throw new AppException(404, 'Secret non trouvé');
    }
    await prisma.appSecret.delete({
      where: { key }
    });
    
    deleteSecretFromMemory(key);

    try {
      const actor = req.user!.email || 'unknown';
      const timestamp = new Date().toISOString();
      const meta = { key, actor, timestamp };

      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          action: `DELETE_SECRET ${key}`,
          changes: JSON.stringify(meta)
        }
      });

      await logImmutableAction(
        req.user!.id,
        actor,
        `DELETE_SECRET ${key}`,
        req.ip || 'unknown',
        meta
      );
    } catch (auditErr) {
      console.warn('Failed to record custom secrets delete audit log:', auditErr);
    }

    res.json({
      status: 'success',
      message: 'Secret supprimé avec succès'
    });
  })
);

export default router;
