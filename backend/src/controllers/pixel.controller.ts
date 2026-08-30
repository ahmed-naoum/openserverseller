import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { invalidateByInfluencer } from '../services/landingCompiler/index.js';
import { sendMetaCapiTestEvent } from '../services/metaCapi.service.js';
import axios from 'axios';

const prisma = new PrismaClient();

/**
 * The Conversions API token never leaves the server, not even back to its
 * owner: the dashboard gets a boolean and the last four characters, enough to
 * recognise which token is stored without an XSS anywhere in the app being
 * able to exfiltrate it.
 */
const toClientPixel = (pixel: any) => {
  const { accessToken, ...rest } = pixel;
  return {
    ...rest,
    hasAccessToken: !!accessToken,
    accessTokenHint: accessToken ? String(accessToken).slice(-4) : null,
  };
};

/** Meta system-user tokens are long base64-ish strings; anything else is junk. */
const sanitizeAccessToken = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  return /^[A-Za-z0-9_-]{20,512}$/.test(s) ? s : null;
};

const sanitizeTestEventCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  return /^[A-Za-z0-9]{1,50}$/.test(s) ? s : null;
};

export const listUserPixels = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Non autorisé' });
    }

    const { platform } = req.query;

    const pixels = await prisma.userPixel.findMany({
      where: {
        userId,
        ...(platform ? { platform: platform as string } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ status: 'success', data: pixels.map(toClientPixel) });
  } catch (error) {
    console.error('listUserPixels error:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
};

export const createPixel = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Non autorisé' });
    }

    const { name, type, pixelId, platform, targetIds, conversionEvent } = req.body;

    if (!name || !type || !pixelId) {
      return res.status(400).json({ status: 'error', message: 'Données manquantes' });
    }

    const activePlatform = platform || 'META';

    // A token on a non-Meta pixel would sit unused and unmasked in the DB, so
    // it is dropped rather than stored. A malformed one is refused loudly —
    // silently discarding it would read as "CAPI configured" when it is not.
    const accessToken = activePlatform === 'META' ? sanitizeAccessToken(req.body.accessToken) : null;
    if (activePlatform === 'META' && req.body.accessToken && !accessToken) {
      return res.status(400).json({ status: 'error', message: "Token d'accès invalide. Copiez-le depuis Meta Events Manager sans espaces." });
    }
    const testEventCode = activePlatform === 'META' ? sanitizeTestEventCode(req.body.testEventCode) : null;

    // Check exact duplicate to avoid redundant pixels
    const existing = await prisma.userPixel.findFirst({
      where: { userId, pixelId, type, platform: activePlatform }
    });

    if (existing && existing.type === 'GLOBAL') {
      return res.status(400).json({ status: 'error', message: `Ce Pixel ID existe déjà en mode Global pour ${activePlatform}` });
    }

    const newPixel = await prisma.userPixel.create({
      data: {
        userId,
        name,
        type,
        pixelId,
        platform: activePlatform,
        targetIds: targetIds || [],
        conversionEvent: conversionEvent || 'Lead',
        accessToken,
        testEventCode
      }
    });

    // Pixels are injected into compiled landing pages, but they live on the
    // User rather than the landing page, so nothing else marks those pages
    // stale. Drop them now instead of waiting out the freshness window.
    invalidateByInfluencer(userId);

    res.status(201).json({ status: 'success', data: toClientPixel(newPixel) });
  } catch (error) {
    console.error('createPixel error:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
};

/**
 * Partial update, built for the Conversions API panel: token and test code can
 * be set, replaced or cleared (empty string clears) on an existing pixel
 * without deleting it — deletion would drop the pixel off live pages for the
 * minutes it takes to recreate it.
 */
export const updatePixel = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const pixelIdParam = parseInt(req.params.id as string);

    if (!userId || isNaN(pixelIdParam)) {
      return res.status(400).json({ status: 'error', message: 'ID invalide' });
    }

    const pixel = await prisma.userPixel.findUnique({ where: { id: pixelIdParam } });
    if (!pixel || pixel.userId !== userId) {
      return res.status(404).json({ status: 'error', message: 'Pixel non trouvé' });
    }

    const data: Record<string, any> = {};

    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      data.name = req.body.name.trim().slice(0, 100);
    }
    if (req.body.conversionEvent === 'Lead' || req.body.conversionEvent === 'Purchase') {
      data.conversionEvent = req.body.conversionEvent;
    }

    if ('accessToken' in req.body) {
      if (pixel.platform !== 'META') {
        return res.status(400).json({ status: 'error', message: "L'API Conversions n'est disponible que pour les pixels Meta" });
      }
      if (req.body.accessToken === '' || req.body.accessToken === null) {
        data.accessToken = null;
      } else {
        const token = sanitizeAccessToken(req.body.accessToken);
        if (!token) {
          return res.status(400).json({ status: 'error', message: "Token d'accès invalide. Copiez-le depuis Meta Events Manager sans espaces." });
        }
        data.accessToken = token;
      }
    }

    if ('testEventCode' in req.body) {
      if (req.body.testEventCode === '' || req.body.testEventCode === null) {
        data.testEventCode = null;
      } else {
        const code = sanitizeTestEventCode(req.body.testEventCode);
        if (!code) {
          return res.status(400).json({ status: 'error', message: 'Code de test invalide (lettres et chiffres uniquement)' });
        }
        data.testEventCode = code;
      }
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ status: 'error', message: 'Aucune modification' });
    }

    const updated = await prisma.userPixel.update({ where: { id: pixelIdParam }, data });

    // Name and conversionEvent are baked into compiled pages; the token is not,
    // but invalidating on every edit is cheap and keeps this hook unconditional.
    invalidateByInfluencer(userId);

    res.json({ status: 'success', data: toClientPixel(updated) });
  } catch (error) {
    console.error('updatePixel error:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
};

/**
 * Sends a synthetic Lead through the Conversions API so the seller can watch
 * it arrive in Events Manager's Test Events tab. Proves the token + pixel pair
 * end to end before a real order depends on it.
 */
export const testPixelCapi = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const pixelIdParam = parseInt(req.params.id as string);

    if (!userId || isNaN(pixelIdParam)) {
      return res.status(400).json({ status: 'error', message: 'ID invalide' });
    }

    const pixel = await prisma.userPixel.findUnique({ where: { id: pixelIdParam } });
    if (!pixel || pixel.userId !== userId) {
      return res.status(404).json({ status: 'error', message: 'Pixel non trouvé' });
    }

    const token = (typeof req.body?.token === 'string' && req.body.token.trim())
      ? req.body.token.trim()
      : pixel.accessToken;

    if (pixel.platform !== 'META' || !token) {
      return res.status(400).json({ status: 'error', message: "Configurez d'abord un token d'accès API Conversions sur ce pixel" });
    }

    const testEventCode = (typeof req.body?.testEventCode === 'string' && req.body.testEventCode.trim())
      ? req.body.testEventCode.trim()
      : pixel.testEventCode;

    const result = await sendMetaCapiTestEvent({
      pixelId: pixel.pixelId,
      accessToken: token,
      testEventCode,
      conversionEvent: pixel.conversionEvent,
    });

    if (result.ok) {
      return res.json({
        status: 'success',
        message: `Événement de test envoyé (reçus: ${result.eventsReceived ?? 1}). Vérifiez l'onglet "Événements de test" dans Meta Events Manager.`,
      });
    }
    if (result.error === 'TEST_CODE_REQUIRED') {
      return res.status(400).json({
        status: 'error',
        message: 'Entrez d\'abord un code de test (onglet "Événements de test" dans Meta Events Manager).',
      });
    }
    return res.status(400).json({ status: 'error', message: `Meta a refusé l'événement: ${result.error}` });
  } catch (error) {
    console.error('testPixelCapi error:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
};

export const deletePixel = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const pixelIdParam = parseInt(req.params.id as string);

    if (!userId || isNaN(pixelIdParam)) {
      return res.status(400).json({ status: 'error', message: 'ID invalide' });
    }

    const pixel = await prisma.userPixel.findUnique({ where: { id: pixelIdParam } });

    if (!pixel || pixel.userId !== userId) {
      return res.status(404).json({ status: 'error', message: 'Pixel non trouvé' });
    }

    await prisma.userPixel.delete({ where: { id: pixelIdParam } });

    // Same reasoning as createPixel: a removed pixel must stop firing on
    // compiled pages immediately, not whenever the freshness window expires.
    invalidateByInfluencer(userId);

    res.json({ status: 'success', message: 'Pixel supprimé' });
  } catch (error) {
    console.error('deletePixel error:', error);
    res.status(500).json({ status: 'error', message: 'Erreur serveur' });
  }
};

export const verifyPixel = async (req: Request, res: Response) => {
  try {
    const { pixelId } = req.body;
    if (!pixelId) {
      return res.status(400).json({ status: 'error', message: 'Pixel ID requis' });
    }

    // Ping the public Facebook tracking URL to verify the pixel
    // If it exists and is active, it returns a 1x1 GIF (HTTP 200)
    // If it's totally invalid, it might still return 200 for the script, but let's try the /tr endpoint
    const url = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    
    const response = await axios.get(url, {
      validateStatus: () => true, // resolve all statuses
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (response.status === 200) {
      res.json({ status: 'success', message: 'Pixel valide' });
    } else {
      res.status(400).json({ status: 'error', message: 'Pixel potentiellement invalide ou injoignable' });
    }
  } catch (error) {
    console.error('verifyPixel error:', error);
    res.status(500).json({ status: 'error', message: 'Erreur lors de la vérification' });
  }
};
