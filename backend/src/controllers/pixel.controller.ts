import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { invalidateByInfluencer } from '../services/landingCompiler/index.js';
import axios from 'axios';

const prisma = new PrismaClient();

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

    res.json({ status: 'success', data: pixels });
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
        conversionEvent: conversionEvent || 'Lead'
      }
    });

    // Pixels are injected into compiled landing pages, but they live on the
    // User rather than the landing page, so nothing else marks those pages
    // stale. Drop them now instead of waiting out the freshness window.
    invalidateByInfluencer(userId);

    res.status(201).json({ status: 'success', data: newPixel });
  } catch (error) {
    console.error('createPixel error:', error);
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
