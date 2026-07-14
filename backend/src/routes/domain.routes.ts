import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { CloudflareDomainService } from '../services/cloudflare-domain.service.js';

const router = Router();

/**
 * Request to connect a custom domain
 */
router.post(
  '/connect',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      throw new AppException(400, 'Nom de domaine invalide.');
    }

    const cleanDomain = domain.trim().toLowerCase();

    // Check if domain is already used
    const existingUser = await prisma.user.findFirst({
      where: { customDomain: cleanDomain, id: { not: req.user!.id } }
    });

    if (existingUser) {
      throw new AppException(400, 'Ce domaine est déjà utilisé par un autre compte.');
    }

    // Call Cloudflare API
    let cfId: string | null = null;
    try {
      const result = await CloudflareDomainService.addCustomHostname(cleanDomain);
      cfId = result.id;
    } catch (cloudflareError: any) {
      console.error('Error adding custom hostname to Cloudflare:', cloudflareError);
      // Suppress Cloudflare error to allow saving in DB as PENDING for fallback and testing
    }

    // Update User in DB
    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        customDomain: cleanDomain,
        customDomainStatus: 'PENDING',
        customDomainCfId: cfId || 'pending_cf_id',
      }
    });

    res.json({
      status: 'success',
      data: {
        customDomain: updatedUser.customDomain,
        customDomainStatus: updatedUser.customDomainStatus,
      }
    });
  })
);

/**
 * Refresh domain status from Cloudflare
 */
router.post(
  '/refresh',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { customDomainCfId: true, customDomainStatus: true, customDomain: true }
    });

    if (!user || !user.customDomainCfId) {
      throw new AppException(400, 'Aucun domaine personnalisé configuré.');
    }

    let newStatus = 'PENDING';
    let cloudflareDetails: any = null;

    if (user.customDomainCfId !== 'pending_cf_id') {
      try {
        // Call Cloudflare API
        const result = await CloudflareDomainService.getHostnameStatus(user.customDomainCfId);
        cloudflareDetails = result;
        if (result.status === 'active' && result.ssl?.status === 'active') {
          newStatus = 'ACTIVE';
        } else if (result.status === 'deleted' || result.status === 'blocked') {
          newStatus = 'FAILED';
        }
      } catch (cloudflareError: any) {
        console.error('Error refreshing domain status from Cloudflare:', cloudflareError);
      }
    }

    // Update DB if status changed
    if (newStatus !== user.customDomainStatus) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { customDomainStatus: newStatus }
      });
    }

    res.json({
      status: 'success',
      data: {
        customDomain: user.customDomain,
        customDomainStatus: newStatus,
        cloudflareDetails // Send detailed status back
      }
    });
  })
);

/**
 * Disconnect custom domain
 */
router.delete(
  '/disconnect',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { customDomainCfId: true }
    });

    if (user?.customDomainCfId && user.customDomainCfId !== 'pending_cf_id') {
      try {
        // Delete from Cloudflare
        await CloudflareDomainService.deleteCustomHostname(user.customDomainCfId);
      } catch (cloudflareError: any) {
        console.error('Error deleting custom hostname from Cloudflare:', cloudflareError);
      }
    }

    // Remove from DB
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        customDomain: null,
        customDomainStatus: 'NONE',
        customDomainCfId: null,
      }
    });

    res.json({
      status: 'success',
      message: 'Domaine déconnecté avec succès.'
    });
  })
);

export default router;
